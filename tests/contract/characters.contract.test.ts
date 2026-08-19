import { beforeAll, describe, expect, it } from 'vitest';

import { fetchCharactersListPage, FetchError, type CharacterListPage } from '@/api/characters';

async function fetchPageWithBackoff(page: number): Promise<CharacterListPage> {
  try {
    return await fetchCharactersListPage({ page });
  } catch (error) {
    if (error instanceof FetchError && error.status === 429) {
      // Flat, not the `Retry-After` the response carries: Node could read it, the app
      // cannot, and the app is what this test stands in for.
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      return fetchPageWithBackoff(page);
    }

    throw error;
  }
}

describe('characters API contract', () => {
  const PAGE_CAP = 50;

  let firstPageFetch: Promise<CharacterListPage>;
  beforeAll(() => {
    firstPageFetch = fetchPageWithBackoff(1);
  });

  it('fetches and parses characters with Zod', async () => {
    await firstPageFetch;
    // did not throw is the pass
  });

  it('returns proper pagination with upper bounds', async () => {
    const { info } = await firstPageFetch;

    expect(info.pages).toBeGreaterThan(1);
    expect(info.next).toBeTypeOf('string');

    const { info: lastPageInfo } = await fetchPageWithBackoff(info.pages);

    expect(lastPageInfo.next).toBeNull();
  });

  it('returns pagination with lower bounds', async () => {
    const { info } = await firstPageFetch;

    expect(info.prev).toBeNull();

    const { info: secondPageInfo } = await fetchPageWithBackoff(2);

    expect(secondPageInfo.prev).toBeTypeOf('string');
  });

  it('out of bounds page numbers return 404', async () => {
    const fetch = fetchPageWithBackoff(999999);

    await expect(fetch).rejects.toBeInstanceOf(FetchError);
    await expect(fetch).rejects.toHaveProperty('status', 404);
  });

  /**
   * The assumption ADR-0002 rests on: no `Access-Control-Expose-Headers`, so a browser
   * reads none of the API's own headers and `Retry-After` is unreachable from the app.
   * Node applies no CORS check, which is why this can be asserted here at all.
   */
  it('exposes no response headers to a cross-origin caller', async () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!baseUrl) throw new Error('VITE_API_BASE_URL is not set');

    const response = await fetch(new URL('character?page=1', `${baseUrl}/`));

    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-expose-headers')).toBeNull();
  });

  it(
    'each page parses (max 50) characters',
    {
      timeout: 60000,
      retry: 0,
    },
    async () => {
      const { info } = await firstPageFetch;

      const last = Math.min(info.pages, PAGE_CAP);
      for (let page = 2; page <= last; page++) {
        // did not throw is the pass
        await fetchPageWithBackoff(page);
      }
    },
  );
});
