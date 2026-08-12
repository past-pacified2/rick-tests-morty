import { useSearchParams } from 'react-router';

import { FetchError } from '@/api/characters';
import { useCharacters } from '@/hooks/useCharacters';
import { copyForStatus } from '@/lib/errors';
import { parsePageParam } from '@/lib/parsePageParam';

/**
 * Character list — the app's home route.
 *
 * The query's error is handled here rather than being allowed to reach the route's
 * errorElement. A failed fetch is a normal, recoverable state of a working page — the
 * heading and the layout are still correct and a retry is worth offering. The
 * errorElement exists for the case where the route itself cannot render at all, and
 * routing every network blip through it would replace a page that mostly works with a
 * full-region error (ADR-0005).
 */
export function CharactersRoute() {
  const [searchParams] = useSearchParams();
  const page = parsePageParam(searchParams.get('page'));
  const { data, isPending, isError, error, refetch } = useCharacters({ page });

  // Only the status is read off the error; the words come from src/lib/errors.ts and
  // never from the thrown value, which is written for a stack trace (ADR-0006).
  const copy = isError ? copyForStatus(error instanceof FetchError ? error.status : undefined) : undefined;

  return (
    <>
      <h1 className="text-2xl font-semibold">Characters</h1>

      {/* isPending, not `!data`: with keepPreviousData the previous page stays on
          screen while the next loads, and `!data` would blank the list every time. */}
      {isPending && (
        <p role="status" className="mt-3 text-slate-600 dark:text-slate-400">
          Loading characters…
        </p>
      )}

      {copy && (
        <div role="alert" className="mt-3">
          <p className="font-medium">{copy.title}</p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{copy.body}</p>
          {copy.recoverable && (
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {data && (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {data.results.map((character) => (
            <li key={character.id} className="py-2">
              {character.name}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// React Router's `lazy` reads route properties off the module namespace, and the
// property it looks for is `Component`. Aliasing keeps the function's real name in
// stack traces and React DevTools.
export { CharactersRoute as Component };
