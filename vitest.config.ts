import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Two projects, one config.
 *
 * They are split rather than merged so CI can run them as separate jobs with
 * separate timings, and so a slow integration suite can never quietly inflate the
 * "unit tests are fast" feedback loop. See docs/adr/0003-testing-strategy.md.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,

    /**
     * The suite supplies its own environment rather than inheriting the developer's.
     *
     * `.env` is gitignored, so a suite that reads VITE_API_BASE_URL from it passes on
     * every machine that has one and fails on CI, which has none. Declaring it here
     * makes the test environment a property of the repository.
     *
     * The host is deliberately unreachable — `.invalid` is reserved by RFC 2606 and
     * never resolves. MSW intercepts before the request leaves, so the address is
     * never dialled; if interception ever breaks, the test fails loudly instead of
     * quietly succeeding against the real API.
     */
    env: {
      VITE_API_BASE_URL: 'https://api.test.invalid/api',
    },

    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // Unit, hook and component tests: co-located with their source.
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/**/*.integration.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          // Route-level: real router, real QueryClient, MSW for the network.
          include: ['src/**/*.integration.test.{ts,tsx}'],
          // Slower by nature — a whole route tree per test.
          testTimeout: 15_000,
        },
      },
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/**/index.ts', // barrel re-exports have no behaviour
      ],
      /**
       * Per-path thresholds, not one global number.
       *
       * `lib/` and `api/` are pure and dependency-free, so 100% is cheap and any gap
       * is a genuinely untested path. The global 80% is a *ratchet* — raise it when
       * it is comfortably exceeded, never lower it to make a build pass.
       *
       * Why not 100% globally: closing the last stretch on components reliably
       * produces assertions against unreachable branches and `toBeTruthy()` filler.
       * Coverage is a floor detector; mutation score (see stryker.config.json) is
       * the signal that the assertions mean anything.
       */
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
        'src/lib/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/api/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
