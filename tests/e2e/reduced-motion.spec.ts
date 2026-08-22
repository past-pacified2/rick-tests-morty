import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * `prefers-reduced-motion: reduce`, honoured or not.
 *
 * The unit suite asserts that `motion-reduce:animate-none` appears in a className
 * string, which proves the literal was typed and nothing else. The class only means
 * something once Tailwind has generated the rule, the browser has matched the media
 * query and the cascade has resolved — none of which exists in jsdom.
 *
 * Every case is a pair. An element that never moved satisfies "does not move under
 * reduce" for free, so each assertion runs again with the preference off and has to come
 * out the other way. Playwright already defaults to `no-preference`; it is set
 * explicitly so the control keeps controlling if the config ever picks a default.
 *
 * Two separate mechanisms are under test and neither covers the other: the
 * `motion-reduce:` variants on individual components, and the global media-query reset
 * in src/index.css that collapses every transition in the app.
 */

/** Long enough to outlast the bar's SHOW_DELAY_MS and hold the skeletons on screen. */
const API_DELAY_MS = 1500;

async function stallTheApi(page: Page): Promise<void> {
  await page.route(/\/api\/character/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
    await route.continue();
  });
}

/** Computed durations come back in seconds in one browser and milliseconds in another. */
function toMs(duration: string): number {
  const value = Number.parseFloat(duration);

  return duration.trim().endsWith('ms') ? value : value * 1000;
}

function styleOf(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

/**
 * Located by the animation class rather than by structure. It reads as circular and is
 * not: the assertion is about the computed value, so removing the class fails the test
 * by finding nothing rather than by passing vacuously.
 */
const loadingBar = (page: Page): Locator => page.locator('.animate-indeterminate');
const skeleton = (page: Page): Locator => page.locator('.animate-pulse').first();

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  /**
   * A stopped bar is not enough. The global reset collapses the animation to a single
   * 0.01ms run, and these keyframes end at translateX(120%) — so a bar that is merely
   * stopped finishes off-screen and is never seen. The static styling is what puts it
   * back where a user can find it.
   */
  test('holds the loading bar still and on screen', async ({ page }) => {
    await stallTheApi(page);
    await page.goto('/');

    const bar = loadingBar(page);
    await expect(bar).toBeVisible();

    expect(await styleOf(bar, 'animation-name')).toBe('none');
    expect(await styleOf(bar, 'opacity')).toBe('0.75');

    const box = await bar.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect(box?.width ?? 0).toBeGreaterThan(0);
  });

  test('stops the skeleton pulse', async ({ page }) => {
    await stallTheApi(page);
    await page.goto('/');

    const card = skeleton(page);
    await expect(card).toBeVisible();

    expect(await styleOf(card, 'animation-name')).toBe('none');
  });

  /** No `motion-reduce:` variant anywhere near this one — only the reset in index.css. */
  test('collapses the card hover transition', async ({ charactersPage }) => {
    await charactersPage.goto();
    await expect(charactersPage.cardLinks.first()).toBeVisible();

    expect(toMs(await styleOf(charactersPage.cardLinks.first(), 'transition-duration'))).toBeLessThan(1);
  });
});

test.describe('with motion', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('sweeps the loading bar', async ({ page }) => {
    await stallTheApi(page);
    await page.goto('/');

    const bar = loadingBar(page);
    await expect(bar).toBeVisible();

    expect(await styleOf(bar, 'animation-name')).not.toBe('none');
    expect(await styleOf(bar, 'opacity')).toBe('1');
  });

  test('pulses the skeleton', async ({ page }) => {
    await stallTheApi(page);
    await page.goto('/');

    const card = skeleton(page);
    await expect(card).toBeVisible();

    expect(await styleOf(card, 'animation-name')).not.toBe('none');
  });

  test('keeps the card hover transition', async ({ charactersPage }) => {
    await charactersPage.goto();
    await expect(charactersPage.cardLinks.first()).toBeVisible();

    expect(toMs(await styleOf(charactersPage.cardLinks.first(), 'transition-duration'))).toBeGreaterThan(50);
  });
});
