# Technical Overview

## Architecture

Six layers, each with a single responsibility and a one-way dependency rule. See the
[repo map](../README.md#repo-map--where-does-x-go) for the folder table.

```
lib  ←  api  ←  hooks  ←  components · routes
```

### Layer contracts

**`src/lib/`** — pure functions. Deterministic, no I/O, no React, no module-level state. Query-param parsing,
status→tone mapping, SEO string builders. This layer is the only one held to 100% coverage and mutation score, because
it is the only one where that is cheap.

**`src/api/`** — one typed `fetch` wrapper per resource, each returning a Zod-parsed value. No React, no cache, no retry
logic. Parsing at this boundary means every layer above it can trust its types at runtime, not just at compile time —
the network is the one place where TypeScript is lying to you.

**`src/hooks/`** — the only layer that calls `api/`. TanStack Query hooks own loading, error, retry and cache. UI hooks
(debounced filter input, route-change focus) live here too.

**`src/components/`** — presentational. Props in, callbacks out. A component that fetches is a bug: it cannot be
rendered in a test, a story, or a different route without dragging the network along.

**`src/routes/`** — one file per route, lazy-loaded via `React.lazy`. Reads URL state, calls hooks, composes components.
Orchestration only; no business logic worth unit-testing should end up here.

**`src/test/`** — factories (`buildCharacter({ status: 'Dead' })`), MSW handlers, and render helpers. Excluded from the
production build. Factories rather than static fixtures: a test that says `buildCharacter({ status: 'Dead' })` states
its own precondition, whereas `fixtures.deadRick` makes the reader go and look.

## State ownership

| State                        | Owner                | Why                                               |
| ---------------------------- | -------------------- | ------------------------------------------------- |
| Current page, name filter    | URL search params    | Bookmarkable, refresh-safe, back/forward works    |
| Character list / detail data | TanStack Query cache | Dedupe, staleness, `keepPreviousData`             |
| Debounced filter input       | Local `useState`     | Transient; only the settled value reaches the URL |
| Everything else              | —                    | There is nothing else. Hence no store library.    |

See [ADR-0001](./adr/0001-state-management.md).

## Testing approach

Five layers plus five cross-cutting concerns. The full rationale, the coverage and mutation policy, and the list of
things deliberately **not** tested are in [ADR-0003](./adr/0003-testing-strategy.md).

The short version of the allocation rule:

> Push every test to the **cheapest layer that can still fail for the real reason**. A test that could have been a unit
> test but was written as E2E costs 100× the runtime and tells you less about what broke.

| Layer       | Answers                                                | Does not answer                 |
| ----------- | ------------------------------------------------------ | ------------------------------- |
| Static      | Does this even type-check / lint?                      | Does it behave correctly?       |
| Unit        | Is this function right for all inputs?                 | Is it wired to anything?        |
| Component   | Does this render and respond to the user correctly?    | Is it on the right route?       |
| Integration | Does the route wire router + query + components right? | Does it work in a real browser? |
| E2E         | Does the shipped bundle work for a human?              | Why it broke                    |

Integration (layer 3) is the highest-value layer in an app of this shape and the one most commonly missing. Wiring bugs
— a stale query key, a route param read under the wrong name, a filter that updates state but not the URL — are
invisible to unit tests and expensive to find at E2E. They belong here.

## CI

[ADR-0007](./adr/0007-ci-pipeline.md) records the pipeline design.

| Trigger        | Runs                                                                     | Target time |
| -------------- | ------------------------------------------------------------------------ | ----------- |
| Pre-commit     | lint-staged on changed files                                             | < 5s        |
| Pull request   | static · unit · integration · build · e2e · a11y · visual · perf · audit | < 8 min     |
| Push to `main` | the PR set, then deploy, then post-deploy smoke                          | < 12 min    |
| Nightly        | contract tests vs. the real API · mutation run · full browser matrix     | unbounded   |

Anything slow, flaky-by-nature, or dependent on a third party runs nightly, not on PRs. A pipeline developers learn to
ignore is worse than no pipeline.

## A11y and performance

axe-core runs at **two** layers: inside component and integration tests (fast, catches regressions at the point of
change) and inside Playwright against the real bundle (catches composition-level problems — landmark structure, heading
order, contrast after CSS cascade).

axe catches roughly half of WCAG issues. The other half is covered by explicit keyboard-only journey tests in Playwright
— tab order, visible focus, focus moved to the `<main>` landmark on route change, no keyboard trap — because those are
precisely what automated auditing cannot see.

Lighthouse CI runs on PRs with asserted budgets (LCP, CLS, TBT) plus a `size-limit` gate on the bundle. Budgets fail the
build; scores alone do not, because a score is a moving target and a budget is a contract.

## Known tradeoffs

- **No SSR.** A read-heavy public API would benefit from SSR/SSG for first-load performance and for genuinely correct
  404 status codes. Out of scope; the SEO consequence is recorded in [ADR-0005](./adr/0005-routing-strategy.md) and
  worked around per route in [ADR-0008](./adr/0008-seo-and-page-metadata.md).
- **No cache persistence.** TanStack Query's persist plugin is not wired up; the cache is in-memory for the session.
- **No authentication.** The API is public and read-only.
- **Error boundary scope.** A React error boundary catches render-tree errors; async errors raised outside React's
  lifecycle are not caught by it.
- **Mocks can drift.** MSW handlers are an assumption about the API, not the API. Contract tests exist specifically to
  catch that drift, but they run nightly — so drift can be up to 24 hours old before CI notices.
- **Visual tests are platform-sensitive.** Screenshots are generated in the CI container image only; locally-generated
  baselines will differ on font rendering.
