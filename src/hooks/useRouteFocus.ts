import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router';

/**
 * Moves focus to the main landmark after a client-side navigation.
 *
 * A route change swaps the document's content without touching focus, so a screen
 * reader is left on a link that no longer exists and its reading cursor stays in the
 * old page. The target is RootLayout's `<main id="main" tabIndex={-1}>`, which is
 * already the skip link's destination — a landmark rather than the `<h1>`, because
 * the detail route renders no heading while it loads and focus would land nowhere on
 * exactly the slow navigation that needs it most.
 *
 * `preventScroll` is load-bearing. Focusing an element scrolls it into view, which on
 * browser Back would jump to the top of the page and undo the `<ScrollRestoration />`
 * rendered alongside this.
 *
 * Keyed on the pathname, not `location.key`. A query string carries in-page state
 * here — the search term and the page number — and React Router mints a fresh key for
 * those too, including the `replace` the debounced search writes. Focusing on one of
 * those takes the caret out of the input the user is still typing in. Content changes
 * that stay on the same route are announced by the list's own `role="status"` region
 * instead.
 *
 * Comparing against the previous value rather than a first-render flag: React runs
 * effects twice under StrictMode, and a flag would read the second mount as a
 * navigation. On the initial render nothing has changed, so focus stays wherever the
 * browser put it — the user has not navigated, and taking focus there overrides the
 * browser's own handling of a `#fragment`.
 */
export function useRouteFocus(target: RefObject<HTMLElement | null>): void {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;

    previousPathname.current = pathname;
    target.current?.focus({ preventScroll: true });
  }, [pathname, target]);
}
