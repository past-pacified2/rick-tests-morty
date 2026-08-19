/**
 * Jittered backoff, shared by the query client and CharacterImage.
 *
 * Pure so the caller supplies the randomness. `Retry-After` is not used: it is not a
 * CORS-safelisted header and this API exposes none, so it reads as null in a browser.
 * See docs/adr/0002-data-fetching-and-caching.md.
 */

/**
 * One full rate-limit window. This API's `Retry-After` counts down across requests
 * (10, 9, 6, 1), so a retry sooner than the window cannot succeed.
 */
export const RETRY_BASE_DELAY_MS = 10_000;

/** Spreads the twenty images a list page rate-limits at once. */
export const RETRY_JITTER_MS = 3000;

/** Caps the backoff before jitter. */
export const MAX_RETRY_DELAY_MS = 30_000;

/** Wait before retry `attempt` (0-based). `random` is a draw from [0, 1). */
export function retryDelayMs(attempt: number, random: number): number {
  const backoff = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);

  return backoff + Math.round(random * RETRY_JITTER_MS);
}
