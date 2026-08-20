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

test('the character list has no visual regressions with a name filter', async ({ page }) => {
  await page.route(/\/api\/character(\?|$)/, (route) => route.fulfill({ json: makeCharactersListPage() }));
  await page.goto('/?name=Rick');
  await expect(readyByPagination(page)).toBeVisible();
  await settleImages(page);

  await expect(page).toHaveScreenshot('character-list-name-filter.png', { fullPage: true });
});

test('the character list has no visual regression with name filters and an empty result', async ({ page }) => {
  // 404 rather than a 200 with an empty body: that is what the API answers a no-match
  // search with, and what src/api/characters.ts translates into an empty page.
  await page.route(/\/api\/character(\?|$)/, (route) =>
    route.fulfill({ status: 404, json: { error: 'There is nothing here' } }),
  );
  await page.goto('/?name=John Doe');
  await expect(page.getByRole('status')).toHaveText('No characters found for John Doe');
  await settleImages(page);

  await expect(page).toHaveScreenshot('character-list-name-filter-empty-result.png', { fullPage: true });
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

/**
 * The one image state Vitest cannot reach: jsdom renders no CSS, so the fallback being
 * a background rather than a `src` is only observable in a browser.
 */
test('a character image that fails falls back to the placeholder', async ({ page }) => {
  await page.route(/\/api\/character(\?|$)/, (route) => route.fulfill({ json: makeCharactersListPage() }));
  // Registered after the fixture's avatar stub, so this one wins.
  await page.route(/\/character\/avatar\//, (route) =>
    route.fulfill({ status: 429, contentType: 'text/html', body: 'Too Many Requests' }),
  );

  await page.goto('/?page=2');
  await expect(readyByPagination(page)).toBeVisible();
  await settleImages(page);

  const firstImage = page.getByRole('listitem').first().getByRole('presentation');
  await expect(firstImage).toHaveCSS('background-image', /placeholder\.jpeg/);
  // Blank rather than the failed URL, so Chromium paints no broken-image icon over it.
  await expect(firstImage).toHaveAttribute('src', /^data:image\/gif/);

  await expect(page).toHaveScreenshot('character-list-image-fallback.png', { fullPage: true });
});
