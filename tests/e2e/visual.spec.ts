import { test, expect, readyByPagination } from './fixtures';
import { makeCharactersListPage } from './stubs';

test('the character list has no visual regressions', async ({ page }) => {
  await page.route(/\/character(\?|$)/, (route) => route.fulfill({ json: makeCharactersListPage() }));

  await page.goto('/?page=2');
  await expect(readyByPagination(page)).toBeVisible();

  await expect(page).toHaveScreenshot('character-list.png', { fullPage: true });
});
