import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { FetchError } from '@/lib/errors';
import {
  makeCharacter,
  makeCharactersListPage,
  makeCharacterForId,
  PAGE_SIZE,
  TOTAL_PAGES,
  CHARACTERS_URL,
  BASE_URL,
} from '@/test/handlers';
import { server } from '@/test/server';

import { fetchCharactersListPage, fetchCharacter } from './characters';

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
    await expect(promise).rejects.toHaveProperty('name', 'FetchError');
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

  it("throws when a character's image is not a URL", async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        const validResult = makeCharactersListPage(1);
        return HttpResponse.json({ ...validResult, results: [{ ...validResult.results[0], image: 'not-a-url' }] });
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
      makeCharacter({ origin: { name: 'unknown', url: '' } }),
      makeCharacter({ location: { name: 'unknown', url: '' } }),
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

  it('throws a FetchError carrying the status when the response is a 429', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'retry-after': '10' } });
      }),
    );
    const promise = fetchCharactersListPage({ page: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('status', 429);
  });

  it('throws proper error messages on differnet error satuses', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'System error' }, { status: 500 });
      }),
    );
    const promise = fetchCharactersListPage({ page: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('message', 'Failed to fetch characters list page');

    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }),
    );
    const rateLimitPromise = fetchCharactersListPage({ page: 1 });
    await expect(rateLimitPromise).rejects.toBeInstanceOf(FetchError);
    await expect(rateLimitPromise).rejects.toHaveProperty('message', 'Rate limited by the characters API');
  });

  it('throws a FetchError when network error occurs', async () => {
    server.use(http.get(CHARACTERS_URL, () => HttpResponse.error()));

    const promise = fetchCharactersListPage({ page: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('status', 0);
    await expect(promise).rejects.toHaveProperty('message', 'Network error');
  });

  it('rejects with an AbortError when the caller aborts the signal', async () => {
    const abortController = new AbortController();
    const promise = fetchCharactersListPage({ page: 1, signal: abortController.signal });
    abortController.abort();

    await expect(promise).rejects.toHaveProperty('name', 'AbortError');
  });

  it('name reaches the query string', async () => {
    const page = 3;
    const name = 'Rick';
    let requestedUrl: string | undefined;

    const shouldBeRequestedUrl = `${CHARACTERS_URL}?page=${page.toString()}&name=${name}`;

    server.use(
      http.get(CHARACTERS_URL, ({ request }) => {
        requestedUrl = request.url;

        // falls through to the default handler, making this handler an observer
        return undefined;
      }),
    );

    await fetchCharactersListPage({ page, name });

    expect(requestedUrl).toBe(shouldBeRequestedUrl);
  });

  it('blank name is absent from the URL', async () => {
    const page = 3;
    const name = '   ';
    let requestedUrl: string | undefined;

    const shouldBeRequestedUrl = `${CHARACTERS_URL}?page=${page.toString()}`;

    server.use(
      http.get(CHARACTERS_URL, ({ request }) => {
        requestedUrl = request.url;

        // falls through to the default handler, making this handler an observer
        return undefined;
      }),
    );

    await fetchCharactersListPage({ page, name });

    expect(requestedUrl).toBe(shouldBeRequestedUrl);
  });

  it('a 404 with a name resolves to an empty page', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    const promise = fetchCharactersListPage({ page: 1, name: 'Rick' });

    await expect(promise).resolves.toEqual({ info: { count: 0, pages: 0, next: null, prev: null }, results: [] });
  });

  it('a 404 without a name still throws', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    const promise = fetchCharactersListPage({ page: 1, name: '' });

    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('status', 404);
  });

  it('a non-404 with a name throws', async () => {
    server.use(http.get(CHARACTERS_URL, () => HttpResponse.json({ error: 'System error' }, { status: 500 })));

    const promise = fetchCharactersListPage({ page: 1, name: 'Rick' });

    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('status', 500);
  });

  it('a name with a space survives the roundtrip', async () => {
    const page = 1;
    const name = 'Rick Sanchez';
    let requestedUrl: string | undefined;

    const shouldBeRequestedUrl = `${CHARACTERS_URL}?page=${page.toString()}&name=Rick+Sanchez`;

    server.use(
      http.get(CHARACTERS_URL, ({ request }) => {
        requestedUrl = request.url;

        // falls through to the default handler, making this handler an observer
        return undefined;
      }),
    );

    await fetchCharactersListPage({ page, name });

    expect(requestedUrl).toBe(shouldBeRequestedUrl);
  });

  it('whitespace gets trimmed from the URL', async () => {
    const page = 3;
    const name = '   Rick   ';
    let requestedUrl: string | undefined;

    const shouldBeRequestedUrl = `${CHARACTERS_URL}?page=${page.toString()}&name=Rick`;

    server.use(
      http.get(CHARACTERS_URL, ({ request }) => {
        requestedUrl = request.url;

        // falls through to the default handler, making this handler an observer
        return undefined;
      }),
    );

    await fetchCharactersListPage({ page, name });

    expect(requestedUrl).toBe(shouldBeRequestedUrl);
  });
});

describe('fetchCharacter', () => {
  it('fetches a character by id', async () => {
    const characterData = makeCharacterForId(1);
    const character = await fetchCharacter({ id: characterData.id });
    expect(character).toEqual(characterData);
  });

  it('throws when the base URL is empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const promise = fetchCharacter({ id: 1 });

    await expect(promise).rejects.toThrow('API base URL is not set');
  });

  it('throws a FetchError carrying the status when the response is a 429', async () => {
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'retry-after': '10' } });
      }),
    );
    const promise = fetchCharacter({ id: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('status', 429);
  });

  it('throws a FetchError when network error occurs', async () => {
    server.use(http.get(`${CHARACTERS_URL}/:id`, () => HttpResponse.error()));

    const promise = fetchCharacter({ id: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('status', 0);
    await expect(promise).rejects.toHaveProperty('message', 'Network error');
  });

  it('throws when the response body does not match the schema', async () => {
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        const validResult = makeCharacterForId(1);
        return HttpResponse.json({ ...validResult, id: '1' });
      }),
    );
    const promise = fetchCharacter({ id: 1 });

    await expect(promise).rejects.toBeInstanceOf(ZodError);
  });

  it('rejects with an AbortError when the caller aborts the signal', async () => {
    const abortController = new AbortController();
    const promise = fetchCharacter({ id: 1, signal: abortController.signal });
    abortController.abort();

    await expect(promise).rejects.toHaveProperty('name', 'AbortError');
  });

  it('throws proper error messages on differnet error satuses', async () => {
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        return HttpResponse.json({ error: 'System error' }, { status: 500 });
      }),
    );
    const promise = fetchCharacter({ id: 1 });
    await expect(promise).rejects.toBeInstanceOf(FetchError);
    await expect(promise).rejects.toHaveProperty('message', 'Failed to fetch character by id');

    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        return HttpResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      }),
    );
    const rateLimitPromise = fetchCharacter({ id: 1 });
    await expect(rateLimitPromise).rejects.toBeInstanceOf(FetchError);
    await expect(rateLimitPromise).rejects.toHaveProperty('message', 'Rate limited by the characters API');
  });
});
