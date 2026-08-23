import { FetchError, ParseError } from '@/lib/errors';
import { z } from '@/lib/zod';

const Character = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(['Alive', 'Dead', 'unknown']),
  species: z.string(),
  gender: z.enum(['Male', 'Female', 'Genderless', 'unknown']),
  location: z.object({
    name: z.string(),
    url: z.union([z.literal(''), z.url()]),
  }),
  episode: z.array(z.string()),
  image: z.url(),
  url: z.url(),
  origin: z.object({
    name: z.string(),
    url: z.union([z.literal(''), z.url()]),
  }),
  type: z.string(),
});

const Info = z.object({
  count: z.number(),
  pages: z.number(),
  next: z.url().nullable(),
  prev: z.url().nullable(),
});

const CharacterListPage = z.object({
  info: Info,
  results: z.array(Character),
});

export type Character = z.infer<typeof Character>;
export type CharacterListPage = z.infer<typeof CharacterListPage>;

export const LIST_SYSTEM_ERROR_MSG = 'Failed to fetch characters list page';
export const CHARACTER_SYSTEM_ERROR_MSG = 'Failed to fetch character by id';
/** Not exported: the tests assert the literals, per the convention in retryDelay.test.ts. */
const RATE_LIMIT_ERROR_MSG = 'Rate limited by the characters API';
const NETWORK_ERROR_MSG = 'Network error';

/**
 * Normalizes a base URL string by ensuring it has a trailing slash.
 * Consequently the URL in the environment variable can be written either way.
 *
 * @param baseUrl - The base URL to normalize.
 * @returns The normalized base URL.
 */
const normalizeBaseUrlString = (baseUrl: string): string => {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

/** An absolute URL for an API path, or the plain Error that says the app is misconfigured. */
function apiUrl(path: string): URL {
  if (!import.meta.env.VITE_API_BASE_URL) {
    throw new Error('API base URL is not set');
  }

  return new URL(path, normalizeBaseUrlString(import.meta.env.VITE_API_BASE_URL));
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, message: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    throw new ParseError(message, error);
  }
}

/**
 * One request, with every failure already turned into the shape the app reads.
 *
 * Returns `unknown` rather than a parsed value: the schema differs per endpoint, and a
 * helper generic over it would only be `parse` with extra steps. The caller parses.
 *
 * Deliberately no 404 handling. The list route treats a 404 as an empty result when a
 * search produced it and as a real failure otherwise, which is a fact about that
 * endpoint rather than about fetching, so it stays at the call site.
 */
async function apiFetch(url: URL, systemErrorMessage: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url.toString(), { signal: signal ?? null });
  } catch (error) {
    // An abort is the caller's own doing — React Query cancels a query whose key
    // changed — so it has to reach it unchanged rather than as a network failure.
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    // If the error is not an AbortError, it can only be a network error.
    throw new FetchError(NETWORK_ERROR_MSG, 0);
  }

  if (!response.ok) {
    // Reachable under Node, where no CORS check applies and the 429 arrives intact —
    // `tests/contract/` reads this status. In a browser the same rate limit never
    // resolves a response at all (docs/adr/0002-data-fetching-and-caching.md).
    if (response.status === 429) {
      throw new FetchError(RATE_LIMIT_ERROR_MSG, response.status);
    }

    throw new FetchError(systemErrorMessage, response.status);
  }

  let data: unknown;

  // Its own catch rather than the one above: that one sits upstream of the status
  // check, so routing a parse failure through it would flatten every !ok status to 0.
  // A body that will not finish arriving is otherwise the same failure as one that
  // never arrived at all.
  try {
    data = await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    throw new FetchError(NETWORK_ERROR_MSG, 0);
  }

  return data;
}

/**
 * What a search that matched nothing resolves to. The API answers it with a 404.
 *
 * A function rather than a shared constant: this is handed to React Query as a query's
 * data, and one object aliased across every empty search is a mutation away from being
 * everyone's problem.
 */
const emptyListPage = (): CharacterListPage => ({
  info: { count: 0, pages: 0, next: null, prev: null },
  results: [],
});

export const fetchCharactersListPage = async ({
  page,
  name,
  signal,
}: {
  page: number;
  name?: string;
  signal?: AbortSignal;
}) => {
  const url = apiUrl('character');
  url.searchParams.set('page', page.toString());

  const trimmedName = name?.trim() ?? '';

  if (trimmedName !== '') {
    url.searchParams.set('name', trimmedName);
  }

  let data: unknown;

  try {
    data = await apiFetch(url, LIST_SYSTEM_ERROR_MSG, signal);
  } catch (error) {
    // A no-match search 404s. Only a search: an out-of-range page is a real 404.
    if (trimmedName !== '' && error instanceof FetchError && error.status === 404) {
      return emptyListPage();
    }

    throw error;
  }

  return parseOrThrow(CharacterListPage, data, 'Failed to match to characters list page schema');
};

export const fetchCharacter = async ({ id, signal }: { id: number; signal?: AbortSignal }) => {
  const data = await apiFetch(apiUrl(`character/${id.toString()}`), CHARACTER_SYSTEM_ERROR_MSG, signal);

  return parseOrThrow(Character, data, 'Failed to match to character schema');
};
