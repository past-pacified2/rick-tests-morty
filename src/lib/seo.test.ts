import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalUrl, pageTitle, SITE_NAME, SITE_DESCRIPTION } from './seo';

describe('pageTitle', () => {
  it('is the site name alone for the home page', () => {
    expect(pageTitle()).toBe(SITE_NAME);
  });

  it('suffixes every other page with the site name', () => {
    expect(pageTitle('Legal notice')).toBe(`Legal notice · ${SITE_NAME}`);
  });
});

describe('canonicalUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const cases = [
    { name: 'joins the origin and the path', origin: 'https://example.test', path: '/privacy' },
    { name: 'does not double the slash', origin: 'https://example.test/', path: '/privacy' },
    { name: 'strips repeated trailing slashes', origin: 'https://example.test///', path: '/privacy' },
  ];

  it.each(cases)('$name', ({ origin, path }) => {
    vi.stubEnv('VITE_SITE_URL', origin);

    expect(canonicalUrl(path)).toBe('https://example.test/privacy');
  });

  /**
   * A relative href rather than an absolute URL on a wrong host. The deployment smoke
   * run is what fails on it; nothing here can tell what the origin should have been.
   */
  it('falls back to the path when the site URL is unset', () => {
    vi.stubEnv('VITE_SITE_URL', undefined);

    expect(canonicalUrl('/privacy')).toBe('/privacy');
  });
});

describe('site description', () => {
  /**
   * The description is used in the meta tag as a fallback of the page description.
   * It should be long enough to be meaningful but short enough not to get truncated
   * in a search result.
   */
  it('uses a meta description that fits what a search result would render', () => {
    expect(SITE_DESCRIPTION.length).toBeGreaterThan(50);
    expect(SITE_DESCRIPTION.length).toBeLessThan(160);
  });
});
