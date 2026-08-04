# rick-tests-morty

A Rick & Morty SPA built against the [Rick and Morty API](https://rickandmortyapi.com/).

This repo is **documentation- and CI-first**. The architecture, the test strategy and the pipeline are decided and
written down before the code exists, so the implementation is answerable to the decisions rather than the other way
round.

## Stack

| Concern      | Choice                                    | ADR                                                  |
| ------------ | ----------------------------------------- | ---------------------------------------------------- |
| Framework    | React 19 + TypeScript (strict)            | —                                                    |
| Build        | Vite                                      | —                                                    |
| Routing      | React Router 8 (data router)              | [0005](./docs/adr/0005-routing-strategy.md)          |
| Server state | TanStack Query                            | [0002](./docs/adr/0002-data-fetching-and-caching.md) |
| Client state | URL search params — no Redux/Zustand      | [0001](./docs/adr/0001-state-management.md)          |
| Styling      | TailwindCSS v4, no component library      | [0004](./docs/adr/0004-styling-approach.md)          |
| Schema       | Zod at the network boundary               | [0002](./docs/adr/0002-data-fetching-and-caching.md) |
| Tests        | Vitest · RTL · MSW · Playwright · Stryker | [0003](./docs/adr/0003-testing-strategy.md)          |
| CI           | GitHub Actions                            | [0007](./docs/adr/0007-ci-pipeline.md)               |
| Security     | Pinned deps, SHA-pinned actions, CSP      | [0006](./docs/adr/0006-security.md)                  |

## Repo map — where does X go?

Six folders, one rule. If you can answer "which layer does this belong to?" you can find anything in this repo in one
hop.

| Folder            | Holds                                                         | May import from    | Example                        |
| ----------------- | ------------------------------------------------------------- | ------------------ | ------------------------------ |
| `src/lib/`        | Pure functions. No React, no network, no globals.             | nothing            | `parsePageParam`, `statusTone` |
| `src/api/`        | Typed `fetch` wrappers + Zod schemas. One file per resource.  | `lib`              | `fetchCharacters`              |
| `src/hooks/`      | TanStack Query hooks and UI hooks. The only caller of `api/`. | `lib`, `api`       | `useCharacters`                |
| `src/components/` | Presentational. Props in, callbacks out. No data fetching.    | `lib`              | `CharacterCard`                |
| `src/routes/`     | One file per route. Orchestration and layout only.            | all of the above   | `CharactersRoute`              |
| `src/test/`       | Factories, MSW handlers, render helpers. Never shipped.       | `lib`, `api` types | `buildCharacter`               |

### The dependency rule

```
lib  ←  api  ←  hooks  ←  components · routes
```

Arrows point one way and only one way. `import/no-restricted-paths` enforces it in ESLint, so a violation fails CI
rather than becoming a convention nobody remembers.

Two consequences worth stating out loud, because they are what make the tree navigable:

- **A component never fetches.** If a component needs data, a route passes it in or a hook provides it. So "where does
  the network call live?" always has the same answer.
- **`lib/` never imports anything.** Which is why it is 100%-covered and property-tested — it is the only layer where
  that is both cheap and meaningful.

### Test file placement

| Kind                    | Lives                                        | Why                                                 |
| ----------------------- | -------------------------------------------- | --------------------------------------------------- |
| Unit, hook, component   | Beside the source — `foo.ts` / `foo.test.ts` | Deleting the source deletes its tests. No orphans.  |
| Route-level integration | `src/routes/*.integration.test.tsx`          | Same locality, distinct suffix so CI can shard it.  |
| E2E, a11y, visual       | `tests/e2e/`                                 | Different runner, different lifecycle.              |
| Contract (real API)     | `tests/contract/`                            | Nightly only — hits the network, must not gate PRs. |

## Getting started

```bash
nvm use          # Node version is pinned in .nvmrc
npm ci
npm run dev
```

## Scripts

This table is a **contract**: [`ci.yml`](./.github/workflows/ci.yml) calls these names, so renaming a script means
editing the pipeline.

| Command                    | Description                                                 | Runs in CI |
| -------------------------- | ----------------------------------------------------------- | ---------- |
| `npm run dev`              | Dev server on `localhost:5173`                              | —          |
| `npm run build`            | Type-check and production build                             | every PR   |
| `npm run preview`          | Serve the production build                                  | —          |
| `npm run typecheck`        | `tsc --noEmit`                                              | every PR   |
| `npm run lint`             | ESLint (incl. `jsx-a11y`, `react-hooks`, `testing-library`) | every PR   |
| `npm run format:check`     | Prettier check                                              | every PR   |
| `npm run test:unit`        | Vitest — unit, hook, component                              | every PR   |
| `npm run test:coverage`    | Vitest with per-path coverage thresholds                    | every PR   |
| `npm run test:integration` | Vitest — route-level integration                            | every PR   |
| `npm run test:e2e`         | Playwright against the production build                     | every PR   |
| `npm run test:a11y`        | axe audits (subset of the E2E suite)                        | every PR   |
| `npm run test:visual`      | Playwright screenshot comparison                            | every PR   |
| `npm run test:contract`    | Zod schemas vs. the **real** API                            | nightly    |
| `npm run test:mutation`    | Stryker mutation run over `src/lib` and `src/api`           | nightly    |
| `npm run size`             | Bundle size budget check                                    | every PR   |
| `npm run check`            | Everything a PR gates on, locally                           | —          |

## Testing at a glance

| Layer                                        | Tool                                                | Scope                                      | Budget  |
| -------------------------------------------- | --------------------------------------------------- | ------------------------------------------ | ------- |
| 0 · Static                                   | tsc · ESLint · Prettier                             | Whole repo                                 | < 30s   |
| 1 · Unit                                     | Vitest (+ fast-check)                               | `lib/`, `api/`, hook logic                 | < 5s    |
| 2 · Component                                | Vitest · RTL · MSW                                  | One component, real DOM, mocked network    | < 20s   |
| 3 · Integration                              | Vitest · RTL · MSW                                  | A whole route: router + query + components | < 60s   |
| 4 · E2E                                      | Playwright                                          | Real browser, real bundle, ~8 journeys     | < 3 min |
| ⟂ a11y · visual · perf · contract · mutation | see [ADR-0003](./docs/adr/0003-testing-strategy.md) | Cross-cutting                              | mixed   |

Coverage policy, mutation-score policy and the flake policy are in [ADR-0003](./docs/adr/0003-testing-strategy.md) —
including why "100% coverage" is a target for exactly two folders and a trap everywhere else.

## Docs

- [`docs/TECHNICAL.md`](./docs/TECHNICAL.md) — architecture and layer contracts
- [`docs/adr/`](./docs/adr/) — architecture decision records
