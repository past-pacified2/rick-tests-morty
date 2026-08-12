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
