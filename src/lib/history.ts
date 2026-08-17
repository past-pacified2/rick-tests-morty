/**
 * Whether there is an in-app history entry to go back to.
 *
 * React Router keeps its own bookkeeping in `window.history.state` — `{ usr, key, idx }`,
 * where `usr` holds whatever a caller passed as `state` — and on a cold load it
 * `replaceState`s `idx: 0`. So `idx > 0` means this page was reached by navigating inside
 * the app and `navigate(-1)` has somewhere to land, while `0` means this page *is* the
 * entry point — a typed URL, an external link, a reload — and going back would leave the
 * site.
 *
 * The shape is narrowed rather than asserted because `history.state` is `any`: until
 * React Router has navigated, it is whatever the last `pushState` left there, which is
 * null on a fresh document and can be any structured-cloneable value.
 *
 * `idx` is an implementation detail, not public API. If a future version stops writing
 * it this returns false and the caller falls back to the link's href — the wrong page,
 * never a broken one.
 */

export function canGoBack(): boolean {
  const state: unknown = window.history.state;

  return (
    typeof state === 'object' && state !== null && 'idx' in state && typeof state.idx === 'number' && state.idx > 0
  );
}
