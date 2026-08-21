import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/queryClient';
import { CHARACTERS_URL, makeCharacterForId } from '@/test/handlers';
import { server } from '@/test/server';

import { useCharacter } from './useCharacter';
import { usePrefetchCharacter } from './usePrefetchCharacter';

function renderPrefetch() {
  const queryClient = createQueryClient({ retry: false });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => usePrefetchCharacter(), { wrapper });

  return { prefetch: result.current, queryClient, wrapper };
}

/** Serves the character and records every id that actually left. */
function recordRequests() {
  const requested: string[] = [];
  server.use(
    http.get(`${CHARACTERS_URL}/:id`, ({ params }) => {
      const id = Number(params.id);
      requested.push(String(params.id));

      return HttpResponse.json(makeCharacterForId(id));
    }),
  );

  return requested;
}

/**
 * The hook is one call into TanStack Query, so what is worth asserting is the wiring
 * around it: the entry lands where the detail hook looks for it, and it carries the
 * staleTime that keeps a re-hover free.
 */
describe('usePrefetchCharacter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves the character where useCharacter reads it', async () => {
    const { prefetch, queryClient, wrapper } = renderPrefetch();

    prefetch(1);
    expect(queryClient.isFetching()).toBe(1);

    await vi.waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });

    // Deliberately no waitFor below: a query that needs one has not read the entry
    // the prefetch wrote.
    const { result } = renderHook(() => useCharacter({ id: 1 }), { wrapper });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data?.name).toBe(makeCharacterForId(1).name);
  });

  it('makes no second request while the entry is still fresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    const requested = recordRequests();
    const { prefetch, queryClient } = renderPrefetch();

    prefetch(1);
    await vi.waitFor(() => {
      expect(requested).toEqual(['1']);
    });

    vi.setSystemTime(Date.now() + 60_000);

    prefetch(1);
    await vi.waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });

    expect(requested).toEqual(['1']);
  });

  it('does not reject when the request fails', async () => {
    server.use(http.get(`${CHARACTERS_URL}/:id`, () => HttpResponse.json({ error: 'Server error' }, { status: 500 })));
    const { prefetch, queryClient } = renderPrefetch();

    prefetch(1);
    await vi.waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });

    // The failure is swallowed rather than thrown: an unhandled rejection out of a
    // hover would reach the window, and there is nothing for a user to do about it.
    expect(queryClient.getQueryCache().findAll({ queryKey: ['character'] })[0]?.state.status).toBe('error');
  });
});
