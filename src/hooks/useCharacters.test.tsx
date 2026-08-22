import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/queryClient';
import { CHARACTERS_URL } from '@/test/handlers';
import { server } from '@/test/server';

import { useCharacters } from './useCharacters';

type Props = Parameters<typeof useCharacters>[0];

/**
 * `name` is passed straight through, `undefined` included — the hook's own `?? ''` is
 * what this file is here to exercise, so a helper that defaulted it would hide the
 * branch it is testing.
 */
function renderAtPage(page: number, name?: string) {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  // Built rather than spread: `exactOptionalPropertyTypes` distinguishes an absent
  // `name` from one explicitly set to undefined, and the hook's signature wants the
  // former.
  const initialProps: Props = name === undefined ? { page } : { page, name };
  const { rerender, result } = renderHook((props: Props) => useCharacters(props), { wrapper, initialProps });

  return { rerender, result, queryClient };
}

/** Records the `name` each outgoing request carried, `null` when it carried none. */
function recordNames() {
  const requested: (string | null)[] = [];

  server.use(
    http.get(CHARACTERS_URL, ({ request }) => {
      requested.push(new URL(request.url).searchParams.get('name'));

      return undefined;
    }),
  );

  return requested;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function actAsync() {
  await act(async () => {
    await Promise.resolve();
  });
}

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
    // Three, not RETRY_COUNT + 1: expressed in terms of the constant, this asserts that
    // page 2 retried as often as the client says to rather than as often as it should.
    expect(requestedPages.filter((page) => page === '2')).toHaveLength(3);
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
    await actAsync();

    rerender({ page: 2 });
    await vi.waitFor(() => {
      expect(abortedPages).toEqual(['1']);
    });
  });
});

describe('useCharacters', () => {
  it('sends the search term it was given', async () => {
    const requested = recordNames();

    const { result } = renderAtPage(1, 'Rick');

    // Settled rather than merely requested: `waitFor` from Testing Library wraps the
    // state update that resolving the query causes, which vi.waitFor does not.
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(requested).toEqual(['Rick']);
  });

  /**
   * The absent-name branch, which is the one with something to get wrong: anything the
   * hook substitutes for `undefined` becomes a filter the user never typed.
   */
  it('sends no name param when it was given none', async () => {
    const requested = recordNames();

    const { result } = renderAtPage(1);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(requested).toEqual([null]);
  });
});
