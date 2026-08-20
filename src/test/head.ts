/**
 * Reads the metadata React hoists into `<head>`.
 *
 * Head tags have no accessible representation, so no Testing Library query reaches them.
 */

export const metaContent = (name: string): string | null | undefined =>
  document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

export const canonicalHref = (): string | null | undefined =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

export const headTagCount = (selector: string): number => document.head.querySelectorAll(selector).length;
