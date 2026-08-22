import { expect, test } from './fixtures';

/**
 * Nothing that is already on screen may move once the route arrives.
 *
 * Lighthouse gates CLS on every pull request and it works — it is what caught this. But
 * it only runs there, and the shift it caught was invisible locally: the window between
 * the shell painting and the route chunk arriving is nearly zero without throttling, so
 * a regression measures 0.0000 on a developer's machine and 0.1169 on a runner.
 *
 * Delaying the chunk makes that window observable in a few seconds rather than a few
 * minutes of Lighthouse. It is not a substitute for the budget; it is the fast version
 * of the same question.
 *
 * The shift that prompted it: RootLayout's hydrate fallback painted the footer while
 * `<main>` was still empty, `mt-auto` parked it at the bottom of the viewport, and the
 * list then shoved it off the bottom of the page. The fallback renders no footer now —
 * an element that was never painted cannot move, whereas one holding a place it will
 * not keep always does.
 */
const ROUTES = [
  { path: '/', chunk: 'CharactersRoute' },
  { path: '/impressum', chunk: 'ImprintRoute' },
] as const;

const CHUNK_DELAY_MS = 1200;

/** The budget Lighthouse asserts is 0.1; anything above noise here is a regression. */
const MAX_SHIFT = 0.01;

declare global {
  interface Window {
    layoutShifts?: number[];
  }
}

/**
 * `PerformanceEntry` does not describe a layout shift's own fields, and the repo forbids
 * type assertions — so the entry is widened into an optional shape and narrowed by
 * checking the fields, which is what an assertion would have claimed without checking.
 */
interface LayoutShift extends PerformanceEntry {
  readonly value: number;
  readonly hadRecentInput: boolean;
}

for (const { path, chunk } of ROUTES) {
  test(`${path} does not shift while its route chunk loads`, async ({ page, layout }) => {
    // A PerformanceObserver, not `performance.getEntriesByType('layout-shift')`. Layout
    // shifts are never retained in the performance timeline — the timeline read returns
    // an empty array always, which is a measurement that cannot fail.
    await page.addInitScript(() => {
      window.layoutShifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift: Partial<LayoutShift> = entry;

          // Shifts within 500ms of an interaction are excluded from CLS by definition.
          // There is no interaction here, so this only mirrors the metric.
          if (typeof shift.value === 'number' && shift.hadRecentInput !== true) {
            window.layoutShifts?.push(shift.value);
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.route(`**/assets/${chunk}-*.js`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
      await route.continue();
    });

    await page.goto(path, { waitUntil: 'commit' });

    // The shell is up and the route is not: the state the shift happened in. Asserted so
    // that a fallback which quietly stopped rendering fails this test rather than passing
    // it for the wrong reason — nothing painted cannot shift.
    await expect(layout.main).toBeVisible();

    // The swap itself.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    // A shift is computed on the frame after the DOM changed, and the observer's
    // callback is delivered in a task after that. Reading the moment the heading appears
    // reads before the entry for the shift that heading caused.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(resolve, 0);
            });
          });
        }),
    );

    const shifts = (await page.evaluate(() => window.layoutShifts ?? [])).reduce((total, value) => total + value, 0);

    expect(shifts).toBeLessThanOrEqual(MAX_SHIFT);
  });
}
