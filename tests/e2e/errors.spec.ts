import type { Page } from '@playwright/test';

import { test, expect, alert, retryButton } from './fixtures';

async function stubApi(page: Page) {
  await page.route(/\/api\/character/, (route) => route.abort('internetdisconnected'));
}

async function unstubApi(page: Page) {
  await page.unroute(/\/api\/character/);
}

test('the list route surfaces a network error within the budget', async ({ page, charactersPage }) => {
  await stubApi(page);
  await page.goto('/');

  // Three attempts now costs ~1.5 seconds + jitter on a network error,
  // whereas a 429 error takes 30+ seconds + jitter.
  await expect(alert(page)).toHaveCount(1, { timeout: 5000 });
  await expect(retryButton(page)).toBeVisible();

  await unstubApi(page);
  await retryButton(page).click();
  await expect(alert(page)).toHaveCount(0);
  await expect(charactersPage.list).toBeVisible();
});

test('character detail route surfaces a network error within the budget', async ({ page, characterPage }) => {
  await stubApi(page);
  await characterPage.goto(1);

  // Three attempts now costs ~1.5 seconds + jitter on a network error,
  // whereas a 429 error takes 30+ seconds + jitter.
  await expect(alert(page)).toHaveCount(1, { timeout: 5000 });
  await expect(retryButton(page)).toBeVisible();
  await expect(characterPage.facts).toHaveCount(0);

  await unstubApi(page);
  await retryButton(page).click();
  await expect(alert(page)).toHaveCount(0);
  await expect(characterPage.facts.first()).toBeVisible();
});
