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
 * The build received its API base URL. Vite inlines VITE_API_BASE_URL at compile time,
 * so an unset variable becomes the literal `void 0` in the bundle and every fetch
 * throws before it reaches the network — the same failure mode as the canonical tag
 * below, and just as invisible to everything upstream. The heading in the test above
 * renders either way, so it cannot see this; nor can CI, which builds its own artifact
 * from its own environment rather than the one the deploy job used.
 *
 * Asserts that *something* arrived, never how much or which. A count would be a claim
 * about the API's page size and a name would be a claim about its contents; both belong
 * to the contract tests, which assert shape against the live API on a schedule.
 *
 * This is the only test in the file that depends on a third party, so it is also the
 * only one that can go red without anything being wrong with the deployment. That is
 * accepted deliberately: the site is already live by the time this runs, so a failure
 * here is information rather than an outage, and a deployment that cannot reach its API
 * is worth hearing about even when the cause is someone else's.
 *
 * It cannot catch a base URL that is valid but wrong — pointed at a staging API, say.
 * Items would still render. That is a different question and it is not asked here.
 *
 * `await expect(locator)` rather than `expect(await locator.count())`: the latter
 * samples the DOM once, the instant `goto` resolves and before the query has returned,
 * so it reads zero every time. It failed five runs out of five against the live site
 * that this suite had just watched render twenty names.
 */
test('renders characters, so the deployed bundle reached the API', async ({ page }) => {
  // A 429 is answered by a retry at ~10s and another at ~20s
  // (docs/adr/0002-data-fetching-and-caching.md). The timeout is a ceiling, not a wait:
  // a healthy deploy still passes in under a second, and a rate-limited one no longer
  // reads as a bundle that never reached the API.
  test.setTimeout(60_000);

  await page.goto('/');

  await expect(page.getByRole('listitem').first()).toBeVisible({ timeout: 40_000 });
});

/**
 * The SPA fallback. The host has no file at this path, so a missing rewrite rule
 * returns 404 here and nowhere else — the dev server and `vite preview` both fake it.
 *
 * Asserting the status code as well as the content matters: a host that serves the
 * app body with a 404 status (GitHub Pages does exactly this) would pass a
 * content-only check while telling every crawler the page does not exist.
 *
 * Asserts a landmark the character route renders in every state — loading, loaded and
 * errored — rather than the character's name. The name belongs to the API, and this
 * test is not asking whether the API answered: the landmark is there even if the
 * character fetch fails.
 *
 */
test('serves a deep link rather than a 404', async ({ page }) => {
  const response = await page.goto('/character/1');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
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

/**
 * `public/_headers` is a Cloudflare Pages file. Nothing below this suite can see it —
 * `vite preview` serves `dist/` and ignores it — so "the policy is correct" and "the
 * policy arrived" are two different questions and this is the only place to ask the
 * second. tests/e2e/csp.spec.ts asks the first.
 *
 * Asserted by directive rather than by string equality: the header is one long line,
 * and a full-string comparison fails on a reordering that changes nothing.
 */
test('serves the security headers public/_headers declares', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};

  const policy = headers['content-security-policy'] ?? '';
  for (const directive of [
    "default-src 'self'",
    'connect-src',
    'img-src',
    "object-src 'none'",
    "frame-ancestors 'none'",
  ]) {
    expect(policy).toContain(directive);
  }

  // The two escape hatches that would quietly undo most of the policy.
  expect(policy).not.toContain('unsafe-inline');
  expect(policy).not.toContain('unsafe-eval');

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['strict-transport-security']).toContain('max-age=');
});
