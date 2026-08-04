import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/** Post-deploy smoke runs against the live site; everything else against a local preview. */
const smokeBaseUrl = process.env.SMOKE_BASE_URL;
const isCI = !!process.env.CI;

const config: PlaywrightTestConfig = {
  testDir: './tests',
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
  ...(isCI ? { workers: 2 } : {}),

  reporter: isCI ? [['blob'], ['github']] : [['html', { open: 'never' }]],

  use: {
    baseURL: smokeBaseUrl ?? 'http://localhost:4173',
    // Everything needed to debug a CI-only failure without reproducing it locally.
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  /* Visual regression. Tight threshold — a loose one defeats the point, and dynamic
     regions are handled by masking in the spec rather than by raising tolerance. */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
  // Baselines are generated in the CI container image; a local run has different
  // font rendering. Keep them per-platform so that difference is explicit.
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFilePath}/{arg}{ext}',

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
