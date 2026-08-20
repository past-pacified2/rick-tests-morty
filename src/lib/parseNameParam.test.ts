import { describe, it, expect } from 'vitest';

import { parseNameParam } from './parseNameParam';

const parseNameParamTestCases: { input: string | null; expected: string }[] = [
  { input: null, expected: '' },
  { input: '   ', expected: '' },
  { input: '', expected: '' },
  { input: 'John Doe', expected: 'John Doe' },
  { input: '  John Doe  ', expected: 'John Doe' },
];

describe('parsePageParam', () => {
  it.each(parseNameParamTestCases)('returns $expected for $input', ({ input, expected }) => {
    expect(parseNameParam(input)).toBe(expected);
  });
});
