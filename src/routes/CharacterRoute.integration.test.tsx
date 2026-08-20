import { screen, within } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';

import { CHARACTER_SYSTEM_ERROR_MSG } from '@/api/characters';
import { REQUEST_FAILED, NOT_FOUND } from '@/lib/errors';
import { SITE_NAME } from '@/lib/seo';
import { CHARACTERS_URL, TOTAL_PAGES, PAGE_SIZE, makeCharacterForId } from '@/test/handlers';
import { canonicalHref, metaContent } from '@/test/head';
import { renderAt } from '@/test/render';
import { server } from '@/test/server';

describe('the character route', () => {
  it('renders the character details loading skeleton', async () => {
    const characterId = 3;
    const characterResponse = makeCharacterForId(characterId);
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, async () => {
        await delay('infinite');
        return HttpResponse.json(characterResponse);
      }),
    );

    renderAt(`/character/${characterId.toString()}`);

    expect(within(await screen.findByRole('status')).getByText('Loading character…')).toBeInTheDocument();
    expect(within(await screen.findByRole('status')).queryAllByRole('term')).toHaveLength(0);
    expect(screen.queryByText(characterResponse.name)).toBeNull();
  });

  it('renders the fetched characters details', async () => {
    const characterResponse = makeCharacterForId(3);

    renderAt(`/character/${characterResponse.id.toString()}`);

    expect(await screen.findByRole('heading', { name: characterResponse.name })).toBeInTheDocument();
  });

  describe('page metadata', () => {
    /** Pinned so the assertions can be absolute. */
    beforeEach(() => {
      vi.stubEnv('VITE_SITE_URL', 'https://example.test');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('titles the page after the character and canonicalises to its own URL', async () => {
      const characterResponse = makeCharacterForId(3);

      renderAt(`/character/${characterResponse.id.toString()}`);

      expect(await screen.findByRole('heading', { name: characterResponse.name })).toBeInTheDocument();

      expect(document.title).toBe(`${characterResponse.name} · ${SITE_NAME}`);
      expect(canonicalHref()).toBe('https://example.test/character/3');
      expect(metaContent('description')).toContain(characterResponse.species);
      expect(metaContent('robots')).toBe('index, follow');
    });

    it('keeps a character that does not exist out of the index', async () => {
      const outOfRangeId = TOTAL_PAGES * PAGE_SIZE + 1;

      renderAt(`/character/${outOfRangeId.toString()}`);

      expect(await screen.findByText(NOT_FOUND.title)).toBeInTheDocument();

      expect(metaContent('robots')).toBe('noindex, follow');
    });
  });

  it('renders 404 message for id not found', async () => {
    const outOfRangeId = TOTAL_PAGES * PAGE_SIZE + 1;

    renderAt(`/character/${outOfRangeId.toString()}`);

    expect(await screen.findByRole('heading', { name: NOT_FOUND.title })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('link', { name: /back to characters/i })).toHaveAttribute('href', '/');
  });

  it('renders 404 message for invalid id without sending request', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        requestCount++;
        return undefined;
      }),
    );

    renderAt('/character/invalid');

    expect(await screen.findByRole('heading', { name: NOT_FOUND.title })).toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('offers a retry button for failed request, and refetching recovers', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        requestCount++;
        return HttpResponse.json({ error: CHARACTER_SYSTEM_ERROR_MSG }, { status: 500 });
      }),
    );

    const { user } = renderAt('/character/1');
    expect(await screen.findByRole('heading', { name: REQUEST_FAILED.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to characters/i })).toHaveAttribute('href', '/');

    const characterResponse = makeCharacterForId(1);
    server.resetHandlers();
    server.use(
      http.get(`${CHARACTERS_URL}/:id`, () => {
        requestCount++;
        return undefined;
      }),
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: characterResponse.name })).toBeInTheDocument();
    expect(requestCount).toBe(2);
  });

  describe('the back link', () => {
    beforeEach(() => {
      window.history.replaceState(null, '');
    });

    it('returns to the list page the user came from', async () => {
      const { user, router } = renderAt('/?page=3');

      await user.click(await screen.findByRole('link', { name: /character 5/i }));

      // renderAt builds a createMemoryRouter which keeps its stack in memory
      // and never writes to window.history so canGoBack() has nothing to read
      window.history.replaceState({ idx: 1 }, '');

      await user.click(await screen.findByRole('link', { name: /back to characters/i }));

      expect(router.state.location.search).toBe('?page=3');
    });

    it('follows the href when the history cannot go back', async () => {
      const { user, router } = renderAt('/character/5');

      // renderAt builds a createMemoryRouter which keeps its stack in memory
      // and never writes to window.history so canGoBack() has nothing to read
      window.history.replaceState({ idx: 0 }, '');

      await user.click(await screen.findByRole('link', { name: /back to characters/i }));

      expect(router.state.location.pathname).toBe('/');
    });

    const META_KEYS = ['Control', 'Meta', 'Alt', 'Shift'];

    it.each(META_KEYS)('ignores a %s-clicked link', async (metaKey) => {
      const { user, router } = renderAt('/?page=3');

      await user.click(await screen.findByRole('link', { name: /character 5/i }));

      // renderAt builds a createMemoryRouter which keeps its stack in memory
      // and never writes to window.history so canGoBack() has nothing to read
      window.history.replaceState({ idx: 1 }, '');

      await user.keyboard(`{${metaKey}>}`);
      await user.click(await screen.findByRole('link', { name: /back to characters/i }));
      await user.keyboard(`{/${metaKey}}`);

      expect(router.state.location.pathname).toBe('/character/5');
    });
  });
});
