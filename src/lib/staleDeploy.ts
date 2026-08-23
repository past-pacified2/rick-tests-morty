/**
 * Recovery from a chunk the deployment no longer has.
 *
 * A tab left open across a deploy holds an index.html naming hashed chunks the new
 * deployment does not have, so the next lazy route 404s. React Router 8.3.0 drops a
 * rejected `lazy()` instead of routing it to `errorElement` (src/router.tsx), which
 * leaves the header, the footer and nothing between them — no message, no control, and
 * no reason for the user to try a reload.
 *
 * Vite fires `vite:preloadError` on window for exactly this, whatever the router then
 * does with the rejection, and the document is served `no-cache` (public/_headers), so
 * the navigation this performs fetches an index.html that names chunks that exist.
 */

/**
 * Long enough to cover the navigation and the chunks it then fetches, short enough that
 * an unrelated failure later in the same tab still recovers.
 */
const COOLDOWN_MS = 10_000;

const MARKER = 'rick-tests-morty:preload-recovery';

/** The parts of `window` this needs, so a test can supply them without a browser. */
export interface RecoveryWindow {
  readonly sessionStorage: Pick<Storage, 'getItem' | 'setItem'>;
  readonly location: Pick<Location, 'reload' | 'replace'>;
}

/**
 * Navigate to `target`, or reload if there is none, unless this tab has just tried.
 *
 * `target` is the location React Router was navigating to. On a hard load there is none
 * — the address bar already says where the user is going — so a reload is the whole job.
 * On a click there is one, and the address bar still says the page being left, so a
 * reload would land the user back where they started.
 *
 * `replace` rather than `assign`, because React Router pushes the target onto history
 * before this navigation commits even though it renders nothing there. Replacing takes
 * over that entry; assigning leaves it underneath, and Back lands on the blank route
 * this exists to avoid. Measured in Chromium.
 *
 * Returns whether it navigated, which is the only thing a caller could act on.
 */
export function recoverFromStaleDeploy(window: RecoveryWindow, now: number, target: string | null): boolean {
  try {
    const previous = window.sessionStorage.getItem(MARKER);

    if (previous !== null && now - Number(previous) < COOLDOWN_MS) {
      return false;
    }

    window.sessionStorage.setItem(MARKER, String(now));
  } catch {
    // Storage refused, so this attempt cannot be remembered and the next failure would
    // repeat it without end. A blank route is one bad page; a reload loop is a tab that
    // cannot be read or left, so this does nothing rather than risk it.
    return false;
  }

  if (target === null) {
    window.location.reload();
  } else {
    window.location.replace(target);
  }

  return true;
}
