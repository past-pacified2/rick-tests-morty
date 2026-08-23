import type { Locator } from '@playwright/test';

import { expect, test, alert, retryButton, settleImages } from './fixtures';

/**
 * End-to-end, against the production build served by `vite preview`.
 *
 * Everything here is something the Vitest integration suite structurally cannot see:
 * a real history stack, a real HTTP request for a deep link, lazy chunks fetched over
 * the network, and CSS that only takes effect on focus. Anything provable in jsdom
 * belongs in the integration suite instead, where it runs in milliseconds.
 */

test.describe('deep links', () => {
  /**
   * A hard navigation to a client-side route. The server has no file at this path, so
   * this passing means the host rewrote the request to index.html. In development the
   * dev server does that for you, which is exactly why the rule is so easy to ship
   * without — see public/_redirects and ADR-0005.
   */
  test('serves the detail route on a direct request', async ({ page, characterPage }) => {
    const response = await page.goto('/character/42');

    expect(response?.status()).toBe(200);
    await expect(characterPage.heading()).toBeVisible();
    await expect(alert(page)).toHaveCount(0);
  });

  test('serves the not-found route on a direct request to an unknown path', async ({ page, notFoundPage }) => {
    await page.goto('/no-such-page');

    await expect(notFoundPage.heading).toBeVisible();
    // The URL is preserved rather than redirected, so the address bar still shows what
    // the user asked for and a refresh reproduces it.
    expect(new URL(page.url()).pathname).toBe('/no-such-page');
  });

  /**
   * The other half of the 404 journey, and a different one from the route above: the
   * URL is well-formed and the route matches. What is missing is the character, so the
   * app has to render the failure inside a route that loaded fine.
   *
   * 999999 is a valid id no character has; the API answers it with a 404 and
   * replayApiResponses keeps that answer like any other.
   */
  test('serves the not-found copy for a character id no character has', async ({
    page,
    charactersPage,
    characterPage,
  }) => {
    await characterPage.goto(999999);

    await expect(characterPage.heading()).toHaveText('Not found');
    await expect(characterPage.facts).toHaveCount(0);
    // A 404 is a definitive answer rather than a transient failure, so nothing here
    // offers to ask again.
    await expect(retryButton(page)).toHaveCount(0);

    // The way out is the route's own breadcrumb, which is on screen whether the
    // character arrived or not.
    await characterPage.backLink.click();
    await expect(charactersPage.list).toBeVisible();
  });

  test('serves the list route on a direct request to the root path', async ({ charactersPage }) => {
    const response = await charactersPage.goto();

    expect(response?.status()).toBe(200);

    await expect(charactersPage.pagination).toBeVisible();
    await expect(charactersPage.listItems.first()).toBeVisible();
  });

  test('serves the list route on a direct request to a page number', async ({ charactersPage }) => {
    const response = await charactersPage.goto({ pageNumber: 3 });

    expect(response?.status()).toBe(200);

    await expect(charactersPage.pagination).toBeVisible();
    await expect(charactersPage.pageIndicator).toHaveText(/^3 of \d+$/);
  });
});

test.describe('client-side navigation', () => {
  /**
   * Counting document requests is the assertion that distinguishes a router from a
   * set of links. If the click triggered a full page load the app would still show the
   * right content, and a test that only checked the heading would pass.
   */
  test('navigates without a full page load', async ({ page, layout, charactersPage, characterPage }) => {
    let documentRequests = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documentRequests += 1;
    });

    await characterPage.goto(42);
    await expect(characterPage.heading()).toBeVisible();
    await expect(alert(page)).toHaveCount(0);
    expect(documentRequests).toBe(1);

    await layout.brandLink.click();

    await expect(charactersPage.heading).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
    expect(documentRequests).toBe(1);
  });

  test('restores the previous route on browser back', async ({ page, layout, charactersPage, characterPage }) => {
    await characterPage.goto(42);
    await layout.brandLink.click();
    await expect(charactersPage.heading).toBeVisible();

    await page.goBack();

    await expect(characterPage.heading()).toBeVisible();
    await expect(alert(page)).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/character/42');
  });

  test('redirects an incomplete character URL to the list', async ({ page, charactersPage }) => {
    await page.goto('/character');

    await expect(charactersPage.heading).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('paginates the list without a full page load', async ({ page, charactersPage }) => {
    let documentRequests = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documentRequests += 1;
    });

    await charactersPage.goto({ pageNumber: 1 });
    await expect(charactersPage.nextLink).toBeVisible();

    const firstOnPageOne = await charactersPage.listItems.first().textContent();

    await charactersPage.nextLink.click();

    await expect(page).toHaveURL(/\?page=2$/);
    await expect(charactersPage.listItems.first()).not.toHaveText(firstOnPageOne ?? '');
    expect(documentRequests).toBe(1);
  });

  test('pagination pushes to history', async ({ page, charactersPage }) => {
    await charactersPage.goto({ pageNumber: 1 });
    await expect(charactersPage.nextLink).toBeVisible();

    const firstOnPageOne = await charactersPage.listItems.first().textContent();

    await charactersPage.nextLink.click();

    await expect(charactersPage.listItems.first()).not.toHaveText(firstOnPageOne ?? '');

    await page.goBack();

    await expect(charactersPage.listItems.first()).toHaveText(firstOnPageOne ?? '');
    await expect(page).toHaveURL(/\?page=1$/);
  });

  test('returns to the list page the user came from', async ({ page, charactersPage, characterPage }) => {
    await charactersPage.goto({ pageNumber: 3 });

    await expect(page).toHaveURL(/\?page=3$/);

    await charactersPage.cardLinks.first().click();

    await expect(characterPage.backLink).toBeVisible();

    await characterPage.backLink.click();

    await expect(charactersPage.heading).toBeVisible();
    await expect(page).toHaveURL(/\?page=3$/);
  });
});

/**
 * Keyboard tests need a barrier that the rest of this file gets for free.
 *
 * Playwright auto-waits on locators, but `keyboard.press` is fire-and-forget: it types
 * into whatever exists at that instant. Between `goto` and hydration that is a bare
 * `<body>`, and the keystroke is swallowed with no error and no retry — the assertion
 * then fails somewhere unrelated, or worse, passes intermittently.
 *
 * So every test below waits for rendered content before sending a key, and asserts
 * each focus step rather than only the last. Auto-waiting covers locator queries; it
 * does not cover input.
 */
test.describe('keyboard access', () => {
  /**
   * The skip link is `sr-only` until focused, then `focus:not-sr-only`. Asserted by
   * bounding box rather than toBeVisible(): `sr-only` clips an element to 1×1 without
   * hiding it, so Playwright considers it visible in both states. The size change is
   * the observable difference.
   */
  test('reveals the skip link on first tab', async ({ page, layout, charactersPage }) => {
    await page.goto('/');
    await expect(charactersPage.heading).toBeVisible();

    const hidden = await layout.skipLink.boundingBox();
    expect(hidden?.width ?? 0).toBeLessThan(5);

    await page.keyboard.press('Tab');

    await expect(layout.skipLink).toBeFocused();
    const revealed = await layout.skipLink.boundingBox();
    expect(revealed?.width ?? 0).toBeGreaterThan(20);
  });

  test('moves focus into main when the skip link is activated', async ({ page, layout, charactersPage }) => {
    await page.goto('/');
    await expect(charactersPage.heading).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(layout.skipLink).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(layout.main).toBeFocused();
  });

  test('reaches the brand link by keyboard alone', async ({ page, layout, charactersPage }) => {
    await page.goto('/');
    await expect(charactersPage.heading).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(layout.skipLink).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(layout.brandLink).toBeFocused();
  });

  /**
   * Enter on a focused link must navigate. A `<div onClick>` masquerading as a link
   * passes every mouse-driven test in this file and fails this one.
   */
  test('activates the brand link with Enter', async ({ page, layout, charactersPage, characterPage }) => {
    await characterPage.goto(42);
    await expect(characterPage.heading()).toBeVisible();
    await expect(alert(page)).toHaveCount(0);

    await layout.brandLink.focus();
    await page.keyboard.press('Enter');

    await expect(charactersPage.heading).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

/**
 * What a route change does beyond swapping the content. Neither is provable below this
 * layer: jsdom has no layout to scroll and no history-managed scroll position.
 */
test.describe('route changes', () => {
  test('moves focus to the main landmark', async ({ layout, charactersPage, characterPage }) => {
    await charactersPage.goto();
    await expect(charactersPage.listItems.first()).toBeVisible();

    // A fresh load has navigated nowhere, so focus stays where the browser put it.
    await expect(layout.main).not.toBeFocused();

    await charactersPage.cardLinks.first().click();

    // The breadcrumb, not the h1: `heading()` is any level-1 heading, and the list
    // route has one too, so it resolves before the navigation has committed.
    await expect(characterPage.backLink).toBeVisible();
    await expect(layout.main).toBeFocused();
  });

  /**
   * The forward case, not browser Back: Chrome restores scroll on Back natively, so a
   * test of that passes with or without <ScrollRestoration /> and proves nothing. A
   * pushed location is the one the browser leaves alone — without it, Next from the
   * bottom of page 2 lands at the bottom of page 3.
   */
  test('scrolls to the top when a new page is pushed', async ({ page, charactersPage }) => {
    await charactersPage.goto({ pageNumber: 2 });
    await expect(charactersPage.nextLink).toBeVisible();
    // Images first: a card that grows after the scroll moves the position under it.
    await settleImages(page);

    await charactersPage.nextLink.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await charactersPage.nextLink.click();

    await expect(charactersPage.pageIndicator).toHaveText('3 of 42');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});

/**
 * The filter lives in the URL, not in the component — which is only observable across a
 * reload. Everything below this layer keeps its own memory: a jsdom test can assert the
 * term reached the query string, but not that the query string is where the term comes
 * back from.
 */
test.describe('the name filter', () => {
  /**
   * Every card, never the first one: "Rick Sanchez" is also the first character of the
   * *unfiltered* list, so a check on it passes whether the filter reached the API or
   * not. The unfiltered page fails this at its second card.
   *
   * Polled because `keepPreviousData` holds the old page on screen while the next one
   * loads — a single read can catch the list the filter was meant to replace.
   */
  async function everyCardMatches(cards: Locator, term: RegExp): Promise<void> {
    await expect
      .poll(async () => {
        const rendered = await cards.allTextContents();

        // The length guard is load-bearing: `[].every()` is true, so an empty list would
        // satisfy this without a single character having matched anything.
        return rendered.length > 0 && rendered.every((card) => term.test(card));
      })
      .toBe(true);
  }

  test('survives a reload of the page it produced', async ({ page, charactersPage }) => {
    await charactersPage.goto();
    await expect(charactersPage.listItems.first()).toBeVisible();

    await charactersPage.search.fill('Rick');

    // The URL first: the term is debounced, so the results below could still be the
    // unfiltered page for a moment after typing stops.
    await expect(page).toHaveURL(/[?&]name=Rick\b/);
    await everyCardMatches(charactersPage.listItems, /rick/i);

    await page.reload();

    // A hard navigation, so nothing in memory survives it. The input is populated from
    // the query string and the request that fills the list is built from the same place.
    await expect(charactersPage.search).toHaveValue('Rick');
    await everyCardMatches(charactersPage.listItems, /rick/i);
    await expect(page).toHaveURL(/[?&]name=Rick\b/);
  });
});
