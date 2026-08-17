import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import type { Character, CharacterListPage } from '@/api/characters';

/**
 * The default MSW handlers, plus the factories that build their responses.
 *
 * Factories rather than literal fixtures, and exported so tests assert against the
 * same builders the handlers respond with. A hand-written object in a test and a
 * hand-written response in a handler drift apart eventually, and the day they do the
 * suite is green and wrong.
 *
 * They are typed with the inferred schema types from src/api/characters, which makes
 * that drift a compile error rather than a discovery: rename a field in the schema and
 * these stop building.
 */

/**
 * Trailing slash stripped so the join below cannot produce a double slash.
 *
 * Exported because a test stubbing VITE_API_BASE_URL needs the *base*, not
 * CHARACTERS_URL — that one already carries the /character segment, and using it as a
 * base appends the segment twice.
 */
/**
 * Thrown at import rather than defaulted, so a broken environment takes the whole run
 * down with one accurate message instead of surfacing as a scatter of tests that
 * cannot find their elements. The message names the file that is supposed to supply
 * the value, because that is where the reader has to go.
 */
const baseUrl = import.meta.env.VITE_API_BASE_URL;
if (!baseUrl) {
  throw new Error('VITE_API_BASE_URL is not set — vitest.config.ts supplies it in test.env');
}
export const BASE_URL = baseUrl.replace(/\/$/, '');

export const CHARACTERS_URL = `${BASE_URL}/character`;

/**
 * Two per page rather than the API's twenty. A test asserting on a whole page should
 * be able to state the entire expected contents in one line; twenty rows of fixture
 * would hide the assertion inside its own setup.
 */
export const PAGE_SIZE = 2;
export const TOTAL_PAGES = 42;

export const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 1,
  name: 'Rick Sanchez',
  status: 'Alive',
  species: 'Human',
  image: `${BASE_URL}/character/avatar/1.jpeg`,
  url: `${BASE_URL}/character/1`,
  gender: 'Male',
  location: {
    name: 'Earth',
    url: `${BASE_URL}/location/1`,
  },
  episode: ['1', '2', '3'],
  ...overrides,
});

export const makeCharacterForId = (id: number): Character => {
  return makeCharacter({ id, name: `Character ${id.toString()}`, url: `${BASE_URL}/character/${id.toString()}` });
};

/**
 * Ids and names are derived from the page number, so a test can tell *which* page it
 * received. A factory returning identical characters for every page cannot fail the
 * one assertion that matters for pagination.
 */
const charactersForPage = (page: number): Character[] =>
  Array.from({ length: PAGE_SIZE }, (_, index) => {
    const id = (page - 1) * PAGE_SIZE + index + 1;
    return makeCharacterForId(id);
  });

export const makeCharactersListPage = (page = 1, overrides: Partial<CharacterListPage> = {}): CharacterListPage => ({
  info: {
    count: TOTAL_PAGES * PAGE_SIZE,
    pages: TOTAL_PAGES,
    next: page < TOTAL_PAGES ? `${CHARACTERS_URL}?page=${(page + 1).toString()}` : null,
    prev: page > 1 ? `${CHARACTERS_URL}?page=${(page - 1).toString()}` : null,
  },
  results: charactersForPage(page),
  ...overrides,
});

/**
 * The happy path only. Anything a single test needs — an error status, a malformed
 * body, a slow response — is added in that test with `server.use(...)`, which
 * `setup.ts` reverts afterwards. Encoding every failure case here would make the
 * default behaviour of the suite depend on which test ran last.
 *
 * The real API answers an out-of-range page with 404, so this does too. A mock that is
 * more forgiving than production hides exactly the case worth testing.
 */
export const handlers = [
  http.get(CHARACTERS_URL, ({ request }) => {
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1');

    if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) {
      return HttpResponse.json({ error: 'There is nothing here' }, { status: 404 });
    }

    return HttpResponse.json(makeCharactersListPage(page));
  }),

  http.get(`${CHARACTERS_URL}/:id`, ({ params }) => {
    const id = z.coerce.number().int().positive().safeParse(params.id).data;
    if (id === undefined) {
      return HttpResponse.json({ error: 'Invalid ID' }, { status: 500 });
    }

    if (id > TOTAL_PAGES * PAGE_SIZE) {
      return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return HttpResponse.json(makeCharacterForId(id));
  }),
];
