import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { copyForStatus } from '@/lib/errors';
import { routes } from '@/lib/routes';

/**
 * The `errorElement` for every route.
 *
 * React Router renders errors to the *nearest* boundary, so declaring this per route
 * as well as at the root is what limits the blast radius of a crash to one region of
 * the page rather than the whole document.
 *
 * `useRouteError()` returns `unknown` — deliberately, because anything can be thrown.
 * The only thing read off it is the status code from a router-thrown response; the
 * message the user sees comes from src/lib/errors.ts and never from the error itself.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const copy = copyForStatus(status);

  // The real error still has to go somewhere a developer can find it. In production
  // this is where an error reporter would be called.
  //
  // In an effect rather than the render body: React may start a render and throw it
  // away, and a discarded render must not have logged anything. Nothing here can catch
  // a regression of that — the counts are identical either way, twice under StrictMode
  // and once without, and RouterProvider memoizes this subtree so a parent re-render
  // never re-invokes it. It rests on the rule, not on a test.
  useEffect(() => {
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-prose py-12 text-center">
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">{copy.body}</p>

      <div className="mt-6 flex justify-center gap-3">
        {copy.recoverable && (
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Try again
          </button>
        )}
        <Link
          to={routes.home()}
          className="rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Back to characters
        </Link>
      </div>
    </div>
  );
}
