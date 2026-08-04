import fc from 'fast-check';
import { matchPath } from 'react-router';
import { describe, expect, it } from 'vitest';

import { patterns, routes } from './routes';

/**
 * Two halves of one idea are under test here:
 *
 *   - the example tables document the cases someone thought of, each named for the
 *     failure mode it protects against;
 *   - the properties describe what must hold for *every* input, and find the cases
 *     nobody thought of.
 *
 * Neither replaces the other. When a property fails, fast-check prints a shrunk
 * counterexample — paste it into the table above as a permanent regression case.
 */

describe('static routes', () => {
  it('resolves home to the site root', () => {
    expect(routes.home()).toBe('/');
  });

  it('resolves the fatal error route to /500', () => {
    expect(routes.fatalError()).toBe('/500');
  });
});

describe('routes.character', () => {
  /**
   * An id reaches this function from an API response or from a user-editable URL.
   * Every case below is a way an unescaped id could rewrite the path it is supposed
   * to be a segment of.
   */
  const cases: readonly (readonly [string, number | string, string])[] = [
    ['a plain numeric id', 42, '/character/42'],
    ['a numeric id passed as a string', '42', '/character/42'],
    ['an id containing a slash', 'a/b', '/character/a%2Fb'],
    ['an id containing a query separator', 'a?b', '/character/a%3Fb'],
    ['an id containing a fragment separator', 'a#b', '/character/a%23b'],
    ['an id containing a space', 'a b', '/character/a%20b'],
    ['a traversal attempt', '../admin', '/character/..%2Fadmin'],
    ['a non-ASCII id', 'Ünïcøde', '/character/%C3%9Cn%C3%AFc%C3%B8de'],
    ['an empty id', '', '/character/'],
  ];

  for (const [description, id, expected] of cases) {
    it(`encodes ${description}`, () => {
      expect(routes.character(id)).toBe(expected);
    });
  }

  it('always produces exactly one segment after /character', () => {
    fc.assert(
      fc.property(fc.string(), (id) => {
        // Three parts because the path is absolute: ['', 'character', <id>].
        expect(routes.character(id).split('/')).toHaveLength(3);
      }),
    );
  });

  it('round-trips any id through the encoded segment', () => {
    fc.assert(
      fc.property(fc.string(), (id) => {
        const segment = routes.character(id).split('/')[2];
        expect(decodeURIComponent(segment ?? '')).toBe(id);
      }),
    );
  });

  /**
   * The reason patterns and routes are separate objects is that they must never
   * disagree — a pattern the router matches on, a URL a link points at. This asserts
   * the agreement using React Router's own matcher, so renaming one half without the
   * other fails here rather than as a dead link in production.
   */
  it('produces URLs that the route pattern matches', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), (id) => {
        const match = matchPath(patterns.character, routes.character(id));
        expect(match?.params.id).toBe(String(id));
      }),
    );
  });
});
