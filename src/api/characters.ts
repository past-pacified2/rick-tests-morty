import * as z from 'zod';

import { FetchError } from '@/lib/errors';

/**
 * Zod compiles a faster parser with `new Function` when it can, and decides whether it
 * can by calling `new Function("")` in a try/catch. Under the Content-Security-Policy in
 * public/_headers that probe throws, Zod swallows it and falls back — but the browser
 * still reports a violation, so the deployed site logged a refusal on every page load.
 *
 * `jitless` skips the probe rather than the fallback: the parser was already the
 * interpreted one, and this only stops it asking. The pages here parse twenty
 * characters at a time, so the compiled path was never worth a CSP exception.
 */
z.config({ jitless: true });

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
export const RATE_LIMIT_ERROR_MSG = 'Rate limited by the characters API';
/** Not exported: the tests assert the literal, per the convention in retryDelay.test.ts. */
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
    if (response.status === 429) {
      throw new FetchError(RATE_LIMIT_ERROR_MSG, response.status);
    }

    throw new FetchError(systemErrorMessage, response.status);
  }

  const data: unknown = await response.json();
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

  return CharacterListPage.parse(data);
};

export const fetchCharacter = async ({ id, signal }: { id: number; signal?: AbortSignal }) => {
  const data = await apiFetch(apiUrl(`character/${id.toString()}`), CHARACTER_SYSTEM_ERROR_MSG, signal);

  return Character.parse(data);
};
