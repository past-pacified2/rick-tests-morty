import { test, expect, readyByPagination } from './fixtures';
import { makeCharactersListPage } from './stubs';

test('the character list has no visual regressions', async ({ page }) => {
  await page.route(/\/character(\?|$)/, (route) => route.fulfill({ json: makeCharactersListPage() }));

  await page.goto('/?page=2');
  await expect(readyByPagination(page)).toBeVisible();

  await expect(page).toHaveScreenshot('character-list.png', { fullPage: true });
});

test('the loading skeletons have no visual regressions', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(/\/character(\?|$)/, async (route) => {
    await held;
    await route.fulfill({ json: makeCharactersListPage() });
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toBeVisible();

  await expect(page).toHaveScreenshot('character-list-loading.png', { fullPage: true });

  release();
});
