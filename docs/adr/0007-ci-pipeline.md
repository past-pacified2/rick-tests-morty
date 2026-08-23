# ADR-0007: CI Pipeline

## Status

Accepted — 2026-08-04

## Context

The previous iteration had a full test suite and no CI at all, which means the suite's real guarantee was "it passed on
someone's laptop, once, before the last three commits".

Designing the pipeline is a scheduling problem, not a list of commands: the same suite gives completely different value
depending on **when** each part runs. The constraint that drives every decision below is **PR feedback under 8
minutes**. Past roughly ten minutes people stop waiting for the result, start context-switching, and the pipeline
becomes a post-merge notification system rather than a gate.

## Decision

Five stages, split by trigger.

### 1 · Pre-commit (`husky` + `lint-staged`) — under 5 seconds

ESLint and Prettier on changed files only, `commitlint` on the message, `tsc` and `knip` for the checks that cost under
a second, and `gitleaks` over the staged diff. Deliberately no test run: a pre-commit hook slow enough to be worth
bypassing will be bypassed, and `--no-verify` habits are hard to unlearn.

`tsc` and `knip` read a checkout of the index rather than the working tree. Run in place they would read whatever is on
disk, which lets an unstaged fix carry a broken commit and an unstaged break fail a clean one.

### 2 · Pre-push — under a minute

`npm run check`: typecheck, lint, format, knip, the suite with its coverage thresholds, build, bundle size, and the
Chromium E2E run. The same set the pull request gates on, so a push that passes cannot fail CI on anything but the
browser matrix, Lighthouse or the audit.

The hook invokes that script rather than listing its steps. A hook that restated them would become a third definition of
"everything" and drift from the other two.

Per push is the right frequency for a minute of work — often enough that nothing reaches CI untested, rare enough that
nobody learns to skip it. It is also where the test run went when the pre-commit hook grew past its budget.

Measured at 39s on 23 Aug 2026, of which the E2E run is 16s. The heading said 40 seconds until that measurement came
within a second of it, which is a budget met by rounding. The hook now prints its own elapsed time on every push rather
than failing past a threshold: the number this budget cares about is whether anyone waits for the result, and a
wall-clock gate on a developer's machine goes red for a busy laptop as readily as for a slow suite. That is the
`--no-verify` habit arriving by a different door. Printing it puts the drift in front of whoever added the work, on the
push that added it.

### 3 · Pull request — under 8 minutes

Runs on `pull_request`. Jobs are parallel and fail fast; each declares `timeout-minutes` so a hung runner cannot burn 6
hours of quota.

```
        ┌── static ────────────────┐   typecheck · lint · format · knip · doc and image pins
        ├── unit ──────────────────┤   vitest + coverage thresholds
build ──┼── integration ───────────┼── ✅ ci-ok
        ├── e2e (sharded ×3) ──────┤   playwright + axe + visual
        ├── lighthouse + size ─────┤   asserted budgets
        └── audit ─────────────────┘   npm audit --audit-level=high
```

Three details that make it fast, and that are usually got wrong:

**Build once, reuse everywhere.** `build` runs first and uploads `dist/` as an artifact. The E2E, Lighthouse and size
jobs download it. Building three times in three jobs is the single most common way a pipeline quietly triples its own
runtime — and it also means the artifact E2E tests is _not_ the artifact that gets deployed, which defeats the point.

**Shard Playwright across three runners.** Playwright's `--shard=i/3` splits by test file; each shard uploads a blob
report and a final job merges them into one HTML report. E2E is the long pole, and sharding is the only thing that moves
it.

**Cache aggressively, and cache the right things.** `actions/setup-node` with `cache: npm` for the module cache, keyed
on the lockfile hash so a dependency change invalidates it.

This originally paired with a separate keyed cache for `~/.cache/ms-playwright`, since browser downloads are ~300MB and
dominate a cold run. Superseded: the E2E jobs run inside `mcr.microsoft.com/playwright`, which ships the browsers, so
there is nothing left to cache and no cache key that can go stale against them. The pinned image is the better answer —
it fixes the browser build as well as the download, which is what the visual baselines actually depend on.

**Gate a paint metric only where the paint is ours.** Lighthouse runs against two URLs, and they are not the same kind
of page. `/impressum` renders from the local bundle alone; `/` waits on `rickandmortyapi.com` for the list and then on
its CDN for the image that becomes the Largest Contentful Paint. Measured over three runs on an idle machine: LCP 450,
451, 451 ms on `/impressum` against 910, 924, 1029 ms on `/`. The second spread is a third party's queue depth, and no
pull request can move it.

So `lighthouserc.json` splits the assertions with `assertMatrix`. LCP and Speed Index gate at error level on
`/impressum` and warn on `/`. Nothing is lost by that: both pages boot the same entry chunk, so the regression these
budgets exist to catch — the bundle getting slower — fails on `/impressum` too, and does so without the API in the
measurement. CLS, Total Blocking Time and the accessibility and SEO scores stay error-level on both, being main-thread
and markup facts rather than network ones. A gate that fires on something the author cannot fix within the pull request
is the fastest way to teach people to click through gates.

Plus:

- **`concurrency` with `cancel-in-progress`** — pushing a fix should kill the superseded run, not race it.
- **A single `ci-ok` aggregator job** that depends on all the others, and is the one required status check in branch
  protection. Otherwise every new job has to be added to the protection rule by hand, and a job nobody registered
  silently stops gating anything.
- `permissions: contents: read` at the top level ([ADR-0006](./0006-security.md)).

### 4 · Push to `main` — under 12 minutes

The PR set, then deploy, then a **post-deploy smoke suite** against the live URL. A deploy that is not verified against
the deployed artifact is an assumption, and the failure modes that only appear here — wrong base path, missing SPA
fallback rewrite, stale CDN cache — are invisible to every test that ran before it.

**A red smoke run rolls production back.** The deploy job records the deployment that is live before it publishes; if
the smoke suite then fails, a `rollback` job restores that deployment through the Cloudflare Pages API and smokes the
restored site. Detection without a response leaves the broken build serving users until somebody reads a notification,
which is the expensive half of the pair. It carries no `environment: production` gate on purpose — an approval step is
there to make a human authorise shipping, and a rollback that waits for one is the outage it exists to end.

**Source maps are built but not served.** `vite.config.ts` sets `sourcemap: 'hidden'`, so the bundle carries no pointer
to them, and the deploy archives the `.map` files as a run artifact before deleting them from `dist`. They were 1.9 MB
of a 2.5 MB deploy and nothing read them; archived, a production stack trace is still decodable from the run that
produced it.

### 5 · Nightly (`schedule`) — unbounded

Everything too slow, too noisy, or too dependent on a third party to gate a merge:

| Job                                                         | Why it is nightly                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| **Contract tests** vs. the live API                         | Hits the real network; a third-party outage must not block merges |
| **Mutation testing** (Stryker)                              | Minutes to tens of minutes; it is a health metric, not a gate     |
| **Property tests on a random seed**                         | The gating run pins the seed; exploring belongs where red is free |
| **Full browser matrix** (Firefox, WebKit, mobile viewports) | 3× the E2E cost for a rare failure class                          |
| **`npm audit` on the full tree**                            | New advisories appear on their schedule, not on ours              |

Failures open an issue rather than emailing a red X into the void — a nightly failure with no owner is a nightly failure
nobody fixes. A green run closes it again. Half a lifecycle is worse than none: an issue that opens on the first red
night and stays open reads as "the nightly exists" within a week, and the next real failure lands as a comment on
wallpaper.

### What gates a merge, and what only reports

| Gate (blocks merge)                      | Reports only                                 |
| ---------------------------------------- | -------------------------------------------- |
| typecheck, lint, format                  | Lighthouse scores (budgets do gate)          |
| unit, integration, E2E, a11y             | mutation score trend                         |
| visual diffs (until explicitly approved) | moderate/low `npm audit` advisories          |
| bundle size budget                       | nightly full-matrix results                  |
| CLS and TBT on both URLs                 | LCP and Speed Index on `/` (third-party CDN) |
| LCP and Speed Index on `/impressum`      |                                              |
| `npm audit` high and above               |                                              |

The split matters: a gate that fires on something the author cannot control or fix within the PR trains people to click
through gates.

## Consequences

**Gained:**

- Every merge is verified against the same artifact that gets deployed, less the source maps the deploy strips
- Feedback fast enough that people actually wait for it
- Slow and third-party-dependent checks still run — just where their latency and noise cost nothing
- One required status check, so adding a job cannot silently un-gate the branch

**Traded off:**

- Artifact passing between jobs is more YAML than a single monolithic job, and the failure mode (a missing artifact) is
  a confusing one to debug
- Nightly jobs need an owner; unowned, they are ignored within a fortnight
- A rollback depends on the Cloudflare Pages API rather than on anything this repo can exercise in CI, so it is the one
  path here that is not proven by a passing check
- Sharding makes a flaky test harder to reproduce — the report merge step exists specifically to keep the failure
  legible
- Visual baselines are container-image-specific: a runner image bump will invalidate them and require a deliberate
  re-baseline
