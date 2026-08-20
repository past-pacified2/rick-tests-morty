import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type CharacterListPage, LIST_SYSTEM_ERROR_MSG, RATE_LIMIT_ERROR_MSG } from '@/api/characters';
import { REQUEST_FAILED, NOT_FOUND, NETWORK_ERROR, copyForStatus } from '@/lib/errors';
import { SITE_NAME } from '@/lib/seo';
import { CHARACTERS_URL, PAGE_SIZE, TOTAL_PAGES, makeCharacterForId, makeCharactersListPage } from '@/test/handlers';
import { canonicalHref, metaContent } from '@/test/head';
import { renderAt } from '@/test/render';
import { server } from '@/test/server';

/**
 * A filtered page whose characters are named after the term, so an assertion can tell a
 * filtered response from a default one.
 */
function makeNameFilteredPage(name: string, page: number, pages: number): CharacterListPage {
  const query = `name=${name}`;

  return {
    info: {
      count: pages * PAGE_SIZE,
      pages,
      next: page < pages ? `${CHARACTERS_URL}?page=${(page + 1).toString()}&${query}` : null,
      prev: page > 1 ? `${CHARACTERS_URL}?page=${(page - 1).toString()}&${query}` : null,
    },
    results: makeCharactersListPage(page).results.map((character) => ({
      ...character,
      name: `${name} ${character.id.toString()}`,
    })),
  };
}

/**
 * Serves the pages above for a request carrying `name`, and falls through to the default
 * handler for one that does not — so a test whose term never reaches the API fails on the
 * character it expected rather than passing on a default page.
 */
function serveNameFilter(pages: number) {
  server.use(
    http.get(CHARACTERS_URL, ({ request }) => {
      const url = new URL(request.url);
      const name = url.searchParams.get('name');

      if (name === null) return undefined;

      const page = Number(url.searchParams.get('page') ?? '1');

      if (page > pages) {
        return HttpResponse.json({ error: 'There is nothing here' }, { status: 404 });
      }

      return HttpResponse.json(makeNameFilteredPage(name, page, pages));
    }),
  );
}

/**
 * A single page of `count` characters — more than the default handler's two, so the
 * boundary between the eagerly loaded first row and the rest of the grid is visible.
 */
function serveOnePageOf(count: number) {
  server.use(
    http.get(CHARACTERS_URL, () =>
      HttpResponse.json({
        info: { count, pages: 1, next: null, prev: null },
        results: Array.from({ length: count }, (_, index) => makeCharacterForId(index + 1)),
      } satisfies CharacterListPage),
    ),
  );
}

describe('the characters route', () => {
  it('renders the characters list', async () => {
    renderAt('/');

    const charactersResponse = makeCharactersListPage(1);

    for (const character of charactersResponse.results) {
      expect(await screen.findByText(character.name)).toBeInTheDocument();
    }
  });

  describe('page metadata', () => {
    /** Pinned so the assertions can be absolute. */
    beforeEach(() => {
      vi.stubEnv('VITE_SITE_URL', 'https://example.test');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('titles the first page with the site name alone and canonicalises without a query', async () => {
      renderAt('/');

      expect(await screen.findByText(makeCharactersListPage(1).results[0]?.name ?? '')).toBeInTheDocument();

      expect(document.title).toBe(SITE_NAME);
      expect(canonicalHref()).toBe('https://example.test/');
      expect(metaContent('robots')).toBe('index, follow');
    });

    it('gives a later page its own title and canonical URL', async () => {
      renderAt('/?page=2');

      expect(await screen.findByText(makeCharactersListPage(2).results[0]?.name ?? '')).toBeInTheDocument();

      expect(document.title).toBe(`Characters — page 2 · ${SITE_NAME}`);
      expect(canonicalHref()).toBe('https://example.test/?page=2');
    });

    it('keeps a search out of the index and points it at the unfiltered list', async () => {
      serveNameFilter(1);
      renderAt('/?name=Rick&page=1');

      expect(await screen.findByText('Rick 1')).toBeInTheDocument();

      expect(document.title).toBe(`Search: Rick · ${SITE_NAME}`);
      expect(canonicalHref()).toBe('https://example.test/');
      expect(metaContent('robots')).toBe('noindex, follow');
    });
  });

  it('loads only the first row of portraits eagerly', async () => {
    serveOnePageOf(6);
    renderAt('/');

    // Scoped to the grid: the header logo is a presentation image too, and it is on
    // screen before the first card is.
    const list = await screen.findByRole('list', { name: 'Characters' });
    const portraits = within(list).getAllByRole('presentation');

    expect(portraits.map((portrait) => portrait.getAttribute('loading'))).toEqual([
      'eager',
      'eager',
      'eager',
      'eager',
      'lazy',
      'lazy',
    ]);
  });

  const errorCases = [
    { status: 500, error: LIST_SYSTEM_ERROR_MSG },
    { status: 429, error: RATE_LIMIT_ERROR_MSG },
  ];

  it.each(errorCases)(`error copy renders, not exposes $status errors`, async ({ status, error }) => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error }, { status });
      }),
    );

    renderAt('/');

    expect(await screen.findByText(copyForStatus(status).title)).toBeInTheDocument();
    expect(screen.queryByText(error)).not.toBeInTheDocument();
  });

  it('show retry button on recoverable errors', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: LIST_SYSTEM_ERROR_MSG }, { status: 500 });
      }),
    );

    renderAt('/');

    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows the network error copy and a retry button when the request never reaches the API', async () => {
    server.use(http.get(CHARACTERS_URL, () => HttpResponse.error()));

    renderAt('/');

    expect(await screen.findByText(NETWORK_ERROR.title)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('do not show retry button on non-recoverable errors', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    renderAt('/');
    expect(await screen.findByText(NOT_FOUND.title)).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('retry button click triggers a refetch', async () => {
    let fetchCount = 0;
    server.use(
      http.get(CHARACTERS_URL, () => {
        fetchCount++;
        return HttpResponse.json({ error: LIST_SYSTEM_ERROR_MSG }, { status: 500 });
      }),
    );

    const { user } = renderAt('/');
    expect(await screen.findByText(REQUEST_FAILED.title)).toBeInTheDocument();

    server.resetHandlers();
    const charactersResponse = makeCharactersListPage(1);
    server.use(
      http.get(CHARACTERS_URL, () => {
        fetchCount++;
        return undefined;
      }),
    );

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    expect(await screen.findByText(charactersResponse.results[0]!.name)).toBeInTheDocument();
    expect(fetchCount).toBe(2);
  });

  it('deep-links to the page in the URL', async () => {
    const expectedList = makeCharactersListPage(3).results;

    renderAt('/?page=3');

    for (const character of expectedList) {
      expect(await screen.findByText(character.name)).toBeInTheDocument();
    }

    expect(screen.queryByText(makeCharactersListPage(1).results[0]!.name)).not.toBeInTheDocument();
  });

  it('name query change drops the page param', async () => {
    const { user, router } = renderAt('/?page=3');

    await user.type(await screen.findByRole('searchbox', { name: /search characters by name/i }), 'Rick');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?name=Rick');
    });
  });

  it('a search shows the first page of the filtered set', async () => {
    serveNameFilter(2);

    const { user } = renderAt('/?page=3');

    const unfilteredName = makeCharactersListPage(3).results[0]!.name;
    expect(await screen.findByText(unfilteredName)).toBeInTheDocument();

    await user.type(await screen.findByRole('searchbox', { name: /search characters by name/i }), 'Rick');

    // Page one of the filtered set, not page three of it: the input drops the page param.
    expect(await screen.findByText('Rick 1')).toBeInTheDocument();
    expect(screen.queryByText(unfilteredName)).toBeNull();
  });

  it('pagination inside a search keeps the term', async () => {
    serveNameFilter(2);

    const { user, router } = renderAt('/?name=Rick');

    const pagination = await screen.findByRole('navigation', { name: 'Pagination' });
    await user.click(within(pagination).getByRole('link', { name: 'Next' }));

    expect(await screen.findByText('Rick 3')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?name=Rick&page=2');
  });

  it('a new term refetches on the same page', async () => {
    serveNameFilter(2);

    const { user } = renderAt('/?name=Rick');

    expect(await screen.findByText('Rick 1')).toBeInTheDocument();

    const searchbox = await screen.findByRole('searchbox', { name: /search characters by name/i });
    await user.clear(searchbox);
    await user.type(searchbox, 'Morty');

    // Both terms are page one, so only the term distinguishes the two cache entries.
    expect(await screen.findByText('Morty 1')).toBeInTheDocument();
  });

  it('an empty name search renders the empty state', async () => {
    // The API answers a no-match search with 404, and src/api/characters.ts translates it.
    server.use(http.get(CHARACTERS_URL, () => HttpResponse.json({ error: 'There is nothing here' }, { status: 404 })));

    renderAt('/?name=zzz');

    expect(await screen.findByText('No characters found for \u201Czzz\u201D')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Characters' })).toBeNull();
  });

  it('pagination clicktrough works', async () => {
    const charactersResponse = makeCharactersListPage(2);
    const nextPageCharactersResponse = makeCharactersListPage(3);

    const { user, router } = renderAt('/?page=2');

    expect(await screen.findByText(charactersResponse.results[0]!.name)).toBeInTheDocument();

    const pagination = await screen.findByRole('navigation', { name: 'Pagination' });

    await user.click(within(pagination).getByRole('link', { name: 'Next' }));

    expect(await screen.findByText(nextPageCharactersResponse.results[0]!.name)).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=3');
  });

  it('pagination bounds come from the payload', async () => {
    renderAt(`/?page=${TOTAL_PAGES.toString()}`);

    const paginaton = await screen.findByRole('navigation', { name: 'Pagination' });

    expect(within(paginaton).getByRole('link', { name: 'Previous' })).toBeInTheDocument();
    expect(within(paginaton).queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
    expect(within(paginaton).getByText('Next')).toBeInTheDocument();
  });

  it.each(errorCases)('no pagination when there is no data on error $status', async ({ status, error }) => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error }, { status });
      }),
    );

    renderAt('/');

    expect(await screen.findByText(copyForStatus(status).title)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('click on a numbered link navigates to the page', async () => {
    const fifthPageCharacters = makeCharactersListPage(5).results;
    const { user, router } = renderAt('/?page=1');

    await user.click(
      within(await screen.findByRole('navigation', { name: 'Pagination' })).getByRole('link', { name: '5' }),
    );

    expect(router.state.location.search).toBe('?page=5');
    expect(await screen.findByText(fifthPageCharacters[0]!.name)).toBeInTheDocument();
  });

  it('loading state is announced to screen readers, no characters rendered', async () => {
    const firstPageCharacters = makeCharactersListPage(1);
    server.use(
      http.get(CHARACTERS_URL, async () => {
        await delay(2000);
        return HttpResponse.json(firstPageCharacters);
      }),
    );

    renderAt('/');

    expect(within(await screen.findByRole('status')).getByText('Loading characters…')).toBeInTheDocument();
    expect(screen.queryByText(firstPageCharacters.results[0]!.name)).toBeNull();
  });

  it('found characters state announces the number of characters found', async () => {
    const charactersResponse = makeCharactersListPage(1, { info: { count: 60, pages: 20, next: null, prev: null } });
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json(charactersResponse);
      }),
    );

    renderAt('/');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('60 characters found');
    });
    expect(screen.getByText(charactersResponse.results[0]!.name)).toBeInTheDocument();
  });

  it('opens a hovered card without fetching it again', async () => {
    const requested: string[] = [];
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, ({ params }) => {
        requested.push(String(params.id));

        return HttpResponse.json(makeCharacterForId(Number(params.id)));
      }),
    );

    const { user } = renderAt('/');
    const card = await screen.findByRole('link', { name: /Character 1/ });

    await user.hover(card);
    await waitFor(() => {
      expect(requested).toEqual(['1']);
    });

    await user.click(card);
    expect(await screen.findByRole('heading', { level: 1, name: 'Character 1' })).toBeInTheDocument();

    // The detail route found the entry the hover wrote; a second id here would mean it
    // did not.
    expect(requested).toEqual(['1']);
  });

  it('query with no matches announces the empty state', async () => {
    server.use(
      http.get(CHARACTERS_URL, () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      }),
    );

    renderAt('/?name=nonexistent-name');

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('No characters found for nonexistent-name');
    });
  });
});
