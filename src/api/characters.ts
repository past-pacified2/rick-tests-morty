import * as z from 'zod';

const Character = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(['Alive', 'Dead', 'unknown']),
  species: z.string(),
  gender: z.enum(['Male', 'Female', 'Genderless', 'unknown']),
  location: z.object({
    name: z.string(),
    url: z.string(),
  }),
  episode: z.array(z.string()),
  image: z.string(),
  url: z.string(),
  origin: z.object({
    name: z.string(),
    url: z.string(),
  }),
  type: z.string(),
});

const Info = z.object({
  count: z.number(),
  pages: z.number(),
  next: z.string().nullable(),
  prev: z.string().nullable(),
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

export class FetchError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

export const fetchCharactersListPage = async ({
  page,
  name,
  signal,
}: {
  page: number;
  name?: string;
  signal?: AbortSignal;
}) => {
  if (!import.meta.env.VITE_API_BASE_URL) {
    throw new Error('API base URL is not set');
  }

  const baseUrl = normalizeBaseUrlString(import.meta.env.VITE_API_BASE_URL);

  const url = new URL('character', baseUrl);
  url.searchParams.set('page', page.toString());

  const trimmedName = name?.trim() ?? '';

  if (trimmedName !== '') {
    url.searchParams.set('name', trimmedName);
  }

  const response = await fetch(url.toString(), { signal: signal ?? null });

  if (!response.ok) {
    if (response.status === 429) {
      throw new FetchError(RATE_LIMIT_ERROR_MSG, response.status);
    }

    if (response.status === 404 && trimmedName !== '') {
      // A no-match search 404s. Only a search: an out-of-range page is a real 404.
      return {
        info: {
          count: 0,
          pages: 0,
          next: null,
          prev: null,
        },
        results: [],
      };
    }

    throw new FetchError(LIST_SYSTEM_ERROR_MSG, response.status);
  }

  const data: unknown = await response.json();

  const parsedData = CharacterListPage.parse(data);
  return parsedData;
};

export const fetchCharacter = async ({ id, signal }: { id: number; signal?: AbortSignal }) => {
  if (!import.meta.env.VITE_API_BASE_URL) {
    throw new Error('API base URL is not set');
  }

  const baseUrl = normalizeBaseUrlString(import.meta.env.VITE_API_BASE_URL);
  const url = new URL(`character/${id.toString()}`, baseUrl);
  const response = await fetch(url.toString(), { signal: signal ?? null });

  if (!response.ok) {
    if (response.status === 429) {
      throw new FetchError(RATE_LIMIT_ERROR_MSG, response.status);
    }

    throw new FetchError(CHARACTER_SYSTEM_ERROR_MSG, response.status);
  }

  const data: unknown = await response.json();
  const parsedData = Character.parse(data);
  return parsedData;
};
