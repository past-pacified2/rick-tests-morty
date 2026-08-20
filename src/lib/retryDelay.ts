/**
 * Jittered backoff, used by the query client and CharacterImage.
 *
 * Two policies, because a rate limit and a dead socket want opposite waits:
 * - A rate limit backs off a full window, up to 30 seconds.
 * - Anything else — a lost connection, a 5xx — backs off in under 5 seconds, because
 *   nothing about it says the next attempt has to wait.
 *
 * Which policy applies is queryClient.ts's call, as is whether to retry at all.
 * Both functions are pure, so the caller supplies the randomness.
 */

/**
 * One full rate-limit window. This API's `Retry-After` counts down across requests
 * (10, 9, 6, 1), so a retry sooner than the window cannot succeed.
 */
export const RATE_LIMIT_RETRY_BASE_DELAY_MS = 10_000;

/** Spreads the twenty images a list page rate-limits at once. */
export const RATE_LIMIT_RETRY_JITTER_MS = 3000;

/** Caps the backoff before jitter. */
export const RATE_LIMIT_MAX_RETRY_DELAY_MS = 30_000;

/**
 * The delay for a rate limit.
 *
 * Pure so the caller supplies the randomness. `Retry-After` is not used: it is not a
 * CORS-safelisted header and this API exposes none, so it reads as null in a browser.
 * See docs/adr/0002-data-fetching-and-caching.md.
 */
/** Wait before retry `attempt` (0-based). `random` is a draw from [0, 1). */
export function rateLimitRetryDelayMs(attempt: number, random: number): number {
  const backoff = Math.min(RATE_LIMIT_RETRY_BASE_DELAY_MS * 2 ** attempt, RATE_LIMIT_MAX_RETRY_DELAY_MS);

  return backoff + Math.round(random * RATE_LIMIT_RETRY_JITTER_MS);
}

/** Everything that is not a rate limit: a dead socket, a 5xx. Retried in under a second. */
export const TRANSIENT_BASE_DELAY_MS = 500;
export const TRANSIENT_JITTER_MS = 250;
export const MAX_TRANSIENT_DELAY_MS = 5000;

export function transientRetryDelayMs(attempt: number, random: number): number {
  const backoff = Math.min(TRANSIENT_BASE_DELAY_MS * 2 ** attempt, MAX_TRANSIENT_DELAY_MS);
  return backoff + Math.round(random * TRANSIENT_JITTER_MS);
}
