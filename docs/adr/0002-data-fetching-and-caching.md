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
    queryFn: ({ signal }) => fetchCharactersListPage({ page, name, signal }),
    placeholderData: keepPreviousData,
  });
}
```

`keepPreviousData` keeps the current page on screen while the next one loads — no flicker, no empty-state flash between
pagination steps.

### Hover prefetch

The list and the detail view are separate cache entries — `['characters', { page, name }]` against
`['character', { id }]` — so opening a card is a first fetch even though the same character was on screen a moment
earlier as part of the list response. Seeding the detail entry from every list response was the alternative; it writes
twenty cache entries per page to serve at most one of them, and it writes them from a payload shaped by the list
endpoint rather than the detail one.

A hover is a cheaper signal, because it is evidence about the one card that is about to be wanted. Pointing at a card
(or tabbing onto it) schedules `queryClient.prefetchQuery`, so the request is usually in flight before the click lands.

Three constraints shaped the implementation:

**The request is delayed, not immediate.** A mouse crossing a 20-card grid enters every card on the way, and a held Tab
key does the same at autorepeat speed. Firing on entry would spend twenty requests against the same rate limit the
backoff below already fights. `PREFETCH_INTENT_MS` is the dwell time that separates _moved across_ from _looking at_;
leaving the card, or blurring it, cancels the pending request.

**The card does not fetch.** `CharacterCard` takes an `onPrefetch` callback and owns only the timer; the route supplies
the callback through `usePrefetchCharacter`. A component that called `prefetchQuery` itself would need a value import
from `api/`, which is precisely what the layering rule forbids ([TECHNICAL.md](../TECHNICAL.md)).

**The prefetch and the detail query share one definition.** Both are built from `characterQueryOptions`, so they cannot
drift apart on the key: a prefetch written under a different one leaves an entry nothing reads. That failure is
invisible in the UI — it just looks like the prefetch not helping — so `src/hooks/usePrefetchCharacter.test.tsx` asserts
it directly. The `staleTime` that keeps a re-hover free is no longer a way for the two to diverge at all; it is a client
default (`src/queryClient.ts`).

`prefetchQuery` rather than `fetchQuery`: it resolves rather than rejects on failure. A hover is not a user request for
data, so a failed one has nothing to report and nobody to report it to; the click that follows will surface the error
through the detail route's own query.

### Zod at the network boundary

Every response is parsed, not cast:

```ts
const Character = z.object({ id: z.number(), name: z.string() /* … */ });

export async function fetchCharacter(id: number, signal?: AbortSignal) {
  const res = await fetch(`${API_BASE}/character/${id}`, { signal });
  if (!res.ok) throw new FetchError(CHARACTER_SYSTEM_ERROR_MSG, res.status);
  return Character.parse(await res.json());
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
(`type Character = z.infer<typeof Character>`) — one definition, not two, and the schema and the type share a name
because they are the same statement in two grammars.

### Retry-After is unreadable, and the backoff is jittered instead

Every 429 this API returns carries a `Retry-After` — 6 to 10 seconds, visible in devtools on both the JSON responses and
the character images. The app does not use it, and cannot.

Cross-origin, JavaScript may read only the
[CORS-safelisted response headers](https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name) —
`Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`, `Last-Modified`, `Pragma`. Anything
else requires the server to name it in `Access-Control-Expose-Headers`. `rickandmortyapi.com` sends no such header
(confirmed against a 200 response), so `response.headers.get('retry-after')` is `null` in a browser however plainly
devtools shows the value. Devtools reads the wire. `fetch` reads what CORS permits.

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
   `CharacterImage`. 10s doubling, plus up to 3s of jitter, twice. (The query client's half of this is gone — see the
   amendment below.)

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

The 429 turns out to be worse than unreadable, which is the amendment that follows.

### The status is unreadable too, so the 429 branches are gone

Amended 2026-08-22. The section above assumed a 429 arrives as a response whose `Retry-After` we may not read. It does
not arrive at all.

The rate limit is answered by Cloudflare's edge rather than by the API, and that response carries no
`Access-Control-Allow-Origin` at all:

```
HTTP/2 429            content-type: text/html; charset=UTF-8
server: cloudflare    retry-after: 8
                      access-control-allow-origin: (absent)
```

A response that fails the CORS check is never handed to the page, so `fetch` rejects with a `TypeError` — "Failed to
fetch" in Chromium, "Load failed" in WebKit, measured in both. The app sees a network failure with no status, which is
also why devtools shows a tidy `429 Too Many Requests` while the page shows the network-error copy: the network panel
sits below the check that discarded the response.

Two things were written against a status the app cannot observe, and both are deleted:

- the rate-limit branch in `queryClient.ts`, which chose the 10-second backoff. Every browser-visible failure takes the
  transient one, which is what has always actually happened.
- the rate-limit copy in `errors.ts`, which `copyForStatus` returned for 429. A rate limit renders the network-error
  copy, because that is genuinely all we know.

That is the same argument that removed `FetchError.retryDelayMs`, one level up: a branch that cannot execute in
production, with a green test above it, is a claim. The tests were green for the same reason as last time — MSW models
no CORS, so a handler can answer 429 and the branch runs in a way the browser will never reproduce.

Two things stay:

- the 429 branch in `api/characters.ts`. `tests/contract/` calls the same fetcher under Node, where no CORS check
  applies and the status is real.
- `CharacterImage`'s full-window wait. An `<img>` failure carries no response in any case, so that retry never read a
  status to begin with; treating every image failure as a rate limit is the best available guess and a correct one for
  this API.

**What would fix it is the proxy.** Option 2 above — a same-origin Cloudflare Pages Function in front of the API — reads
the response server-side, where no CORS applies, and re-emits it same-origin. Status and `Retry-After` both become
readable, which is now two things depending on that information rather than one: the backoff _and_ the copy the user
reads. The price is unchanged — a runtime to deploy, test and monitor, plus a `connect-src` and base-URL change — and it
still does not make the API answer sooner, so it stays not taken. It is recorded here as the one option that would work,
not as a task.

### Error shape

`api/` throws a typed `FetchError` carrying the HTTP status — `0` when the request never reached a server. It does not
decide what the user sees; that belongs to the route ([ADR-0005](./0005-routing-strategy.md)). Keeping the translation
out of `api/` is what lets `api/` be tested with nothing but a mocked `fetch`.

The class itself lives in `src/lib/errors.ts`, beside the copy the boundary renders for it, rather than next to the
fetchers that throw it. `queryClient.ts` needs it to tell a 404 from a 429, and importing it from `api/` pulled the Zod
runtime and every schema into the chunk that blocks first paint.

## Consequences

**Gained:**

- Automatic request deduplication and cancellation via `AbortSignal`
- `staleTime`/`gcTime` replace hand-written TTL logic
- `keepPreviousData` eliminates pagination flicker
- Hover prefetch turns most first-visit detail navigations into cache reads
- Runtime type safety, and a schema that doubles as the contract-test oracle

**Traded off:**

- Cache does not survive a refresh (persist plugin not wired up)
- Zod adds ~14kb gzipped and a parse cost per response — negligible at this payload size, and it can be swapped for a
  smaller validator later without touching callers
- Less fine-grained control over cache writes than a hand-rolled store — acceptable, since the API is read-only and
  there are no mutations to coordinate
- Hover prefetch spends requests on cards that are never opened. The intent delay bounds it; a touch device, which has
  no hover at all, gets no benefit from it either
