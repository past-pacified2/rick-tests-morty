import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Contract tests — the price of mocking.
 *
 * Separate config, separate command, nightly only. These are the ONLY tests in the
 * repo allowed to touch the real network: they fetch from the live Rick and Morty
 * API and parse the response through the same Zod schemas the app uses.
 *
 * They assert on shape first — Rick's status is not our invariant, the response schema
 * is — and on content only where the content *is* the contract: a `?name=` filter that
 * returns non-matching characters has broken its side of the bargain, and no schema
 * catches that. See docs/adr/0003-testing-strategy.md.
 *
 * They do not gate a PR, because a third-party outage must never block a merge.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    name: 'contract',
    include: ['tests/contract/**/*.test.ts'],
    environment: 'node',
    env: {
      VITE_API_BASE_URL: 'https://rickandmortyapi.com/api',
    },
    globals: true,
    // Real network: generous timeout, and retry twice so a single dropped packet
    // does not open a spurious "the API changed" issue at 03:00.
    testTimeout: 30_000,
    retry: 2,
    // Serial — we are a guest on someone else's public API.
    fileParallelism: false,
  },
});
