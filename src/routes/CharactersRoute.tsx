/**
 * Character list — the app's home route.
 *
 * Placeholder. Data, search and pagination land in the next slice; this exists now so
 * the router, the layout and the E2E wiring can be proven end to end before any
 * network code exists. See docs/adr/0002-data-fetching-and-caching.md.
 */
export function CharactersRoute() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Characters</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">The character list will render here.</p>
    </>
  );
}

// React Router's `lazy` reads route properties off the module namespace, and the
// property it looks for is `Component`. Aliasing keeps the function's real name in
// stack traces and React DevTools.
export { CharactersRoute as Component };
