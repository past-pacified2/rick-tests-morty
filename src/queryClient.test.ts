import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { FetchError, fetchCharactersListPage } from '@/api/characters';
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

  /** The delay is a function of the attempt alone — no longer of the error. */
  const retryDelayCases = [
    { name: 'the first retry, no jitter', attempt: 0, random: 0, expected: 10_000 },
    { name: 'the first retry, near-full jitter', attempt: 0, random: 0.999, expected: 12_997 },
    { name: 'the second retry', attempt: 1, random: 0.5, expected: 21_500 },
    { name: 'a late attempt, capped', attempt: 20, random: 0, expected: 30_000 },
  ];

  const { retryDelay } = createQueryClient().getDefaultOptions().queries ?? {};
  if (typeof retryDelay !== 'function') {
    throw new Error('the retryDelay default must be a function');
  }

  it.each(retryDelayCases)('waits $expected ms for $name', ({ attempt, random, expected }) => {
    vi.spyOn(Math, 'random').mockReturnValue(random);

    expect(retryDelay(attempt, new Error('offline'))).toBe(expected);
  });
});
