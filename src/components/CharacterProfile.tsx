// The zone rule exists so a component cannot fetch. This is `import type`, erased at
// compile time — no fetch, no module, nothing in the bundle. The rule has no
// allowTypeImports option, so the exemption has to be written here.
// eslint-disable-next-line import-x/no-restricted-paths
import type { Character } from '@/api/characters';

import { CharacterStatusPill } from './CharacterStatusPill';

/**
 * One character, in full.
 *
 * The facts are a <dl> rather than rows of <p>: each one is a label and its value, and
 * the element that says so gives a test `getByRole('term')` / `getByRole('definition')`
 * instead of matching a bare string that could have come from anywhere on the page.
 */
export function CharacterProfile({ character }: { character: Character }) {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr] md:items-start">
        {/*
          alt="" on purpose, for the same reason as the card: the name is adjacent text,
          so a description here would be read out twice and the image carries no
          information the text does not.
        */}
        <img
          src={character.image}
          alt=""
          width={320}
          height={320}
          className="mx-auto aspect-square w-full max-w-72 rounded-2xl object-cover"
        />

        <div>
          <h1 className="mb-4 text-2xl leading-none font-semibold md:mb-6">{character.name}</h1>

          <dl className="grid gap-3">
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Status</dt>
              <dd>
                <CharacterStatusPill status={character.status} />
              </dd>
            </div>

            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Species</dt>
              <dd>{character.species}</dd>
            </div>

            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Gender</dt>
              <dd>{character.gender}</dd>
            </div>

            {character.type && (
              <div className="grid grid-cols-[6rem_1fr] gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Type</dt>
                <dd>{character.type}</dd>
              </div>
            )}

            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Origin</dt>
              <dd>{character.origin.name}</dd>
            </div>

            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Location</dt>
              <dd>{character.location.name}</dd>
            </div>

            {/*
              The count, not the list. `episode` is an array of URLs — rendering them
              would mean 51 more requests to turn each into a title, and the schema
              already gives the number for free.
            */}
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Episodes</dt>
              <dd>{character.episode.length}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}
