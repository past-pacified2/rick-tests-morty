import AxeBuilder from '@axe-core/playwright';
import { type Page } from '@playwright/test';

import { expect, readyByPagination, test } from './fixtures';

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
    ready: (page: Page) => page.getByText(/No characters found for \u201C/),
  },
  { name: 'character detail', path: '/character/42' },
  { name: 'data protection', path: '/privacy' },
  { name: 'legal notice', path: '/impressum' },
  { name: 'not found', path: '/no-such-page' },
  { name: 'fatal error', path: '/500' },
];

for (const route of routes) {
  const ready = route.ready ?? ((page: Page) => page.getByRole('heading', { level: 1 }));

  test(`the ${route.name} route has no automatically detectable violations`, async ({ page }) => {
    await page.goto(route.path);
    // The lazy chunk has to be on screen before the scan; axe on an empty root passes
    // for the least useful of reasons.
    await expect(ready(page)).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
  });
}
