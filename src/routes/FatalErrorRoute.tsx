import { Link } from 'react-router';

import { UNEXPECTED } from '@/lib/errors';
import { routes } from '@/lib/routes';

/**
 * `/500` — a real, linkable URL for unrecoverable application errors.
 *
 * Distinct from the error boundary, which renders *in place* when a route throws.
 * This is somewhere code can navigate to when there is no useful place to stay.
 *
 * API failures deliberately do not come here: they are recoverable, and navigating
 * away would discard the user's page and filters. See docs/adr/0005-routing-strategy.md.
 */
export function FatalErrorRoute() {
  return (
    <div className="mx-auto max-w-prose py-12 text-center">
      <h1 className="text-2xl font-semibold">{UNEXPECTED.title}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">{UNEXPECTED.body}</p>
      <Link
        to={routes.home()}
        className="mt-6 inline-block rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Back to characters
      </Link>
    </div>
  );
}

export { FatalErrorRoute as Component };
