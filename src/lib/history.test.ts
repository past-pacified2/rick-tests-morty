import { describe, expect, it, beforeEach } from 'vitest';

import { canGoBack } from './history';

const TEST_CASES = [
  { replacement: { idx: 1 }, expected: true },
  { replacement: { idx: 0 }, expected: false },
  { replacement: { idx: -1 }, expected: false },
  { replacement: { idx: Infinity }, expected: true },
  { replacement: { idx: -Infinity }, expected: false },
  { replacement: { idx: NaN }, expected: false },
  { replacement: { idx: 'string' }, expected: false },
  { replacement: { idx: '2' }, expected: false },
  { replacement: { idx: '0x001' }, expected: false },
  { replacement: null, expected: false },
  { replacement: undefined, expected: false },
  { replacement: 'string', expected: false },
  { replacement: 1, expected: false },
  { replacement: true, expected: false },
  { replacement: false, expected: false },
  { replacement: [], expected: false },
];

describe('canGoBack', () => {
  beforeEach(() => {
    window.history.replaceState(null, '');
  });

  it.each(TEST_CASES)('returns $expected if the history state is $replacement', ({ replacement, expected }) => {
    window.history.replaceState(replacement, '');
    expect(canGoBack()).toBe(expected);
  });
});
