import { setupServer } from 'msw/node';

/**
 * The MSW server used by every unit, component and integration test.
 *
 * Why MSW rather than `vi.mock('@/api/characters')`:
 *
 * Module mocking replaces a boundary *we invented* and can refactor away tomorrow.
 * The test then asserts that a component calls a function of ours in a particular
 * way — an implementation detail — and it keeps passing when the real fetch, the
 * real Zod parse, or the real error mapping breaks.
 *
 * MSW intercepts at HTTP, which is a seam that genuinely exists and that we do not
 * control. Everything below the network runs for real. In test-double terms this is
 * a *fake* (a working lightweight implementation), not a stub or a mock — which is
 * why it couples to behaviour rather than to structure.
 *
 * Handlers go in `./handlers.ts` (yours to write) and are built from the same
 * factories the tests assert against, so a mock and an expectation cannot drift
 * apart. Per-test overrides use `server.use(...)` and are reset in `setup.ts`.
 */
export const server =
  setupServer(
    // ...handlers
  );
