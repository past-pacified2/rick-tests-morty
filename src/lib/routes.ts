/**
 * The single source of truth for every URL in the app.
 *
 * `patterns` is what the router matches on; `routes` is what components link to.
 * Nothing outside this file writes a path as a string literal — see
 * docs/adr/0005-routing-strategy.md. The point is that renaming a route is one edit
 * here plus a compile error at every call site, rather than a dead link that only an
 * E2E test would ever notice.
 *
 * Bottom layer: this file imports nothing.
 */

/** Route patterns, as declared in the router. Absolute, including the `:param` slots. */
export const patterns = {
  root: '/',
  characterIndex: '/character',
  character: '/character/:id',
  fatalError: '/500',
  notFound: '*',
} as const;

/**
 * URL builders for links and redirects.
 *
 * Static routes are still functions rather than bare strings, so every call site
 * reads the same way and a static route can gain a parameter without a refactor.
 */
export const routes = {
  home: (): string => patterns.root,
  /**
   * `encodeURIComponent` is not ceremony: an id arrives from an API response or a
   * user-controlled URL, and an unencoded `/` or `?` silently rewrites the target
   * path. Encoding here means no caller has to remember to.
   */
  character: (id: number | string): string => `/character/${encodeURIComponent(String(id))}`,
  fatalError: (): string => patterns.fatalError,
} as const;
