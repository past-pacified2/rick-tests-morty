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

### Retry-After is unreadable, and the backoff is jittered instead

Every 429 this API returns carries a `Retry-After` — 6 to 10 seconds, visible in devtools on both the JSON responses and
the character images. The app does not use it, and cannot.

Cross-origin, JavaScript may read only the
[CORS-safelisted response headers](https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name) —
`Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`. Anything
else requires the server to name it in `Access-Control-Expose-Headers`. `rickandmortyapi.com` sends no such header
(confirmed against a 200 response; the 429 is served by Cloudflare's rate limiter and sets one no more than the origin
does), so `response.headers.get('retry-after')` is `null` in a browser however plainly devtools shows the value.
Devtools reads the wire. `fetch` reads what CORS permits.

This was live for a while as `FetchError.retryDelayMs`, with unit tests asserting it worked. They passed because MSW
intercepts at the fetch layer and models no CORS at all — it handed back every header the handler set. A branch that
cannot execute in production, with a green test above it, is worse than no branch: it is a claim.

Three options, and why the third:

1. **Read the header.** Not possible from a browser without the server's cooperation, which is not ours to give.
2. **Proxy the API** through a same-origin Cloudflare Pages Function, which reads the header server-side (no CORS
   applies between servers) and re-emits it on a same-origin response. This works, and it is what a product with a
   budget would do. It also adds a runtime to deploy, test and monitor, and it does not make the API answer any sooner —
   the wait is the same 10 seconds either way.
3. **Jittered backoff, one rate-limit window at a time.** `src/lib/retryDelay.ts`, shared by the query client and by
   `CharacterImage`. 10s doubling, plus up to 3s of jitter, twice.

The base is the window, not a fraction of it. The `Retry-After` values this API returns count down across successive
requests — 10, then 9, then 6, then 1 — which is one fixed 10s window reporting its remainder rather than a delay that
varies per request. A retry inside that window is rejected by definition: it cannot succeed, and it spends a request on
the very limit it is waiting out. An earlier 2s/4s pair burned both retries that way before the window had lifted.

The jitter is not decoration either. A list page requests twenty images at once and is rate limited for all twenty at
once; an unjittered retry re-fires that burst on a single tick and earns a fresh window. Spreading the retries across a
few seconds is the part that changes the outcome.

A retry budget this long would be unwatchable if the user had to wait it out, so `CharacterImage` puts the fallback
image _behind_ the `<img>` as a background rather than swapping `src`. It appears the instant the first attempt fails, a
retry that succeeds paints over it, and the ~33 seconds of retries cost nothing to look at. Swapping `src` would
withhold the fallback until every retry had been spent, and would hand the placeholder its own `load` and `error` events
to reason about.

The contract tests in `tests/contract/` run under Node, where no CORS check applies and the header _is_ readable. They
back off a flat 10s regardless — a contract test that leans on a header the app can never see is testing a different
client than the one we ship.

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
