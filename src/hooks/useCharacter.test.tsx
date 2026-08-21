import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/queryClient';
import { CHARACTERS_URL, makeCharacterForId } from '@/test/handlers';
import { server } from '@/test/server';

import { useCharacter } from './useCharacter';

function renderAtId(id: number | undefined) {
  const queryClient = createQueryClient({ retry: false });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(({ id: current }) => useCharacter({ id: current }), {
    wrapper,
    initialProps: { id },
  });
}

describe('useCharacter', () => {
  it('resolves the character the id names', async () => {
    const { result } = renderAtId(1);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.name).toBe(makeCharacterForId(1).name);
  });

  /**
   * The `skipToken` decision, asserted rather than assumed: an absent id is an
   * incomplete URL, not a request for character `undefined`.
   */
  it('sends nothing without an id', () => {
    const requested: string[] = [];
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, ({ params }) => {
        requested.push(String(params.id));

        return HttpResponse.json(makeCharacterForId(Number(params.id)));
      }),
    );

    const { result } = renderAtId(undefined);

    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).toEqual([]);
  });

  /**
   * Covers the hook's wiring, not TanStack Query's cancellation: the queryFn passes the
   * `signal` from its context to the fetcher, and dropping that argument fails this.
   */
  it('aborts the request the id it left still had open', async () => {
    const abortedIds: string[] = [];
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, async ({ request, params }) => {
        request.signal.addEventListener('abort', () => abortedIds.push(String(params.id)));
        // Never answers, so the switch below happens with the request still open.
        await delay('infinite');

        return HttpResponse.json({ error: 'unreachable' }, { status: 500 });
      }),
    );

    const { rerender } = renderAtId(1);
    await act(async () => {
      await Promise.resolve();
    });

    rerender({ id: 2 });
    await waitFor(() => {
      expect(abortedIds).toEqual(['1']);
    });
  });
});
