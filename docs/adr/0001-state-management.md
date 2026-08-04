# ADR-0001: State Management

## Status

Accepted — 2026-08-04

## Context

The app needs two kinds of state:

- **UI state** — current page, name filter
- **Server state** — loading, error and data for API calls

Options considered:

- **Redux Toolkit** — the historical default for React
- **Zustand / Jotai** — lightweight store libraries
- **React Context + `useReducer`** — no dependency
- **URL search params** — page and filter live in the address bar
- **TanStack Query** — owns all server state internally

The mistake this decision avoids is the common one: reaching for a store library, then discovering that ~90% of what it
holds is a cache of server responses it is badly suited to manage (staleness, deduplication, refetch-on-focus, garbage
collection).

## Decision

**No store library.** URL search params for UI state, TanStack Query for server state.

Pagination and the name filter live in `?page=&name=` via `useSearchParams`, so list views are bookmarkable, survive a
refresh, and respond correctly to browser back/forward.

```ts
const [searchParams, setSearchParams] = useSearchParams();
const page = parsePageParam(searchParams.get('page'));
const name = parseNameParam(searchParams.get('name'));
```

The only genuinely local state is the debounced filter input: the user's in-flight keystrokes are transient and belong
in `useState`; only the settled value is written to the URL.

Once TanStack Query owns loading/error/data and the URL owns page/filter, there is nothing left for a store to hold.
Adding one would create a third place state can live and a fourth way for the three to disagree.

## Consequences

**Gained:**

- One fewer dependency, and no `slice`/`action`/`selector` boilerplate
- Shareable, refresh-safe, back-button-correct list URLs for free
- A single source of truth per concern — no store/URL synchronisation bugs
- **Testability:** URL state is set up in a test by rendering at a route. There is no store to seed, no provider to
  fake, no reset-between-tests hook. This is why route-level integration tests ([ADR-0003](./0003-testing-strategy.md))
  are cheap here.

**Traded off:**

- No Redux DevTools time-travel (TanStack Query DevTools still cover server state)
- URL state is stringly-typed, so every read goes through a parser in `src/lib/` — which is the right place for it, but
  it is code that a store would not have needed
- If genuinely cross-cutting client state appears later (multi-step form, optimistic drafts), introducing Zustand at
  that point is a local change, not a rewrite
