import { expect, type Locator, test } from '@playwright/test';

/**
 * Post-deploy smoke. Runs against the live site, after a real deploy, and answers a
 * different question from every other suite in this repo.
 *
 * E2E asks "does the code work?" — it already passed in CI, against this exact build.
 * This asks "does the DEPLOYMENT work?": did the host get the rewrite rule, did the
 * build receive its environment, is the bundle actually being served. Every failure
 * below is invisible to the entire pyramid beneath it, because each one is a property
 * of the deployed artifact rather than of the source.
 *
 * Deliberately tiny, and deliberately free of page objects. A slow smoke suite delays
 * a rollback, and shared abstractions between this and the E2E suite would mean an
 * E2E refactor could break the thing that decides whether to roll back.
 */

test('serves the application at the root', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible();
});

/**
 * The SPA fallback. The host has no file at this path, so a missing rewrite rule
 * returns 404 here and nowhere else — the dev server and `vite preview` both fake it.
 *
 * Asserting the status code as well as the content matters: a host that serves the
 * app body with a 404 status (GitHub Pages does exactly this) would pass a
 * content-only check while telling every crawler the page does not exist.
 */
test('serves a deep link rather than a 404', async ({ page }) => {
  const response = await page.goto('/character/1');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Character 1', level: 1 })).toBeVisible();
});

/**
 * `%VITE_SITE_URL%` is substituted into index.html at build time. If the variable is
 * unset the placeholder ships verbatim, and nothing else in the pipeline can tell:
 * the markup is well-formed, the page renders, every test passes. The only symptom is
 * a canonical URL that no crawler can resolve.
 */
test('has absolute, substituted canonical and Open Graph URLs', async ({ page, baseURL }) => {
  await page.goto('/');

  const canonical = page.locator('link[rel="canonical"]');
  const tags: readonly (readonly [Locator, string])[] = [
    [canonical, 'href'],
    [page.locator('meta[property="og:url"]'), 'content'],
  ];

  for (const [locator, attribute] of tags) {
    await expect(locator).not.toHaveAttribute(attribute, /%VITE_SITE_URL%/);
    await expect(locator).toHaveAttribute(attribute, /^https?:\/\//);
  }

  await expect(canonical).toHaveAttribute('href', `${baseURL ?? ''}/`);
});
