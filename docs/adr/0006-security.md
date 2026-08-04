# ADR-0006: Security

## Status

Accepted — 2026-08-04

## Context

A client-rendered SPA consuming a public, read-only API. No authentication, no user data, no backend of our own. The
attack surface is small, but three parts of it are real: the **dependency supply chain**, the **build pipeline**, and
the **headers the app is served with**.

## Decisions

### Exact dependency versions

Every package in `package.json` is pinned exactly — no `^`, no `~` — and `package-lock.json` is committed. CI installs
with `npm ci`, which fails if the lockfile and manifest disagree rather than silently resolving something new.

This makes builds reproducible and closes the most common supply-chain vector: a compromised patch release entering the
build unreviewed. The tradeoff is that security patches now require a deliberate update, so Dependabot is configured to
open weekly PRs — the update still lands, but it lands as a reviewable diff with CI attached rather than as a surprise.

### GitHub Actions pinned to commit SHAs

Third-party actions are referenced by full commit SHA, not by tag:

```yaml
- uses: actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0
```

Tags are mutable. An action referenced as `@v4` can be repointed by whoever controls the repository, and a CI runner has
the checkout, the lockfile, and whatever secrets the workflow declares. Pinning by SHA makes that class of compromise
require a merge into this repo. Dependabot updates action SHAs on the same weekly cadence.

### Least-privilege workflow tokens

Every workflow declares `permissions: contents: read` at the top level and grants more only on the specific job that
needs it (e.g. `pull-requests: write` on the coverage-comment job). The default `GITHUB_TOKEN` is otherwise
write-capable across the repo.

`pull_request_target` is **not** used. It runs with a privileged token in the context of the base repository, and
combined with checking out PR head code it is the standard fork-PR privilege-escalation path. `pull_request` is used
throughout, which means fork PRs get no secrets — the correct outcome.

### `npm audit` in CI

Runs on every PR at `--audit-level=high` and fails the build. Advisories below high are reported without gating, because
a permanently red pipeline teaches people to merge past it.

### No secrets in the client

The API is public. No keys, tokens or credentials exist in the bundle, and nothing is read from `import.meta.env` that
is not safe to publish. A build-time check greps the emitted bundle for common secret patterns; anything genuinely
sensitive would have to move behind a backend, since a client-side "secret" is a published secret.

## Known gaps

Out of scope at this stage, and named rather than quietly omitted:

**Content Security Policy** — served as a header by nginx or Cloudflare, not a `<meta>` tag. For this app:
`default-src 'self'`, `connect-src 'self' https://rickandmortyapi.com`,
`img-src 'self' https://rickandmortyapi.com data:`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`.

**Security headers** — `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains`, and a `Permissions-Policy` disabling unused features.
`X-Frame-Options` is superseded by CSP `frame-ancestors` but is still worth sending for older browsers.

**Subresource Integrity** — not applicable; all assets are self-hosted from the Vite build. It would become necessary
the moment any script is loaded from a CDN.

**HTTPS** — assumed at the infrastructure layer.

**Secret scanning / SAST** — GitHub secret scanning and CodeQL would be enabled on a production repository. Neither is
configured here.

## Consequences

**Gained:**

- Reproducible builds; no unreviewed code enters via a transitive patch release
- CI compromise requires a merge to this repo rather than a tag repoint elsewhere
- Vulnerable dependencies fail the build rather than being noticed later
- Production hardening requirements are written down, so they are a deployment checklist item rather than something
  rediscovered under incident conditions

**Traded off:**

- Pinned versions mean routine Dependabot PR churn that someone must review
- SHA pins are unreadable without the trailing `# v5.0.0` comment, which must be kept accurate
- `--audit-level=high` means moderate advisories accumulate unaddressed unless reviewed periodically
