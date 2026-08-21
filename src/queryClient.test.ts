import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { LIST_SYSTEM_ERROR_MSG, RATE_LIMIT_ERROR_MSG, FetchError, fetchCharactersListPage } from '@/api/characters';
import { createQueryClient, RETRY_COUNT } from '@/queryClient';
import { CHARACTERS_URL } from '@/test/handlers';
import { server } from '@/test/server';

describe('createQueryClient', () => {
  it('stops immediately on a 404', async () => {
    let requestCount = 0;
    server.use(
      http.get(CHARACTERS_URL, () => {
        requestCount++;
        return HttpResponse.json(
          {
            error: 'Not Found',
          },
          {
            status: 404,
          },
        );
      }),
    );

    const queryClient = createQueryClient({ retryDelay: 0 });

    const promise = queryClient.fetchQuery({
      queryKey: ['characters', { page: 1 }],
      queryFn: () => fetchCharactersListPage({ page: 1 }),
    });

    await expect(promise).rejects.toBeInstanceOf(FetchError);
    expect(requestCount).toBe(1);
  });

  it('retries on 500 errors', async () => {
    let requestCount = 0;
    server.use(
      http.get(CHARACTERS_URL, () => {
        requestCount++;
        return HttpResponse.json(
          {
            error: 'Internal Server Error',
          },
          {
            status: 500,
          },
        );
      }),
    );

    const queryClient = createQueryClient({ retryDelay: 0 });

    const promise = queryClient.fetchQuery({
      queryKey: ['characters', { page: 1 }],
      queryFn: () => fetchCharactersListPage({ page: 1 }),
    });

    await expect(promise).rejects.toBeInstanceOf(FetchError);
    expect(requestCount).toBe(RETRY_COUNT + 1);
  });

  /** The delay is a function of the error as well as the attempt. */
  const retryDelayCases = [
    { name: 'a network failure, no jitter', attempt: 0, random: 0, error: new Error('offline'), expected: 500 },
    {
      name: 'a network failure, near-full jitter',
      attempt: 0,
      random: 0.999,
      error: new Error('offline'),
      expected: 750,
    },
    {
      name: 'a network failure on the second retry',
      attempt: 1,
      random: 0.5,
      error: new Error('offline'),
      expected: 1125,
    },
    { name: 'a network failure, capped', attempt: 20, random: 0, error: new Error('offline'), expected: 5000 },
    { name: 'a server error', attempt: 0, random: 0, error: new FetchError(LIST_SYSTEM_ERROR_MSG, 500), expected: 500 },
    { name: 'a rate limit', attempt: 0, random: 0, error: new FetchError(RATE_LIMIT_ERROR_MSG, 429), expected: 10_000 },
    {
      name: 'a rate limit on the second retry',
      attempt: 1,
      random: 0.5,
      error: new FetchError(RATE_LIMIT_ERROR_MSG, 429),
      expected: 21_500,
    },
  ];

  const { retryDelay } = createQueryClient().getDefaultOptions().queries ?? {};
  if (typeof retryDelay !== 'function') {
    throw new Error('the retryDelay default must be a function');
  }

  it.each(retryDelayCases)('waits $expected ms for $name', ({ attempt, random, expected, error }) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);

    expect(retryDelay(attempt, error)).toBe(expected);
  });

  /**
   * Collecting a query before it can go stale would make the staleTime decorative: the
   * entry is gone by the time anything could have read it fresh.
   */
  it('keeps a query cached for at least as long as it stays fresh', () => {
    const { gcTime, staleTime } = createQueryClient().getDefaultOptions().queries ?? {};

    if (typeof gcTime !== 'number' || typeof staleTime !== 'number') {
      throw new Error('the gcTime and staleTime defaults must both be numbers');
    }

    expect(gcTime).toBeGreaterThan(staleTime);
  });
});
