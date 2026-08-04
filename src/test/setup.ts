import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './server';

/**
 * Global test setup. Infrastructure only — no assertions live here.
 *
 * Three guarantees, each of which exists to stop a specific class of false green.
 */

/* 1 ── The network is closed. -----------------------------------------------
 * `onUnhandledRequest: 'error'` means a request with no MSW handler fails the
 * test instead of hanging or silently 404-ing. Without it, a fetch you forgot to
 * mock produces a component stuck in its loading state and an assertion that
 * quietly waits for something that will never arrive. */
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

/* 2 ── No leakage between tests. --------------------------------------------
 * Handlers added with `server.use()` inside a test are reverted here. Order-
 * dependent tests are the second most common source of flake after real timers.
 *
 * DOM teardown is NOT done here: React Testing Library registers its own
 * `afterEach(cleanup)` automatically because `globals: true` is set in
 * vitest.config.ts. Calling `cleanup()` by hand as well is redundant, and
 * `testing-library/no-manual-cleanup` will tell you so. */
afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

/* 3 ── React warnings are failures. -----------------------------------------
 * "Warning: An update to X was not wrapped in act(...)", key warnings, and
 * invalid-prop errors all indicate a genuinely broken test or component. Left as
 * console noise they are read by nobody.
 *
 * Plain assignment, deliberately not `vi.spyOn`. `restoreMocks: true` in
 * vitest.config.ts calls mockRestore on every spy before each test, which silently
 * uninstalled the spy version of this guard — it never fired once. A guard that is
 * itself disabled is worse than no guard, because the file still claims it works.
 *
 * A test that legitimately expects console.error — an error boundary rendering, say —
 * opts out with vi.spyOn(console, 'error').mockImplementation(() => {}), which
 * restoreMocks then reverts to the throwing version below. */
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  originalError(...args);
  throw new Error(`console.error was called during a test:\n${String(args[0])}`);
};

/* jsdom implements neither of these, and both are used by the app. Stubbed here
 * rather than in each test — a component should not have to know it is in jsdom.
 * Note the consequence: anything relying on real intersection or media queries is
 * untestable at this layer and belongs in Playwright. See ADR-0003. */
if (!('IntersectionObserver' in globalThis)) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = '';
      thresholds = [];
    },
  );
}

if (!globalThis.matchMedia) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
