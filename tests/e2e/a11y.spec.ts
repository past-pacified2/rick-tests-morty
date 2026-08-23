import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';

import { CACHED_API, alert, expect, readyByPagination, test } from './fixtures';

/**
 * Automated accessibility scan of every route.
 *
 * Worth being honest about the ceiling: axe catches roughly a third of WCAG issues.
 * It finds missing labels, contrast failures, bad ARIA and broken heading order. It
 * cannot tell you whether a focus order makes sense, whether an error message is
 * understandable, or whether a custom control behaves the way a screen-reader user
 * expects. Those need a person. This suite exists so a person's time is spent on the
 * part a machine cannot do — see ADR-0003.
 *
 * The keyboard behaviour that *is* mechanically checkable lives in navigation.spec.ts.
 */

/**
 * Longer than the scan takes, so the skeleton is still on screen when axe runs. The
 * request is abandoned when the context closes, which is why the abort may fail.
 */
const STALL_MS = 20_000;

/** Holds the API open, which is the only way to hold a route in its loading state. */
async function stallApi(page: Page): Promise<void> {
  await page.route(CACHED_API, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, STALL_MS));
    await route.abort().catch(() => undefined);
  });
}

/** Fails every attempt, the query client's two retries included, so the panel is final. */
async function failApi(page: Page): Promise<void> {
  await page.route(CACHED_API, (route) => route.abort());
}

/**
 * Every route in each state it can be scanned in.
 *
 * The loading and failed rows are here because they are where the bespoke ARIA is: a
 * `role="status"` wrapping an `aria-hidden` grid of twenty, and a panel whose heading
 * level is decided by a prop. Both routes carry both, and differently — the detail
 * route's skeleton owns the page's only `h1` while the list route's does not — so each
 * pair is scanned rather than one standing in for the other.
 */
const routes = [
  { name: 'character list', path: '/', ready: readyByPagination },
  {
    name: 'character list, mid-range page',
    path: '/?page=3',
    ready: readyByPagination,
  },
  {
    // A distinct DOM: no list, no pagination, a message the other list routes never render.
    name: 'character list, no matches',
    path: '/?name=zzzzqqq-not-a-character',
    // The curly quote picks the visible line; the live region carries the same words unquoted.
    ready: (page: Page) => page.getByText(/No characters found for “/),
  },
  {
    name: 'character list, loading',
    path: '/',
    setup: stallApi,
    ready: (page: Page) => page.getByText('Loading characters…'),
  },
  {
    name: 'character list, failed request',
    path: '/',
    setup: failApi,
    ready: alert,
  },
  { name: 'character detail', path: '/character/42' },
  {
    name: 'character detail, loading',
    path: '/character/42',
    setup: stallApi,
    ready: (page: Page) => page.getByRole('heading', { name: 'Loading character…', level: 1 }),
  },
  {
    name: 'character detail, failed request',
    path: '/character/42',
    setup: failApi,
    ready: alert,
  },
  { name: 'data protection', path: '/privacy' },
  { name: 'legal notice', path: '/impressum' },
  { name: 'not found', path: '/no-such-page' },
  { name: 'fatal error', path: '/500' },
];

for (const route of routes) {
  const ready = route.ready ?? ((page: Page) => page.getByRole('heading', { level: 1 }));

  test(`the ${route.name} route has no automatically detectable violations`, async ({ page }) => {
    await route.setup?.(page);
    await page.goto(route.path);
    // The lazy chunk has to be on screen before the scan; axe on an empty root passes
    // for the least useful of reasons.
    await expect(ready(page)).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
  });
}
