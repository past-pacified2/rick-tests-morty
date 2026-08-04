import { defineConfig } from 'vitest/config';

/**
 * Contract tests — the price of mocking.
 *
 * Separate config, separate command, nightly only. These are the ONLY tests in the
 * repo allowed to touch the real network: they fetch from the live Rick and Morty
 * API and parse the response through the same Zod schemas the app uses.
 *
 * They assert on SHAPE, never on content — Rick's status is not our invariant, the
 * response schema is. See docs/adr/0003-testing-strategy.md.
 *
 * They do not gate a PR, because a third-party outage must never block a merge.
 */
export default defineConfig({
  test: {
    name: 'contract',
    include: ['tests/contract/**/*.test.ts'],
    environment: 'node',
    globals: true,
    // Real network: generous timeout, and retry twice so a single dropped packet
    // does not open a spurious "the API changed" issue at 03:00.
    testTimeout: 30_000,
    retry: 2,
    // Serial — we are a guest on someone else's public API.
    fileParallelism: false,
  },
});
