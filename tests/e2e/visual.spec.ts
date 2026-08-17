import { test, expect, readyByPagination, settleImages } from './fixtures';
import { makeCharactersListPage, makeCharacter } from './stubs';

test('the character list has no visual regressions', async ({ page }) => {
  await page.route(/\/api\/character(\?|$)/, (route) => route.fulfill({ json: makeCharactersListPage() }));

  await page.goto('/?page=2');
  await expect(readyByPagination(page)).toBeVisible();
  await settleImages(page);

  await expect(page).toHaveScreenshot('character-list.png', { fullPage: true });
});

test('the list loading skeletons have no visual regressions', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(/\/api\/character(\?|$)/, async (route) => {
    await held;
    await route.fulfill({ json: makeCharactersListPage() });
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toBeVisible();
  await settleImages(page);

  await expect(page).toHaveScreenshot('character-list-loading.png', { fullPage: true });

  release();
});

test('the character details have no visual regressions', async ({ page }) => {
  await page.route(/\/api\/character\/\d+$/, (route) =>
    route.fulfill({ json: makeCharacter(3, { type: 'Parasite' }) }),
  );

  await page.goto('/character/3');
  await expect(page.getByRole('term').first()).toBeVisible();
  await settleImages(page);

  await expect(page).toHaveScreenshot('character-details.png', { fullPage: true });
});

test('the character details loading skeletons have no visual regressions', async ({ page }) => {
  await page.route(/\/api\/character\/\d+$/, async (route) => {
    // route is lazy loaded chunk and hang would stop it mounting
    // delaying the response renders the skeleton reliably
    // 30 seconds is long enough for the render to finish and once
    // test is finished the whole page is torn down
    await new Promise((r) => setTimeout(r, 30_000));
    await route.fulfill({ json: makeCharacter(3) });
  });

  await page.goto('/character/3');
  await expect(page.getByRole('status')).toBeVisible();
  await settleImages(page);

  await expect(page).toHaveScreenshot('character-details-loading.png', { fullPage: true });
});
