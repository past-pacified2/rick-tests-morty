import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import {
  makeCharacter,
  makeCharactersListPage,
  PAGE_SIZE,
  TOTAL_PAGES,
  CHARACTERS_URL,
  BASE_URL,
} from '@/test/handlers';
import { server } from '@/test/server';

import { fetchCharactersListPage, FetchError, SYSTEM_ERROR_MSG, RATE_LIMIT_ERROR_MSG } from './characters';

/**
 * No fetch is mocked here. MSW intercepts at the HTTP layer (see src/test/server.ts),
 */
describe('fetchCharactersListPage', () => {
  it('parses a successful response into a typed page', async () => {
    const page = await fetchCharactersListPage({ page: 1 });

    expect(page.results).toHaveLength(PAGE_SIZE);
    expect(page.results[0]).toMatchObject({ id: 1, name: 'Character 1' });
    expect(page.info.pages).toBe(TOTAL_PAGES);
  });

  it('requests the page number it was given', async () => {
    const page = 3;
    let requestedUrl: string | undefined;

    const shouldBeRequestedUrl = `${CHARACTERS_URL}?page=${page.toString()}`;

    server.use(
      http.get(CHARACTERS_URL, ({ request }) => {
        requestedUrl = request.url;

        // falls through to the default handler, making this handler an observer
        return undefined;
      }),
    );

    await fetchCharactersListPage({ page });

    expect(requestedUrl).toBe(shouldBeRequestedUrl);
  });

  it('throws a FetchError carrying the status when the response is not ok', async () => {
    const pageOverflow = TOTAL_PAGES + 1;
    const promise = fetchCharactersListPage({ page: pageOverflow });

    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('status', 404);
  });

  it('throws when the response body does not match the schema', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        const validResult = makeCharactersListPage(1);
        return HttpResponse.json({ ...validResult, results: [{ ...validResult.results[0], id: '1' }] });
      }),
    );
    const promise = fetchCharactersListPage({ page: 1 });

    await expect(promise).rejects.toBeInstanceOf(ZodError);
  });

  it('accepts every value the schema allows', async () => {
    const validCharacters = [
      makeCharacter(),
      makeCharacter({ status: 'Dead' }),
      makeCharacter({ status: 'unknown' }),
      makeCharacter({ gender: 'Female' }),
      makeCharacter({ gender: 'Genderless' }),
      makeCharacter({ gender: 'unknown' }),
    ];

    server.use(
      http.get(CHARACTERS_URL, () => {
        const page = makeCharactersListPage(1);
        return HttpResponse.json({
          ...page,
          results: validCharacters,
        });
      }),
    );

    const page = await fetchCharactersListPage({ page: 1 });
    expect(page.results).toHaveLength(validCharacters.length);
    expect(page.results).toEqual(validCharacters);
  });

  it('accepts a base URL that already ends in a slash', async () => {
    vi.stubEnv('VITE_API_BASE_URL', `${BASE_URL}/`);

    const page = await fetchCharactersListPage({ page: 1 });
    expect(page.results).toHaveLength(PAGE_SIZE);
    expect(page.results[0]).toMatchObject({ id: 1, name: 'Character 1' });
    expect(page.info.pages).toBe(TOTAL_PAGES);
  });

  it('throws when the base URL is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const promise = fetchCharactersListPage({ page: 1 });

    await expect(promise).rejects.toThrow('API base URL is not set');
  });

  it('throws a FetchError carrying the retry delay in milliseconds when the response is a 429', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'retry-after': '1' } });
      }),
    );
    const promise = fetchCharactersListPage({ page: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('retryDelayMs', 1000);
  });

  it('throws a FetchError on 429 without retry delay when response header have none or 0', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }),
    );
    const promise = fetchCharactersListPage({ page: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('retryDelayMs', undefined);

    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'retry-after': '0' } });
      }),
    );
    const nulledRetryDelayPromise = fetchCharactersListPage({ page: 1 });
    await expect(nulledRetryDelayPromise).rejects.toBeInstanceOf(FetchError);
    await expect(nulledRetryDelayPromise).rejects.toHaveProperty('retryDelayMs', undefined);
  });

  it('throws proper error messages on differnet error satuses', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'System error' }, { status: 500 });
      }),
    );
    const promise = fetchCharactersListPage({ page: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('message', SYSTEM_ERROR_MSG);

    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }),
    );
    const rateLimitPromise = fetchCharactersListPage({ page: 1 });
    await expect(rateLimitPromise).rejects.toBeInstanceOf(FetchError);
    await expect(rateLimitPromise).rejects.toHaveProperty('message', RATE_LIMIT_ERROR_MSG);
  });
});
