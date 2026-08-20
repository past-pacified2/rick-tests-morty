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
 * Keyed on `location.key` rather than a first-render flag: React runs effects twice
 * under StrictMode, and a flag would read the second mount as a navigation. On the
 * initial render the key has not changed, so focus stays wherever the browser put it
 * — the user has not navigated, and taking focus there overrides its own handling of
 * a `#fragment`.
 */
export function useRouteFocus(target: RefObject<HTMLElement | null>): void {
  const { key } = useLocation();
  const previousKey = useRef(key);

  useEffect(() => {
    if (previousKey.current === key) return;

    previousKey.current = key;
    target.current?.focus({ preventScroll: true });
  }, [key, target]);
}
