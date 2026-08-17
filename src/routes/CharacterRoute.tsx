import { useParams, Link } from 'react-router';
import { z } from 'zod';

import { FetchError } from '@/api/characters';
import { useCharacter } from '@/hooks/useCharacter';
import { copyForStatus, NOT_FOUND } from '@/lib/errors';
import { routes } from '@/lib/routes';

/**
 * Character detail.
 *
 * When the fetch lands here, an id the API reports as absent must render the
 * not-found route rather than an error page. See docs/adr/0005-routing-strategy.md.
 */
export function CharacterRoute() {
  const { id } = useParams();

  const parsedId = z.coerce.number().int().positive().safeParse(id).data;

  const { data, isPending, isError, error, refetch } = useCharacter({ id: parsedId });

  const copy =
    parsedId === undefined
      ? NOT_FOUND
      : isError
        ? copyForStatus(error instanceof FetchError ? error.status : undefined)
        : undefined;

  if (parsedId !== undefined && isPending) {
    return <div>Loading...</div>;
  }

  return (
    <>
      {copy && (
        <div role="alert" className="mt-3">
          <h1 className="text-2xl font-semibold">{copy.title}</h1>
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
          <Link
            to={routes.home()}
            className="mt-6 inline-block rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Back to characters
          </Link>
        </div>
      )}
      {data && (
        <>
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">Character details will render here.</p>
        </>
      )}
    </>
  );
}

export { CharacterRoute as Component };
