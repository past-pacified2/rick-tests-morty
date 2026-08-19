import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient, RETRY_COUNT } from '@/queryClient';
import { CHARACTERS_URL } from '@/test/handlers';
import { server } from '@/test/server';

import { useCharacters } from './useCharacters';

/**
 * Covers the hook's wiring, not TanStack Query's cancellation: the queryFn passes the
 * `signal` from its context to the fetcher, and dropping that argument fails these.
 *
 * A rate-limited page waits ~10s before its first retry, long enough to click several
 * more pages. Uncancelled, each leaves a retry chain spending requests on the limit.
 */
describe('useCharacters, when the page changes mid-flight', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderAtPage(page: number) {
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return renderHook(({ page: current }) => useCharacters({ page: current }), {
      wrapper,
      initialProps: { page },
    });
  }

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('abandons the retries the page it left had queued', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const requestedPages: string[] = [];
    server.use(
      http.get(CHARACTERS_URL, ({ request }) => {
        requestedPages.push(new URL(request.url).searchParams.get('page') ?? 'none');

        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }),
    );

    const { rerender } = renderAtPage(1);
    await advance(100);
    expect(requestedPages).toEqual(['1']);

    rerender({ page: 2 }); // before page 1's first retry is due
    await advance(120_000); // past every retry either page could have queued

    expect(requestedPages.filter((page) => page === '1')).toHaveLength(1);
    expect(requestedPages.filter((page) => page === '2')).toHaveLength(RETRY_COUNT + 1);
  });

  it('aborts the request the page it left still had open', async () => {
    const abortedPages: string[] = [];
    server.use(
      http.get(CHARACTERS_URL, async ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? 'none';
        request.signal.addEventListener('abort', () => abortedPages.push(page));
        // Never answers, so the switch below happens with the request still open.
        await delay('infinite');

        return HttpResponse.json({ error: 'unreachable' }, { status: 500 });
      }),
    );

    const { rerender } = renderAtPage(1);
    await act(async () => {
      await Promise.resolve();
    });

    rerender({ page: 2 });
    await vi.waitFor(() => {
      expect(abortedPages).toEqual(['1']);
    });
  });
});
