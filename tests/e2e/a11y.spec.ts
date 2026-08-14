import AxeBuilder from '@axe-core/playwright';
import { type Locator, type Page } from '@playwright/test';

import { expect, test } from './fixtures';

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

function readyByPagination(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Pagination' });
}

const routes = [
  { name: 'character list', path: '/', ready: readyByPagination },
  {
    name: 'character list, mid-range page',
    path: '/?page=3',
    ready: readyByPagination,
  },
  { name: 'character detail', path: '/character/42' },
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
