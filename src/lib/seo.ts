/**
 * The values behind every page's <title>, description and canonical URL, so no route
 * writes the site name or the deployment origin as a literal.
 *
 * Bottom layer: this file imports nothing.
 */

export const SITE_NAME = 'Rick & Morty Character Explorer';

export const SITE_DESCRIPTION =
  'Browse Rick and Morty characters with status, species, origin, and episode details from the Rick and Morty API.';

/** The home page is the site name alone; every other page is `<page> · <site>`. */
export function pageTitle(title?: string): string {
  return title === undefined ? SITE_NAME : `${title} · ${SITE_NAME}`;
}

/**
 * `path` against the deployment origin.
 *
 * A missing VITE_SITE_URL yields a relative href rather than an absolute URL on the
 * wrong host. The deployment smoke run is what catches it.
 */
export function canonicalUrl(path: string): string {
  const origin = (import.meta.env.VITE_SITE_URL ?? '').replace(/\/+$/, '');

  return `${origin}${path}`;
}
