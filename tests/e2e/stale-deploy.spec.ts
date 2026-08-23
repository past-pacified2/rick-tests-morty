import { type Page, type Route } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * A deploy that lands while a tab is open.
 *
 * The tab is holding an index.html that names hashed chunks the new deployment does not
 * have, so the next lazy route asks for a file that is gone. React Router 8.3.0 drops
 * that rejection rather than routing it to `errorElement` (src/router.tsx), so nothing
 * in the application renders an error — the recovery is Vite's `vite:preloadError` and
 * src/lib/staleDeploy.ts, one layer below the router.
 *
 * Reproduced by 404ing the chunk once and serving it normally afterwards, which is the
 * shape of the real failure: the file the open tab asks for is gone, and the file the
 * fresh index.html asks for is there.
 */

const CHARACTER_CHUNK = /\/assets\/CharacterRoute-.*\.js$/;

/** 404s the detail chunk for the first request only, then stops intercepting. */
async function loseTheChunkOnce(page: Page): Promise<void> {
  const gone = async (route: Route) => {
    await page.unroute(CHARACTER_CHUNK, gone);
    await route.fulfill({ status: 404, body: '' });
  };

  await page.route(CHARACTER_CHUNK, gone);
}

test('recovers the route a deploy took the chunk out from under', async ({ page, characterPage }) => {
  await loseTheChunkOnce(page);

  await characterPage.goto(1);

  // The blank page is what this replaces, so the assertion is that content arrived at
  // all — the breadcrumb is in the route's chunk and nothing else renders it.
  await expect(characterPage.backLink).toBeVisible();
  await expect(characterPage.heading()).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/character/1');
});

test('lands on the character that was clicked, not the list it was clicked from', async ({
  page,
  charactersPage,
  characterPage,
}) => {
  await charactersPage.goto();
  await expect(charactersPage.pagination).toBeVisible();

  await loseTheChunkOnce(page);
  const firstCard = charactersPage.cardLinks.first();
  const clicked = new URL((await firstCard.getAttribute('href')) ?? '', page.url()).pathname;
  await firstCard.click();

  await expect(characterPage.backLink).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(clicked);

  // One entry for the route, not two: React Router pushed the URL it then rendered
  // nothing at, and the recovery took that entry over rather than stacking on it.
  await page.goBack();
  await expect(charactersPage.pagination).toBeVisible();
});

test('gives up rather than reloading forever when the chunk stays gone', async ({ page, characterPage }) => {
  const requests: string[] = [];
  await page.route(CHARACTER_CHUNK, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ status: 404, body: '' });
  });

  await characterPage.goto(1);

  // The load, then the one recovery.
  await expect.poll(() => requests.length).toBe(2);

  // And nothing after it: the second failure falls inside the cooldown, so a third
  // request is the loop this guards against. Asserted as a request that never comes
  // rather than as a pause, so the test states what would be wrong rather than waiting.
  await expect(page.waitForRequest(CHARACTER_CHUNK, { timeout: 3_000 })).rejects.toThrow(/Timeout/);
});
