import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/** Post-deploy smoke runs against the live site; everything else against a local preview. */
const smokeBaseUrl = process.env.SMOKE_BASE_URL;
const isCI = !!process.env.CI;

const config: PlaywrightTestConfig = {
  testDir: './tests',
  // Playwright uses *.spec.ts; Vitest contract tests under tests/contract use *contract.test.ts.
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: isCI,

  /**
   * Flake policy, encoded. See docs/adr/0003-testing-strategy.md.
   *
   * Retries in CI stop one flake from blocking an unrelated merge. Zero locally is
   * the important half: you see the flake while you still have the context to fix
   * it, instead of it being silently absorbed and shipped.
   */
  retries: isCI ? 2 : 0,

  /* Two everywhere, not just in CI. These specs hit the real API (ADR-0003), and
     Playwright's local default of roughly half the cores puts five browser projects on
     it at once — enough for it to start dropping requests, which surfaces as the
     generic error page and a handful of mobile-safari failures that move around
     between runs. Measured: 8 failures at the default, 95/95 green at 2. It also means
     a local run reproduces CI's concurrency instead of being a different experiment.
     Costs about 15s on a full suite. */
  workers: 2,

  reporter: isCI ? [['blob'], ['github']] : [['html', { open: 'never' }]],

  use: {
    baseURL: smokeBaseUrl ?? 'http://localhost:4173',
    // Everything needed to debug a CI-only failure without reproducing it locally.
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Visual regression. An absolute pixel budget, not a ratio: `maxDiffPixelRatio: 0.01`
     was the first thing here and it let a real layout change through — widening the
     pagination gap from gap-4 to gap-6 differs by 533 pixels, which on a 1280×720 shot
     is exactly the 1% it tolerated. A ratio also scales the tolerance with the page, so
     the taller the screenshot the more breakage it excuses.

     100 is roughly 5× the antialiasing noise floor, which is only this low because
     every baseline is generated in the same container the CI job runs in.

     Payload-driven variation is handled by stubbing the API in the spec (tests/e2e/
     stubs.ts), not by masking and not by raising this number. */
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      animations: 'disabled',
    },
  },
  // Baselines are generated in the same image the CI jobs run in
  // (mcr.microsoft.com/playwright, pinned in both workflows) — `npm run
  // test:visual:update` is that docker invocation, so the image cannot drift out of
  // sync by someone regenerating locally. It is a precaution, not an observed failure:
  // a bare WSL run
  // currently matches the container byte-for-byte on this page. Fonts, GPU path and
  // browser build are all things that *can* differ per environment, and pinning removes
  // the variable rather than waiting to find out which one bites.
  //
  // Per-platform so any such difference is at least explicit rather than a mystery
  // diff, and per-project because nightly.yml runs the same spec across five browsers —
  // one shared file would diff a WebKit screenshot against a Chromium baseline.
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{testFilePath}/{arg}{ext}',

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /* Nightly matrix — names must match .github/workflows/nightly.yml. */
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],

  /**
   * Tests run against the PRODUCTION build, not the dev server — real bundle, real
   * code-splitting, real asset loading. A dev-server E2E suite proves the dev server
   * works.
   *
   * Skipped entirely for smoke runs, which target an already-deployed URL.
   */
};

if (!smokeBaseUrl) {
  config.webServer = {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  };
}

export default defineConfig(config);
