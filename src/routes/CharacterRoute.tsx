import { type MouseEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { z } from 'zod';

import { CharacterProfile } from '@/components/CharacterProfile';
import { CharacterProfileSkeleton } from '@/components/CharacterProfileSkeleton';
import { ErrorPanel } from '@/components/ErrorPanel';
import { Seo } from '@/components/Seo';
import { useCharacter } from '@/hooks/useCharacter';
import { FetchError } from '@/lib/errors';
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
      <Seo
        title={data?.name ?? 'Character'}
        description={data && `${data.name} — ${data.species}, ${data.status}, from ${data.origin.name}.`}
        path={parsedId === undefined ? routes.home() : routes.character(parsedId)}
        noindex={copy !== undefined}
      />

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

      {/* h1: nothing but a breadcrumb is on screen until the character arrives. */}
      {copy && (
        <ErrorPanel
          copy={copy}
          titleAs="h1"
          onRetry={() => {
            void refetch();
          }}
        />
      )}
      {data && <CharacterProfile character={data} />}
    </>
  );
}

export { CharacterRoute as Component };
