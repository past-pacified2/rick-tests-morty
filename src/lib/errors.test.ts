import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { copyForStatus, type ErrorCopy, NOT_FOUND, REQUEST_FAILED, RATE_LIMIT_EXCEEDED, UNEXPECTED } from './errors';

describe('copyForStatus', () => {
  /**
   * Each case is named for the situation it represents rather than for its number,
   * because the number is the input and the situation is what must not regress.
   */
  const cases: readonly (readonly [string, number | undefined, ErrorCopy])[] = [
    ['a failure that never reached the network', undefined, UNEXPECTED],
    ['a missing character or unknown route', 404, NOT_FOUND],
    ['a rate limit exceeded', 429, RATE_LIMIT_EXCEEDED],
    ['a server error', 500, REQUEST_FAILED],
    ['an upstream gateway failure', 502, REQUEST_FAILED],
    ['an overloaded or rate-limited API', 503, REQUEST_FAILED],
    ['a malformed request', 400, UNEXPECTED],
    ['an unauthenticated request', 401, UNEXPECTED],
    ['a forbidden request', 403, UNEXPECTED],
    ['a success status arriving where an error was expected', 200, UNEXPECTED],
  ];

  for (const [description, status, expected] of cases) {
    it(`maps ${description} to "${expected.title}"`, () => {
      expect(copyForStatus(status)).toBe(expected);
    });
  }

  it('treats every 5xx as a retryable request failure', () => {
    fc.assert(
      fc.property(fc.integer({ min: 500, max: 599 }), (status) => {
        expect(copyForStatus(status)).toBe(REQUEST_FAILED);
      }),
    );
  });

  it('treats every non-404/429 status below 500 as unexpected', () => {
    const excludedStatuses = [404, 429];

    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 499 }).filter((status) => !excludedStatuses.includes(status)),
        (status) => {
          expect(copyForStatus(status)).toBe(UNEXPECTED);
        },
      ),
    );
  });

  /**
   * Totality. Whatever a route throws, the boundary has something to render — there
   * is no status for which the user is shown an empty page or the word "undefined".
   */
  it('always returns copy with a title and a body', () => {
    fc.assert(
      fc.property(fc.option(fc.integer(), { nil: undefined }), (status) => {
        const copy = copyForStatus(status);
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.body.length).toBeGreaterThan(0);
      }),
    );
  });
});

describe('the copy itself', () => {
  /**
   * A retry button is only honest when retrying could plausibly work. Offering one on
   * a 404 invites the user to hammer a URL that will never exist.
   */
  it('offers a retry only for the recoverable case', () => {
    expect(REQUEST_FAILED.recoverable).toBe(true);
    expect(NOT_FOUND.recoverable).toBe(false);
    expect(RATE_LIMIT_EXCEEDED.recoverable).toBe(true);
    expect(UNEXPECTED.recoverable).toBe(false);
  });

  /**
   * The boundary renders these strings verbatim. Anything resembling a stack trace,
   * an exception name or an internal identifier reaching this file is a leak — see
   * docs/adr/0006-security.md.
   */
  it('never mentions internals a user cannot act on', () => {
    const forbidden = /error:|exception|stack|undefined|null|\bat \w+\(/i;

    for (const copy of [NOT_FOUND, REQUEST_FAILED, RATE_LIMIT_EXCEEDED, UNEXPECTED]) {
      expect(copy.title.trim()).not.toBe('');
      expect(copy.body.trim()).not.toBe('');
      expect(copy.title).not.toMatch(forbidden);
      expect(copy.body).not.toMatch(forbidden);
    }
  });
});
