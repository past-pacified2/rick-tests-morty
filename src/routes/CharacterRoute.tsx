import { type MouseEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { z } from 'zod';

import { FetchError } from '@/api/characters';
import { CharacterProfile } from '@/components/CharacterProfile';
import { CharacterProfileSkeleton } from '@/components/CharacterProfileSkeleton';
import { useCharacter } from '@/hooks/useCharacter';
import { copyForStatus, NOT_FOUND } from '@/lib/errors';
import { canGoBack } from '@/lib/history';
import { routes } from '@/lib/routes';

/**
 * Character detail.
 *
 * When the fetch lands here, an id the API reports as absent renders an in-line
 * not-found message rather than an error page. See docs/adr/0005-routing-strategy.md.
 */
export function CharacterRoute() {
  const { id } = useParams();
  const navigate = useNavigate();

  const parsedId = z.coerce.number().int().positive().safeParse(id).data;

  const { data, isPending, isError, error, refetch } = useCharacter({ id: parsedId });

  const copy =
    parsedId === undefined
      ? NOT_FOUND
      : isError
        ? copyForStatus(error instanceof FetchError ? error.status : undefined)
        : undefined;

  const backToCharacters = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    if (canGoBack()) {
      e.preventDefault();
      void navigate(-1);
    }
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          onClick={backToCharacters}
          to={routes.home()}
          className="cursor-pointer text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-100"
        >
          Back to characters
        </Link>
      </nav>

      {parsedId !== undefined && isPending && (
        <div role="status">
          <span className="sr-only">Loading character…</span>
          <CharacterProfileSkeleton />
        </div>
      )}

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
        </div>
      )}
      {data && <CharacterProfile character={data} />}
    </>
  );
}

export { CharacterRoute as Component };
