import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo';
import { canonicalHref, headTagCount, metaContent } from '@/test/head';

import { Seo } from './Seo';

describe('Seo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('titles the home page with the site name alone', () => {
    render(<Seo path="/" />);

    expect(document.title).toBe(SITE_NAME);
    expect(metaContent('description')).toBe(SITE_DESCRIPTION);
  });

  it('suffixes a page title and takes the description its caller gives', () => {
    render(<Seo title="Legal notice" description="Who runs this site." path="/impressum" />);

    expect(document.title).toBe(`Legal notice · ${SITE_NAME}`);
    expect(metaContent('description')).toBe('Who runs this site.');
  });

  it('resolves the canonical URL against the deployment origin', () => {
    vi.stubEnv('VITE_SITE_URL', 'https://example.test');

    render(<Seo path="/privacy" />);

    expect(canonicalHref()).toBe('https://example.test/privacy');
  });

  it('lets a page be indexed by default', () => {
    render(<Seo path="/" />);

    expect(metaContent('robots')).toBe('index, follow');
  });

  it('keeps a noindex page out of the index but still follows its links', () => {
    render(<Seo path="/" noindex />);

    expect(metaContent('robots')).toBe('noindex, follow');
  });

  /** React appends to <head> rather than replacing, so a duplicate would survive. */
  it('leaves exactly one canonical and one description in the document', () => {
    render(<Seo path="/" />);

    expect(headTagCount('link[rel="canonical"]')).toBe(1);
    expect(headTagCount('meta[name="description"]')).toBe(1);
    expect(headTagCount('title')).toBe(1);
  });
});
