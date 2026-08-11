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
});
