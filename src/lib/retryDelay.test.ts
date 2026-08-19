import { describe, expect, it } from 'vitest';

import { MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS, RETRY_JITTER_MS, retryDelayMs } from './retryDelay';

/**
 * Expectations are literal numbers, not expressions over the same constants the
 * implementation uses — those pass whatever either side says.
 */
describe('retryDelayMs', () => {
  const cases = [
    { name: 'the first attempt with no jitter', attempt: 0, random: 0, expected: 10_000 },
    { name: 'the first attempt with half jitter', attempt: 0, random: 0.5, expected: 11_500 },
    { name: 'the second attempt', attempt: 1, random: 0, expected: 20_000 },
    { name: 'the third attempt, already at the cap', attempt: 2, random: 0, expected: 30_000 },
    { name: 'a rounded jitter', attempt: 0, random: 0.3333, expected: 11_000 },
  ];

  it.each(cases)('waits $expected ms for $name', ({ attempt, random, expected }) => {
    expect(retryDelayMs(attempt, random)).toBe(expected);
  });

  it('caps the backoff but still adds jitter on top', () => {
    expect(retryDelayMs(20, 0)).toBe(30_000);
    expect(retryDelayMs(20, 1)).toBe(33_000);
  });

  /** Twenty images that fail on one tick must not retry on one tick. */
  it('spreads two callers that failed together', () => {
    expect(retryDelayMs(0, 0)).not.toBe(retryDelayMs(0, 0.9));
  });

  /** Jitter perturbs the window; a jitter near the base would decide the wait. */
  it('keeps the jitter a perturbation of the base delay rather than a rival to it', () => {
    expect(RETRY_JITTER_MS).toBeGreaterThan(0);
    expect(RETRY_JITTER_MS).toBeLessThan(RETRY_BASE_DELAY_MS);
    expect(MAX_RETRY_DELAY_MS).toBeGreaterThan(RETRY_BASE_DELAY_MS);
  });

  /** The 429 window is 10s from the first rejection; a sooner retry cannot succeed. */
  it('waits a full rate-limit window before the first retry, even with no jitter', () => {
    expect(retryDelayMs(0, 0)).toBeGreaterThanOrEqual(10_000);
  });
});
