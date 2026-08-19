import { Link } from 'react-router';

import { routes } from '@/lib/routes';

/**
 * The site-wide footer.
 *
 * It exists to carry the two pages a publicly reachable site is required to have, so
 * the links are the point and the rest is trim. The `<footer>` is a `contentinfo`
 * landmark, which is how a screen-reader user skips straight to it.
 *
 * The link palette is Pagination's, which is the one link colour in the repo — it
 * clears WCAG AA on both backgrounds, unlike the `text-blue-500` this project shipped
 * once and had to fix.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
        {/*
          A second navigation landmark needs its own name, otherwise a screen reader
          announces two indistinguishable "navigation" regions — the header's is
          labelled "Main".
        */}
        <nav aria-label="Legal" className="flex gap-4">
          <Link
            to={routes.imprint()}
            className="text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-100"
          >
            Legal notice
          </Link>
          <Link
            to={routes.privacy()}
            className="text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-100"
          >
            Data protection
          </Link>
        </nav>

        <p>
          Character data from the{' '}
          <a
            href="https://rickandmortyapi.com"
            className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
          >
            Rick and Morty API
          </a>
        </p>
      </div>
    </footer>
  );
}
