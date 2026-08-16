import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * A thin indeterminate bar across the top of the viewport while any query is in flight.
 *
 * Driven by `useIsFetching` rather than by router navigation state: these routes have
 * no loaders, so a navigation resolves as soon as the lazy chunk arrives and the thing
 * the user is actually waiting for — the fetch — happens after it. The router would
 * report "done" while the page is still empty.
 *
 * `aria-hidden` on purpose. Whatever is fetching already owns its announcement (the
 * list route's `role="status"` region), and a second live region means hearing about
 * one wait twice. When the detail route lands it needs its own announced pending
 * state; promoting this bar to a `progressbar` instead would put the announcement in
 * the layout, where it cannot say what is loading.
 */

/**
 * A cached page turn resolves in well under this, and a bar that appears and vanishes
 * inside 50ms reads as a rendering glitch rather than as feedback. Delaying the *show*
 * rather than enforcing a minimum *visible* duration means fast fetches never paint at
 * all, which is the quieter of the two failure modes.
 */
export const SHOW_DELAY_MS = 200;

export function LoadingBar() {
  // A count, not a boolean — narrowing it here means a second query starting does not
  // restart the timer and re-delay a bar that is already showing.
  const isFetching = useIsFetching() > 0;
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    if (!isFetching) {
      return;
    }

    const timer = setTimeout(() => {
      setDelayElapsed(true);
    }, SHOW_DELAY_MS);

    // Also the reset. Visibility is derived from both flags, so the bar disappears the
    // instant fetching stops without waiting on this — clearing the flag here just
    // means the *next* fetch serves its delay again instead of painting immediately.
    return () => {
      clearTimeout(timer);
      setDelayElapsed(false);
    };
  }, [isFetching]);

  if (!isFetching || !delayElapsed) {
    return null;
  }

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden">
      {/*
        index.css sets a global prefers-reduced-motion reset that collapses every
        animation to a single 0.01ms run. For a bar whose keyframes end at
        translateX(120%) that means it finishes off-screen and is never seen at all, so
        the reduced-motion case needs a static bar rather than merely a stopped one.
      */}
      <div className="animate-indeterminate h-full w-full origin-left bg-blue-600 motion-reduce:animate-none motion-reduce:opacity-75 dark:bg-blue-400" />
    </div>
  );
}
