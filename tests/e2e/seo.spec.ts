import type { Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { makeCharacter, makeCharactersListPage, STUB_TOTAL_PAGES } from './stubs';

/**
 * The head tags every route renders through src/components/Seo.tsx.
 *
 * A real browser rather than jsdom: what ships is React's output merged into the
 * document index.html served, and duplicate tags are the failure mode.
 *
 * Only the path of each canonical URL is asserted. Its origin is a property of the
 * deployment, checked in tests/smoke/deployment.spec.ts.
 *
 * Stubbed like the visual suite, since the character page is titled after its character.
 */

const SITE_NAME = 'Rick & Morty Character Explorer';

async function stubApi(page: Page) {
  await page.route(/\/api\/character\/\d+$/, (route) =>
    route.fulfill({ json: makeCharacter(1, { name: 'Rick Sanchez' }) }),
  );
  await page.route(/\/api\/character(\?|$)/, (route) => {
    const requested = Number(new URL(route.request().url()).searchParams.get('page') ?? '1');
    return requested > STUB_TOTAL_PAGES
      ? route.fulfill({ status: 404, json: { error: 'There is nothing here' } })
      : route.fulfill({ json: makeCharactersListPage() });
  });
}

const canonical = (page: Page) => page.locator('link[rel="canonical"]');
const robots = (page: Page) => page.locator('meta[name="robots"]');

const cases = [
  { name: 'the list', path: '/', title: SITE_NAME, canonicalPath: '/', indexed: true },
  {
    name: 'a later list page',
    path: '/?page=2',
    title: `Characters — page 2 · ${SITE_NAME}`,
    canonicalPath: '/?page=2',
    indexed: true,
  },
  {
    // A search is one visitor's query, and it canonicalises to the unfiltered list.
    name: 'a search',
    path: '/?name=Rick',
    title: `Search: Rick · ${SITE_NAME}`,
    canonicalPath: '/',
    indexed: false,
  },
  {
    name: 'a character',
    path: '/character/1',
    title: `Rick Sanchez · ${SITE_NAME}`,
    canonicalPath: '/character/1',
    indexed: true,
  },
  {
    name: 'the legal notice',
    path: '/impressum',
    title: `Legal notice · ${SITE_NAME}`,
    canonicalPath: '/impressum',
    indexed: true,
  },
  {
    name: 'the privacy page',
    path: '/privacy',
    title: `Data protection · ${SITE_NAME}`,
    canonicalPath: '/privacy',
    indexed: true,
  },
  {
    // The URL that missed is the one the crawler asked for, so this one points home.
    name: 'an unknown URL',
    path: '/no-such-page',
    title: `Not found · ${SITE_NAME}`,
    canonicalPath: '/',
    indexed: false,
  },
  {
    // An out-of-range page renders the not-found copy, so it claims nothing of its own.
    name: 'a list page past the end',
    path: '/?page=999999',
    title: `Not found · ${SITE_NAME}`,
    canonicalPath: '/',
    indexed: false,
  },
];

for (const { name, path, title, canonicalPath, indexed } of cases) {
  test(`${name} carries its own title, canonical URL and robots directive`, async ({ page, baseURL }) => {
    await stubApi(page);
    await page.goto(path);

    await expect(page).toHaveTitle(title);

    const href = await canonical(page).getAttribute('href');
    const resolved = new URL(href ?? '', baseURL);
    expect(resolved.pathname + resolved.search).toBe(canonicalPath);

    await expect(robots(page)).toHaveAttribute('content', indexed ? 'index, follow' : 'noindex, follow');
  });
}

test('swaps the head tags on a client-side navigation without leaving the old ones behind', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await expect(page).toHaveTitle(SITE_NAME);

  await page.getByRole('link', { name: /Character 1/ }).click();

  await expect(page).toHaveTitle(`Rick Sanchez · ${SITE_NAME}`);
  await expect(canonical(page)).toHaveAttribute('href', /\/character\/1$/);
  await expect(canonical(page)).toHaveCount(1);
  await expect(page.locator('title')).toHaveCount(1);
});

test('carries exactly one of every head tag a route renders', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');

  await expect(page).toHaveTitle(SITE_NAME);

  for (const selector of ['title', 'link[rel="canonical"]', 'meta[name="description"]', 'meta[name="robots"]']) {
    await expect(page.locator(selector)).toHaveCount(1);
  }
});
