import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

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

  function fetchError(status: number, retryDelayMs?: number): FetchError {
    return new FetchError('Failed to fetch characters list page', status, retryDelayMs);
  }

  const retryDelayCases = [
    { name: 'a 429 with a Retry-After', error: fetchError(429, 4500), attempt: 0, expected: 4500 },
    { name: 'a 429 with no Retry-After', error: fetchError(429, undefined), attempt: 0, expected: 1000 },
    { name: 'a 429 whose Retry-After is 0', error: fetchError(429, 0), attempt: 1, expected: 2000 },
    { name: 'a 500', error: fetchError(500, undefined), attempt: 1, expected: 2000 },
    { name: 'a non-FetchError', error: new Error('offline'), attempt: 2, expected: 4000 },
    { name: 'a late attempt', error: new Error('offline'), attempt: 20, expected: 30_000 },
  ];

  const { retryDelay } = createQueryClient().getDefaultOptions().queries ?? {};
  if (typeof retryDelay !== 'function') {
    throw new Error('the retryDelay default must be a function');
  }

  it.each(retryDelayCases)('waits $expected ms for $name', ({ error, attempt, expected }) => {
    expect(retryDelay(attempt, error)).toBe(expected);
  });
});
