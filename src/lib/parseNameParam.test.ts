import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { parseNameParam } from './parseNameParam';

const parseNameParamTestCases: { input: string | null; expected: string }[] = [
  { input: null, expected: '' },
  { input: '   ', expected: '' },
  { input: '', expected: '' },
  { input: 'John Doe', expected: 'John Doe' },
  { input: '  John Doe  ', expected: 'John Doe' },
];

describe('parseNameParam', () => {
  it.each(parseNameParamTestCases)('returns $expected for $input', ({ input, expected }) => {
    expect(parseNameParam(input)).toBe(expected);
  });
});

/**
 * A search term arrives from the URL, so the input is whatever someone typed or pasted.
 * The table above only proves the cases somebody thought of.
 */
describe('parseNameParam, for any input at all', () => {
  /**
   * Padded on both sides on purpose: trimming is the whole of this parser, so an
   * arbitrary that never produces surrounding whitespace never exercises it. `\u00a0`
   * is in the set because a non-breaking space is invisible in an address bar and is
   * still whitespace to `String.prototype.trim`.
   */
  const padding = fc.constantFrom('', ' ', '   ', '\t', '\n', '\r\n', '\u00a0');
  const anyNameParam = fc.oneof(
    fc.constant(null),
    fc.tuple(padding, fc.string(), padding).map(([before, term, after]) => `${before}${term}${after}`),
  );

  it('never yields a term with whitespace around it', () => {
    fc.assert(
      fc.property(anyNameParam, (input) => {
        const name = parseNameParam(input);

        expect(name).toBe(name.trim());
      }),
    );
  });

  /**
   * The term is parsed out of the URL and written back into it on every keystroke that
   * settles, so parsing an already-parsed term has to be a no-op or the search would
   * drift a character at a time.
   */
  it('is idempotent', () => {
    fc.assert(
      fc.property(anyNameParam, (input) => {
        const name = parseNameParam(input);

        expect(parseNameParam(name)).toBe(name);
      }),
    );
  });

  it('never invents a term that was not in the URL', () => {
    fc.assert(
      fc.property(anyNameParam, (input) => {
        const name = parseNameParam(input);

        expect(input === null ? name === '' : input.includes(name)).toBe(true);
      }),
    );
  });
});
