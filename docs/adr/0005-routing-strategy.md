# ADR-0005: Routing and Error Strategy

## Status

Accepted — 2026-08-04

## Context

The app has two functional routes plus error handling. React Router 8's data router is the standard choice for a
client-rendered React SPA. Decisions were needed on history mode, route organisation, and how failures map to what the
user sees.

Alternatives considered: **TanStack Router** (better type safety, smaller ecosystem — a fair choice, rejected only for
familiarity and hiring-pool reasons) and **file-based routing via a meta-framework** (out of scope; see the SSR note
below).

## Decision

React Router 8 (`createBrowserRouter`) with a central route table and lazy-loaded route modules.

### Routes

| Path             | ID            | Module            | Notes                                     |
| ---------------- | ------------- | ----------------- | ----------------------------------------- |
| `/`              | `home`        | `CharactersRoute` | Character list with pagination and search |
| `/character/:id` | `character`   | `CharacterRoute`  | Character detail                          |
| `/character`     | —             | —                 | Redirects to `/` (incomplete URL)         |
| `/500`           | `fatal-error` | `FatalErrorRoute` | Unrecoverable application errors          |
| `*`              | `not-found`   | `NotFoundRoute`   | Unknown routes                            |

Paths are referenced through a typed `routes` helper, never as string literals in components — so a path change is one
edit and a compile error everywhere else, not a silent dead link that only an E2E test would catch.

Two exceptions, both stated in `src/lib/routes.ts`: `Pagination` builds its own `?page=n` query, which is relative and
carries no path; and `public/_redirects` writes `/*` and `/index.html`, being host configuration rather than code. The
redirect rule and the table above are kept in step by hand — a wrong one is invisible until the post-deploy smoke run.

### 404 vs 500

- **404** — unknown route, malformed character ID, or an ID the API reports as absent
- **500** — unrecoverable application errors; component render crashes

A non-existent character (`/character/99999`) resolves to **404**, not an error page. The API returns 404, the route
catches it and renders the not-found route. This is deliberate for SEO: a 404 is a definitive "this does not exist"
signal, whereas an error page is ambiguous and invites recrawling.

> **Known limitation.** This is a client-rendered SPA, so the HTTP status served to a crawler is always 200 regardless
> of what the app renders. A genuinely correct 404 status requires SSR or prerendering. This is the best available
> approximation client-side, and it is worth being able to say so out loud rather than claiming the SEO problem is
> solved.

### Error boundaries

Each route declares an `errorElement`; the root declares a fallback. React Router routes render errors to the nearest
boundary, which means a crash in the detail view does not blank the header and nav.

The boundary shows a generic message from `src/lib/errors.ts`, never the raw thrown text — error strings leak internals
and are not written for users.

**What this does not catch:** errors thrown outside React's render/lifecycle — bare promise rejections, `setTimeout`
callbacks, event handlers that throw asynchronously. Those need a `window.onunhandledrejection` handler to be reported,
and they are not handled here. Naming the gap is part of the decision.

API fetch errors are **not** routed to `/500`. They are handled in place with an inline error state and a retry button,
because they are recoverable and navigating away would discard the user's page and filter.

## Consequences

**Gained:**

- Typed route references; no hardcoded path strings
- Lazy route modules — each route is its own chunk
- Clear separation between "page not found", "request failed" and "the app broke"
- Per-route error boundaries limit the blast radius of a crash

**Traded off:**

- `createBrowserRouter` needs server-side fallback config in production (Vite preview handles it in dev/CI; a real
  deployment needs nginx or a host rewrite rule serving `index.html`)
- The error boundary does not cover async/event-handler errors
- Three distinct failure UIs (inline retry, 404, 500) is more surface to test — each is covered by an integration test
  for the logic and one E2E for the real navigation
