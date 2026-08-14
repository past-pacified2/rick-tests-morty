import type { Character, CharacterListPage } from '@/api/characters';

/**
 * Deterministic API payloads for the visual suite.
 *
 * Every other spec in tests/e2e talks to the real API on purpose — that is the point of
 * the layer. Visual regression is the one exception: a baseline compares pixels, and
 * pixels rendered from live data change the moment someone adds a character. So the
 * screenshot specs stub, and only the screenshot specs.
 *
 * Deliberately not imported from src/test/handlers.ts. That module reads
 * `import.meta.env` and pulls in MSW — neither exists under Playwright.
 */

const API = 'https://rickandmortyapi.com/api';

const makeCharacter = (id: number): Character => ({
  id,
  name: `Character ${id.toString()}`,
  status: 'Alive',
  species: 'Human',
  image: `${API}/character/avatar/${id.toString()}.jpeg`,
  url: `${API}/character/${id.toString()}`,
  gender: 'Male',
  location: { name: 'Citadel of Ricks', url: `${API}/location/3` },
  episode: [`${API}/episode/1`, `${API}/episode/2`],
});

/**
 * `prev` and `next` are both non-null so the baseline captures the pagination with both
 * controls live. Pair it with a `?page=` in the middle of the range, or the screenshot
 * shows a state the app cannot actually reach.
 */
export const makeCharactersListPage = (count = 6): CharacterListPage => ({
  info: {
    count: 826,
    pages: 42,
    next: `${API}/character?page=3`,
    prev: `${API}/character?page=1`,
  },
  results: Array.from({ length: count }, (_, index) => makeCharacter(index + 1)),
});
