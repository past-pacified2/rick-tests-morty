import * as z from 'zod';

const Character = z.object({
  id: z.number(),
  name: z.string(),
  status: z.enum(['Alive', 'Dead', 'unknown']),
  species: z.string(),
  gender: z.enum(['Male', 'Female', 'unknown']),
  location: z.object({
    name: z.string(),
    url: z.string(),
  }),
  episode: z.array(z.string()),
  image: z.string(),
  url: z.string(),
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

export const SYSTEM_ERROR_MSG = 'Failed to fetch characters list page';

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

export const fetchCharactersListPage = async ({ page, signal }: { page: number; signal?: AbortSignal }) => {
  if (!import.meta.env.VITE_API_BASE_URL) {
    throw new Error('API base URL is not set');
  }

  const baseUrl = normalizeBaseUrlString(import.meta.env.VITE_API_BASE_URL);

  const url = new URL('character', baseUrl);
  url.searchParams.set('page', page.toString());

  const response = await fetch(url.toString(), { signal: signal ?? null });

  if (!response.ok) {
    throw new FetchError(SYSTEM_ERROR_MSG, response.status);
  }

  const data: unknown = await response.json();

  const parsedData = CharacterListPage.parse(data);
  return parsedData;
};
