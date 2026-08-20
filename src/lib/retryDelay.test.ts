import { describe, expect, it } from 'vitest';

import {
  RATE_LIMIT_MAX_RETRY_DELAY_MS,
  RATE_LIMIT_RETRY_BASE_DELAY_MS,
  RATE_LIMIT_RETRY_JITTER_MS,
  rateLimitRetryDelayMs,
  TRANSIENT_BASE_DELAY_MS,
  MAX_TRANSIENT_DELAY_MS,
  TRANSIENT_JITTER_MS,
  transientRetryDelayMs,
} from './retryDelay';

/**
 * Expectations are literal numbers, not expressions over the same constants the
 * implementation uses — those pass whatever either side says.
 */
describe('rateLimitRetryDelayMs', () => {
  const cases = [
    { name: 'the first attempt with no jitter', attempt: 0, random: 0, expected: 10_000 },
    { name: 'the first attempt with half jitter', attempt: 0, random: 0.5, expected: 11_500 },
    { name: 'the second attempt', attempt: 1, random: 0, expected: 20_000 },
    { name: 'the third attempt, already at the cap', attempt: 2, random: 0, expected: 30_000 },
    { name: 'a rounded jitter', attempt: 0, random: 0.3333, expected: 11_000 },
  ];

  it.each(cases)('waits $expected ms for $name', ({ attempt, random, expected }) => {
    expect(rateLimitRetryDelayMs(attempt, random)).toBe(expected);
  });

  it('caps the backoff but still adds jitter on top', () => {
    expect(rateLimitRetryDelayMs(20, 0)).toBe(30_000);
    expect(rateLimitRetryDelayMs(20, 1)).toBe(33_000);
  });

  /** Twenty images that fail on one tick must not retry on one tick. */
  it('spreads two callers that failed together', () => {
    expect(rateLimitRetryDelayMs(0, 0)).not.toBe(rateLimitRetryDelayMs(0, 0.9));
  });

  /** Jitter perturbs the window; a jitter near the base would decide the wait. */
  it('keeps the jitter a perturbation of the base delay rather than a rival to it', () => {
    expect(RATE_LIMIT_RETRY_JITTER_MS).toBeGreaterThan(0);
    expect(RATE_LIMIT_RETRY_JITTER_MS).toBeLessThan(RATE_LIMIT_RETRY_BASE_DELAY_MS);
    expect(RATE_LIMIT_MAX_RETRY_DELAY_MS).toBeGreaterThan(RATE_LIMIT_RETRY_BASE_DELAY_MS);
  });

  /** The 429 window is 10s from the first rejection; a sooner retry cannot succeed. */
  it('waits a full rate-limit window before the first retry, even with no jitter', () => {
    expect(rateLimitRetryDelayMs(0, 0)).toBeGreaterThanOrEqual(10_000);
  });
});

describe('transientRetryDelayMs', () => {
  const cases = [
    { name: 'the first attempt with no jitter', attempt: 0, random: 0, expected: 500 },
    { name: 'the first attempt with half jitter', attempt: 0, random: 0.5, expected: 625 },
    { name: 'the second attempt', attempt: 1, random: 0, expected: 1000 },
    { name: 'the third attempt, already at the cap', attempt: 20, random: 0, expected: 5000 },
    { name: 'a rounded jitter', attempt: 20, random: 1, expected: 5250 },
  ];

  it.each(cases)('waits $expected ms for $name', ({ attempt, random, expected }) => {
    expect(transientRetryDelayMs(attempt, random)).toBe(expected);
  });

  it('caps the backoff but still adds jitter on top', () => {
    expect(transientRetryDelayMs(20, 0)).toBe(5_000);
    expect(transientRetryDelayMs(20, 1)).toBe(5_250);
  });

  /** Jitter perturbs the window; a jitter near the base would decide the wait. */
  it('keeps the jitter a perturbation of the base delay rather than a rival to it', () => {
    expect(TRANSIENT_JITTER_MS).toBeGreaterThan(0);
    expect(TRANSIENT_JITTER_MS).toBeLessThan(TRANSIENT_BASE_DELAY_MS);
    expect(MAX_TRANSIENT_DELAY_MS).toBeGreaterThan(TRANSIENT_BASE_DELAY_MS);
  });
});
