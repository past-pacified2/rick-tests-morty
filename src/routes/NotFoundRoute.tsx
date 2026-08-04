import { Link } from 'react-router';

import { NOT_FOUND } from '@/lib/errors';
import { routes } from '@/lib/routes';

/**
 * The `*` route.
 *
 * Shares its copy with the error boundary's 404 case, so "not found" reads
 * identically whether the user typed a bad URL or a character id came back absent.
 *
 * Known limitation: this is a client-rendered SPA, so the HTTP status a crawler
 * receives is 200 no matter what renders here. See docs/adr/0005-routing-strategy.md.
 */
export function NotFoundRoute() {
  return (
    <div className="mx-auto max-w-prose py-12 text-center">
      <h1 className="text-2xl font-semibold">{NOT_FOUND.title}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">{NOT_FOUND.body}</p>
      <Link
        to={routes.home()}
        className="mt-6 inline-block rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Back to characters
      </Link>
    </div>
  );
}

export { NotFoundRoute as Component };
