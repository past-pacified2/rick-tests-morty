# ADR-0003: Testing Strategy

## Status

Accepted — 2026-08-04

## Context

The previous iteration of this project had unit tests, component tests, Playwright E2E and axe audits, and still could
not answer the question _"what else should be tested here?"_ — not because the tests were bad, but because there was no
stated model for **what a test layer is for**, and therefore no way to see a hole.

This ADR fixes that. It records a taxonomy, an allocation rule, a policy for each cross-cutting concern, and —
deliberately — a list of things that are **not** tested and why.

## Decision

### The allocation rule

> Every test goes at the **cheapest layer that can still fail for the real reason**.

"The real reason" is doing the work in that sentence. A test that passes for the wrong reason is worse than no test: it
consumes runtime and buys confidence it has not earned. So:

- Logic that can be wrong on its own → **unit**
- Behaviour a user performs on one component → **component**
- Wiring between router, cache and components → **integration**
- Anything that can only be proven in a real browser → **E2E**

The corollary is the one people skip: **if a test would still pass when the thing it claims to protect is broken, delete
it.**

### The shape this produces, and why it is not a pyramid

Applying that rule to a client-rendered UI does **not** produce Mike Cohn's test pyramid. It produces something closer
to Kent C. Dodds' **testing trophy**:

```
        ╱‾‾‾‾‾╲      E2E            few — only what needs a real browser
       ╱       ╲
      │ INTEGR. │    integration    widest — where UI defects actually live
       ╲       ╱
        │ UNIT │     unit           narrow — this app has little pure logic
       ╱‾‾‾‾‾‾‾╲
      │ STATIC  │    static         the base: types, lint, dependency rules
```

The pyramid was formulated for systems whose complexity sits in business logic, where a unit is a meaningful thing to
isolate. This app's complexity sits almost entirely in **wiring** — router to cache to component to URL. There is very
little pure logic here (`src/lib/` is a handful of parsers), so a broad unit layer would be testing almost nothing that
can break.

Naming the models matters because they are not interchangeable, and picking the wrong one is how a suite ends up green
and useless:

| Shape               | Widest layer | Fits                                              |
| ------------------- | ------------ | ------------------------------------------------- |
| Pyramid (Cohn)      | Unit         | Logic-heavy backends, libraries, domain code      |
| Trophy (Dodds)      | Integration  | UI applications — this repo                       |
| Honeycomb (Spotify) | Integration  | Microservices, where the risk is between services |
| Ice cream cone      | Manual/E2E   | Nothing. This is the anti-pattern name.           |

The allocation rule is the invariant; the shape is what the rule outputs once you are honest about where this particular
system can break.

### Layer 0 — Static analysis

Not usually called testing, and it is the highest-yield layer in the stack. Every error caught here is a test that never
had to be written or maintained.

| Tool                            | Catches                                               |
| ------------------------------- | ----------------------------------------------------- |
| `tsc --noEmit`, `strict`        | Type errors, missing null handling                    |
| `noUncheckedIndexedAccess`      | `arr[i]` assumed non-undefined — the classic list bug |
| `eslint-plugin-react-hooks`     | Missing/incorrect effect dependencies                 |
| `eslint-plugin-jsx-a11y`        | Inaccessible markup, at authoring time                |
| `eslint-plugin-testing-library` | Test anti-patterns (`container.querySelector`, etc.)  |
| `import/no-restricted-paths`    | Violations of the layer dependency rule               |
| `knip`                          | Dead exports and unused dependencies                  |
| `npm audit`                     | Known vulnerable dependencies                         |

### Layer 1 — Unit (Vitest)

Pure logic only: `src/lib/` and `src/api/` with `fetch` mocked. Milliseconds, no DOM.

**Property-based testing** with `fast-check` is used for every parser in `src/lib/`. Parsers receive arbitrary
user-controlled strings from the URL, so example-based tests only prove the examples someone thought of:

```ts
it('yields a page the app can actually ask for', () => {
  fc.assert(
    fc.property(anyPageParam, (input) => {
      const page = parsePageParam(input);
      expect(Number.isSafeInteger(page)).toBe(true);
      expect(page).toBeGreaterThanOrEqual(1);
    }),
  );
});
```

That property found a real defect, and the arbitrary is why it took two attempts. `fc.string()` and
`fc.stringMatching(/^\d{1,400}$/)` both sample hard towards short inputs and never reached the region that matters;
generating the digits by length with `size: 'max'` did, and shrank to `"80000000000000000"` — a `\d+` match that
`parseInt` returns as an imprecise double, and past `1e21` one that `String()` writes back as `"8e+21"`, which the same
parser then rejects. A page reachable once and never again. A property test is only ever as good as the arbitrary
underneath it.

That single property covers `''`, `'0'`, `'-3'`, `'1e10'`, `'abc'`, `'٣'`, `'1.5'` and `'99999999999999999999'` — a list
no one writes by hand, and each of which is a real crash in a naive `parseInt` implementation.

### Layer 2 — Component (Vitest · RTL · MSW)

One component, real DOM, network intercepted by MSW. Queried the way a user perceives it: `getByRole`, `getByLabelText`,
`findByText`. Interaction via `@testing-library/user-event` — it dispatches the real sequence (pointerdown, focus,
keydown, input) and therefore catches focus and disabled-state bugs `fireEvent` walks straight past.

One exception, taken twice: a test whose subject is a timer rather than a pointer path. Every `user-event` call awaits
internally, which deadlocks under fake timers, so the prefetch-intent tests in `CharacterCard.test.tsx` and the retry
backoff in `CharacterImage.test.tsx` use `fireEvent` with the lint rule disabled inline and the reason stated.

Three rules:

- **No implementation details.** No shallow rendering, no reading state, no asserting on Tailwind classes
  ([ADR-0004](./0004-styling-approach.md)), no `data-testid` where a role or label exists. A test that knows how the
  component works has to be rewritten whenever it is refactored, which is exactly when you most need it to stay still.
- **MSW, not module mocks.** `vi.mock('../api/characters')` tests that the component calls a function you invented. MSW
  intercepts at the network layer, so the component exercises the real fetcher, the real Zod parse and the real error
  path. The seam is HTTP, which is the seam that actually exists.
- **Assert on user-visible output**, including the loading and error states — they are features, not scaffolding, and
  they are where the bugs users report actually live.

### Layer 3 — Integration (Vitest · RTL · MSW)

The layer that was missing before, and the highest-value one in an app of this shape.

Render a **whole route** with the real router, a real `QueryClient` and MSW — everything real except the network — and
drive a complete user flow:

```tsx
it('syncs the filter to the URL and back', async () => {
  const { user, router } = renderRoute('/?page=2');

  await user.type(screen.getByRole('searchbox', { name: /name/i }), 'rick');
  await waitFor(() => expect(router.state.location.search).toBe('?name=rick'));
  expect(await screen.findByRole('link', { name: /Rick Sanchez/ })).toBeVisible();

  await user.click(screen.getByRole('button', { name: /back/i }));
  expect(router.state.location.search).toBe('?page=2');
});
```

This catches the bug class that unit tests structurally cannot see and E2E is too slow to cover exhaustively:
**wiring**. A query key that omits the filter, a route param read under the wrong name, a filter that updates state but
not the URL, a page reset that does not fire when the filter changes. Every one of those passes a full unit suite.

Fresh `QueryClient` per test with `retry: false` — a shared client leaks cache between tests and is the single most
common source of order-dependent flakes in a React Query suite.

### Layer 4 — E2E (Playwright)

Runs against the **production build** via `vite preview`, so it exercises the real bundle, real code-splitting and real
asset loading rather than a dev-server approximation.

Deliberately few — roughly eight journeys. Reserved for what only a real browser can prove:

1. A pushed location starts at the top of the page — the browser restores scroll on Back by itself, so only the forward
   case is ours to test
2. Pagination through the URL, including a deep link to `?page=3`
3. Filter → results → refresh → state survives
4. API failure → inline retry → recovery
5. 404 route, and a valid-but-absent character ID
6. Keyboard-only journey: tab order, visible focus, focus moves to the `<main>` landmark on route change
7. Lazy images load on scroll (`IntersectionObserver` — jsdom has no layout, so this is genuinely untestable below this
   layer)
8. The 500 boundary renders for a crashing route

Everything else that _could_ be an E2E test should be an integration test instead.

**The API is real, and asked once per URL.** These journeys run against the live API rather than a stub — the payloads
are what production serves, and a shape change shows up here as well as in the nightly contract run. Untamed, that costs
about thirty requests per project in fifteen seconds, and the API answers a burst of that size with 429. The browser
never sees the status: the 429 carries no `Access-Control-Allow-Origin`, so `fetch` rejects, the query client takes its
short transient backoff and the page is showing the network-error panel about two seconds later — a failure no timeout
in the spec can wait out. `replayApiResponses` in `tests/e2e/fixtures.ts` therefore fetches each distinct API URL once
per worker and replays the stored response to every later test. Failed responses are not stored, so a retry still
reaches the network and the app's own error handling is unchanged. Screenshot specs remain the exception and stub
outright (`tests/e2e/stubs.ts`): a baseline compares pixels, and live data changes them.

### Cross-cutting concerns

These are the answer to _"what else should be here?"_ — they are not pyramid layers, they cut across all of them.

| Concern           | Tool                                | Runs        | Catches                                                         |
| ----------------- | ----------------------------------- | ----------- | --------------------------------------------------------------- |
| **Accessibility** | `jest-axe` + `@axe-core/playwright` | PR          | WCAG violations at component level and in the composed page     |
| **Visual**        | Playwright `toHaveScreenshot()`     | PR          | CSS regressions no assertion covers                             |
| **Performance**   | Lighthouse CI + `size-limit`        | PR          | LCP/CLS/TBT and bundle-size regressions                         |
| **Contract**      | Zod schemas vs. the live API        | nightly     | Mock drift — the API changed and every mocked test still passes |
| **Mutation**      | Stryker over the non-JSX layers     | nightly     | Tests that execute code without asserting anything meaningful   |
| **Smoke**         | Playwright vs. the deployed URL     | post-deploy | A green build that is broken in production                      |

Four of these deserve their own paragraph, because they are the ones that get forgotten.

**Accessibility runs at two layers, not one.** `jest-axe` in component tests catches a regression at the point of
change, in the same run as the rest of the suite. `@axe-core/playwright` against the real page catches what only exists
after composition — heading order across components, landmark structure, contrast after the full cascade. Neither
replaces the other, and axe together covers only ~50% of WCAG; the keyboard journey in the E2E list above exists
precisely because focus management, tab order and keyboard traps are invisible to automated auditing.

**Contract tests are the price of mocking.** Every mocked test in the suite rests on an assumption about the API's
response shape, and a mock cannot tell you it has gone stale — it will keep the whole suite green while production
breaks. So a small nightly suite hits the **real** API unmocked and parses the response through the same Zod schemas the
app uses. It does not assert on content (Rick's status may legitimately change); it asserts on **shape**. It runs
nightly and not on PRs because a third-party outage must not block a merge.

**Mutation testing is how you know the tests are any good.** Coverage tells you a line executed. It cannot distinguish a
real assertion from `expect(result).toBeDefined()`. Stryker mutates the source — flips a `<` to `<=`, deletes a return,
negates a condition — and reports how many mutants your tests killed. A surviving mutant is a hole with a line number,
which is a far more actionable artefact than a coverage percentage. It is slow, so it is nightly, and scoped to the
non-JSX layers — `lib/`, `api/`, `hooks/` and the query client — where the logic that mutation testing is good at
probing lives.

A floor per layer rather than one number over all of them, mirroring the per-path coverage thresholds in
`vitest.config.ts`. Stryker's own `thresholds.break` is a single aggregate, and an aggregate is exactly what let
`hooks/` sit at 72% behind an overall 96%. `scripts/check-mutation-thresholds.mjs` reads the JSON report and gates per
layer.

Both numbers were raised on 2026-08-23, the global coverage floor from 80 to 95 and every mutation floor to 95. A
ratchet that is stated and never turned is a gate with twenty points of slack in it, which is room for a whole file to
lose its tests unnoticed. The floors now sit one honest regression below the measurements and no further.

**Smoke tests answer a different question from E2E.** E2E asks "does the code work?"; smoke asks "does the _deployment_
work?" — right env vars, correct base path, SPA fallback rewrite configured, CDN serving the new bundle. Three
assertions against the live URL after deploy.

### Coverage and mutation policy

The repo goal is stated as "100% testing", so it is worth being precise about what that can and cannot mean.

**100% line coverage is a target for exactly two folders, and a trap as a global gate.**

- `src/lib/` and `src/api/` → **100% lines and branches**, plus a **≥ 95% mutation score**. These are pure,
  dependency-free and cheap to cover; anything uncovered here is an untested code path with no excuse.
- Global → **95%**, as a _ratchet_ (it may rise, never fall), not a target.
- Excluded from the metric: `src/test/`, `*.config.*`, type-only files, `main.tsx`.

The reason for the split is that a global 100% gate reliably produces the worst tests in a codebase. To close the last
8% someone writes assertions against error branches that cannot occur, snapshots nobody reads, and
`expect(render(<X />)).toBeTruthy()`. Coverage goes up; defect escape rate does not move. The metric gets optimised
instead of the thing it proxies for.

The honest framing for the number: **coverage is a floor detector, not a quality measure.** Low coverage proves tests
are missing. High coverage proves nothing whatsoever — which is exactly the gap mutation score fills, and why the two
are paired on the same paths.

### Regression policy

**Every bug fix ships with a test that fails before the fix and passes after it**, named for the behaviour, not the
ticket (`does not reset page when the filter is unchanged`, not `fixes #142`). The test goes at the layer where the bug
actually lived, which is a useful diagnostic in itself: a stream of regression tests landing at the E2E layer means the
layers below it are too thin.

This is policy, not tooling, and it is the mechanism that makes a suite get better over time rather than merely bigger.
A suite grown only from features tests what was imagined; a suite grown from bugs tests what actually broke.

### Flake policy

A flaky test is treated as a **failing** test, because a suite people have learned to re-run is a suite that no longer
gates anything.

- **Determinism by construction.** No arbitrary `sleep`/`waitForTimeout` — wait on the state you actually need. Fake
  timers for debounce. A pinned seed for `fast-check`, so a property cannot go red on a pull request that did not touch
  it — the exploration that costs is bought back by a nightly run with a fresh seed. Every network response through MSW
  or a Playwright route handler, never the real network in a gating suite.
- **`retries: 2` in CI only, `0` locally.** CI retries stop one flake from blocking an unrelated merge; zero locally
  means you see the flake while you still have context.
- **Trace, video and screenshot retained on first retry** so a CI-only failure is debuggable without reproducing it
  locally.

### Test data

**Factories, not fixtures.**

```ts
const rick = makeCharacter({ name: 'Rick Sanchez', status: 'Alive' });
const dead = makeCharacter({ status: 'Dead' });
```

A factory call states its own precondition inline: the reader sees exactly which field the test depends on, and the
factory fills the rest with valid defaults. A shared `fixtures.rick` object forces the reader to go and look, and —
worse — invites tests to depend on fields they never meant to, so that changing one fixture breaks nine unrelated specs.

The same factories back the MSW handlers, so mock responses and test expectations cannot disagree, and the factory
output is validated against the Zod schema in a unit test — which means a schema change breaks the factory immediately
rather than silently invalidating every mock in the suite.

### What is deliberately not tested, and why

Knowing what not to test is half the strategy.

| Not tested                           | Why                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tailwind class output                | Not user-perceivable; visual regression covers the real risk                                                                                                                                                                                                                                                           |
| Third-party libraries                | React Router and TanStack Query have their own suites; testing them tests someone else's code                                                                                                                                                                                                                          |
| Trivial prop pass-through            | A component that only forwards props has no behaviour to protect                                                                                                                                                                                                                                                       |
| Presentational-only wrappers         | Covered incidentally by the integration test of the route that uses them                                                                                                                                                                                                                                               |
| Load / stress                        | A static SPA against a public API — the load characteristics belong to the CDN and the API owner, neither of which we control                                                                                                                                                                                          |
| Cross-browser beyond Chromium on PRs | Full Firefox/WebKit matrix runs nightly; browser-specific breakage is rare and not worth 3× PR latency                                                                                                                                                                                                                 |
| Snapshot tests, in general           | Large snapshots are approved rather than reviewed and assert everything, therefore nothing. Used only for small, stable, semantic output (e.g. generated JSON-LD)                                                                                                                                                      |
| Browser-enforced network policy      | MSW intercepts at the fetch layer and models no CORS, CSP or ORB. A unit test can therefore assert a response header the browser will never expose — this happened, see [ADR-0002](./0002-data-fetching-and-caching.md). Anything that depends on what the _browser_ allows belongs in Playwright or in nothing at all |

## Consequences

**Gained:**

- A stated model, so gaps are visible instead of merely absent
- Fast feedback: static + unit + component in under a minute; the slow, third-party-dependent and inherently noisy
  suites are moved off the PR path
- A11y and performance are gates, not aspirations
- Two independent quality signals on critical paths (coverage _and_ mutation score) rather than one that is easy to game

**Traded off:**

- More tooling than a Vitest + Playwright setup: MSW, fast-check, Stryker, Lighthouse CI, `size-limit`. Each earns its
  place by catching a class of defect nothing else in the pipeline can see, but it is real setup and maintenance cost
- Visual baselines must be generated in the CI container image; a font-rendering difference will produce false diffs
  from a local run
- Nightly-only contract tests mean API drift can be up to 24 hours old before CI notices
- The flake quarantine process requires someone to actually own it; unowned, it degrades into a permanently excluded
  test list
