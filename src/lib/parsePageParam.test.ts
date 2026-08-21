import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { parsePageParam } from './parsePageParam';

const parsePageParamTestCases: { input: string | null; expected: number }[] = [
  { input: null, expected: 1 },
  { input: '   ', expected: 1 },
  { input: '0x1', expected: 1 },
  { input: '', expected: 1 },
  { input: '-1', expected: 1 },
  { input: '0', expected: 1 },
  { input: 'invalid', expected: 1 },
  { input: '1', expected: 1 },
  { input: '2', expected: 2 },
  { input: ' 3', expected: 3 },
  { input: '5   ', expected: 5 },
  { input: '+5', expected: 1 },
  { input: '6\n', expected: 6 },
  { input: '7\t', expected: 7 },
  { input: '8\r', expected: 8 },
  { input: '9\b', expected: 1 },
  { input: '10\f', expected: 10 },
  { input: '11\v', expected: 11 },
  { input: '12\u000C', expected: 12 },
  { input: '13\u000D', expected: 13 },
  { input: '2.5', expected: 1 },
  { input: '2,5', expected: 1 },
  { input: 'abc', expected: 1 },
  { input: '2abc', expected: 1 },
  { input: 'abc2', expected: 1 },
  { input: '2abc2', expected: 1 },
  { input: '1e3', expected: 1 },
  { input: '1.5e3', expected: 1 },
  { input: '1.5e+3', expected: 1 },
  { input: '1.5e-3', expected: 1 },
  { input: 'NaN', expected: 1 },
  { input: '-Infinity', expected: 1 },
  { input: 'Infinity', expected: 1 },
];

describe('parsePageParam', () => {
  it.each(parsePageParamTestCases)('returns $expected for $input', ({ input, expected }) => {
    expect(parsePageParam(input)).toBe(expected);
  });
});

/**
 * A page number arrives from the URL, so the input is whatever someone typed, a crawler
 * followed, or a fuzzer sent. The table above only proves the cases somebody thought of.
 */
describe('parsePageParam, for any input at all', () => {
  /**
   * Weighted towards the shapes a page param takes rather than uniform noise.
   *
   * The digits are built by length rather than with `fc.stringMatching(/^\d{1,400}$/)`,
   * which samples hard towards the short end and never reached the region that matters:
   * long digit strings are exactly where a `\d+` match and a double stop agreeing.
   */
  const digitString = fc
    .array(fc.integer({ min: 0, max: 9 }).map(String), { minLength: 1, maxLength: 400, size: 'max' })
    .map((digits) => digits.join(''));

  const anyPageParam = fc.oneof(
    fc.constant(null),
    fc.string(),
    fc.string({ maxLength: 500 }),
    digitString,
    fc.integer().map(String),
    fc.double().map(String),
  );

  it('yields a page the app can actually ask for', () => {
    fc.assert(
      fc.property(anyPageParam, (input) => {
        const page = parsePageParam(input);

        expect(Number.isSafeInteger(page)).toBe(true);
        expect(page).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  /**
   * The parsed page is written straight back into a URL by `routes.charactersPage`, and
   * that URL is parsed again on the next navigation. A value that does not survive the
   * round trip is a page the user can reach once and never again.
   */
  it('round-trips through the URL it gets written back into', () => {
    fc.assert(
      fc.property(anyPageParam, (input) => {
        const page = parsePageParam(input);

        expect(parsePageParam(String(page))).toBe(page);
      }),
    );
  });

  it('leaves a page number that was already valid alone', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), (page) => {
        expect(parsePageParam(String(page))).toBe(page);
      }),
    );
  });
});
