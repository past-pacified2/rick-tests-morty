# ADR-0002: Data Fetching, Caching, and the Network Boundary

## Status

Accepted — 2026-08-04

## Context

The Rick and Morty API is a paginated read-only REST API. The app needs paginated list fetching without flicker,
single-character detail fetching, and a cache that avoids redundant requests within a session.

Options considered for the client:

- **[rick-and-morty-api-node](https://github.com/afuh/rick-and-morty-api-node)** — the community JS client. Rejected: it
  wraps a straightforward REST API in an abstraction that adds no capability, and its types become the source of truth
  instead of ours.
- **Axios** — rejected; `fetch` is native, and the only feature we would use it for (interceptors) is better handled by
  TanStack Query.
- **Raw `fetch` behind a typed wrapper** — chosen.

Options considered for caching:

- **Hand-rolled cache** in a store — `Map<page, Character[]>`, manual TTL
- **TanStack Query** — `@tanstack/react-query`

## Decision

### TanStack Query for caching

```ts
export function useCharacters({ page, name }: CharactersQuery) {
  return useQuery({
    queryKey: ['characters', { page, name }],
    queryFn: ({ signal }) => fetchCharacters({ page, name, signal }),
    staleTime: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
```

`keepPreviousData` keeps the current page on screen while the next one loads — no flicker, no empty-state flash between
pagination steps. The detail route reads from the same cache, so a character already fetched as part of a list page
renders instantly with no second request. Hover on a card triggers `queryClient.prefetchQuery`, which makes first-visit
detail navigation feel instant too.

### Zod at the network boundary

Every response is parsed, not cast:

```ts
const CharacterSchema = z.object({ id: z.number(), name: z.string() /* … */ });

export async function fetchCharacter(id: number, signal?: AbortSignal) {
  const res = await fetch(`${API_BASE}/character/${id}`, { signal });
  if (!res.ok) throw new ApiError(res.status);
  return CharacterSchema.parse(await res.json());
}
```

This is the decision that matters most for testing. `as Character` is a promise the compiler cannot keep: the network is
the one place where TypeScript's guarantees end. Parsing at the boundary means:

1. Every layer above `api/` can trust its types at **runtime**, not just at compile time.
2. The schema is a single, executable definition of what we believe the API returns — which makes contract tests
   ([ADR-0003](./0003-testing-strategy.md)) a three-line assertion against the live API rather than a hand-maintained
   list of field checks.
3. MSW handlers can be validated against the same schema, so a mock cannot drift from the type the app expects without a
   test failing.

Schemas live in `src/api/` beside the fetcher, and the app's types are derived from them
(`type Character = z.infer<typeof CharacterSchema>`) — one definition, not two.

### Error shape

`api/` throws a typed `ApiError` carrying the HTTP status. It does not decide what the user sees; that belongs to the
route ([ADR-0005](./0005-routing-strategy.md)). Keeping the translation out of `api/` is what lets `api/` be tested with
nothing but a mocked `fetch`.

## Consequences

**Gained:**

- Automatic request deduplication and cancellation via `AbortSignal`
- `staleTime`/`gcTime` replace hand-written TTL logic
- `keepPreviousData` eliminates pagination flicker
- Runtime type safety, and a schema that doubles as the contract-test oracle

**Traded off:**

- Cache does not survive a refresh (persist plugin not wired up)
- Zod adds ~14kb gzipped and a parse cost per response — negligible at this payload size, and it can be swapped for a
  smaller validator later without touching callers
- Less fine-grained control over cache writes than a hand-rolled store — acceptable, since the API is read-only and
  there are no mutations to coordinate
