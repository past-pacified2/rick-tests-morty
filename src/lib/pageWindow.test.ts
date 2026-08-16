import { it, expect, describe } from 'vitest';

import { pageWindow } from './pageWindow';

describe('pageWindow', () => {
  const elipsisTestCases = [
    { page: 1, pages: 10, radius: undefined, expected: [1, 2, 3, 4, 5, 10] },
    { page: 3, pages: 10, radius: undefined, expected: [1, 2, 3, 4, 5, 10] }, // no duplicate 1, start is already 1
    { page: 5, pages: 10, radius: undefined, expected: [1, 3, 4, 5, 6, 7, 10] },
    { page: 10, pages: 10, radius: undefined, expected: [1, 6, 7, 8, 9, 10] }, // window shifted back, still 5 wide
    { page: 99, pages: 10, radius: undefined, expected: [1, 6, 7, 8, 9, 10] },
    { page: 2, pages: 3, radius: undefined, expected: [1, 2, 3] }, // no gaps at all
    { page: 1, pages: 0, radius: undefined, expected: [] },
    { page: 1, pages: 1, radius: undefined, expected: [1] },

    { page: 5, pages: 10, radius: 0, expected: [1, 5, 10] },
    { page: 5, pages: 10, radius: 1, expected: [1, 4, 5, 6, 10] },
    { page: 5, pages: 10, radius: 5, expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, // window wider than the list, still no duplicate first/last
  ];

  it.each(elipsisTestCases)(
    'should return the correct window for page $page and pages $pages',
    ({ page, pages, radius, expected }) => {
      expect(pageWindow(page, pages, radius)).toEqual(expected);
    },
  );
});
