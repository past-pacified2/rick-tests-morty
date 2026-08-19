import { Link } from 'react-router';

// The zone rule exists so a component cannot fetch. This is `import type`, erased at
// compile time — no fetch, no module, nothing in the bundle. The rule has no
// allowTypeImports option, so the exemption has to be written here.
// eslint-disable-next-line import-x/no-restricted-paths
import type { Character } from '@/api/characters';
import { routes } from '@/lib/routes';

import { CharacterImage } from './CharacterImage';
import { CharacterStatusPill } from './CharacterStatusPill';

/**
 * One character, as a card in the list.
 *
 * The whole card is the link rather than the name alone: a 300px image with a
 * clickable 20px word inside it is a pointer target that punishes anyone who is not
 * precise with a mouse.
 */

export function CharacterCard({ character }: { character: Character }) {
  return (
    <Link
      to={routes.character(character.id)}
      className="flex h-full flex-col rounded-lg border border-slate-200 p-4 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
    >
      {/*
        alt="" on purpose. The name is adjacent text inside the same link, so a
        description here would be read out twice; the image carries no information the
        text does not.
      */}
      <CharacterImage src={character.image} alt="" loading="lazy" className="mb-3 rounded" />

      <h2 className="mb-2 text-xl font-medium">{character.name}</h2>

      <p className="mt-auto mb-1">
        <CharacterStatusPill status={character.status} />
      </p>

      <p className="text-sm text-slate-600 dark:text-slate-400">{character.species}</p>
    </Link>
  );
}
