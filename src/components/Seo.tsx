import { canonicalUrl, pageTitle, SITE_DESCRIPTION } from '@/lib/seo';

/**
 * A route's <title>, description, canonical URL and robots directive.
 *
 * React 19 appends these to <head> rather than replacing what is already there, so
 * index.html carries none of them (docs/adr/0008-seo-and-page-metadata.md).
 */
export function Seo({
  title,
  description = SITE_DESCRIPTION,
  path,
  noindex = false,
}: {
  title?: string | undefined;
  description?: string | undefined;
  path: string;
  noindex?: boolean;
}) {
  return (
    <>
      <title>{pageTitle(title)}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl(path)} />
      <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />
    </>
  );
}
