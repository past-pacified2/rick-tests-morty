import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { SYSTEM_ERROR_MSG, RATE_LIMIT_ERROR_MSG } from '@/api/characters';
import { REQUEST_FAILED, NOT_FOUND, copyForStatus } from '@/lib/errors';
import { CHARACTERS_URL, TOTAL_PAGES, makeCharactersListPage } from '@/test/handlers';
import { renderAt } from '@/test/render';
import { server } from '@/test/server';

describe('the characters route', () => {
  it('renders the characters list', async () => {
    renderAt('/');

    const charactersResponse = makeCharactersListPage(1);

    for (const character of charactersResponse.results) {
      expect(await screen.findByText(character.name)).toBeInTheDocument();
    }
  });

  const errorCases = [
    { status: 500, error: SYSTEM_ERROR_MSG },
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
        return HttpResponse.json({ error: SYSTEM_ERROR_MSG }, { status: 500 });
      }),
    );

    renderAt('/');

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
        return HttpResponse.json({ error: SYSTEM_ERROR_MSG }, { status: 500 });
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
});
