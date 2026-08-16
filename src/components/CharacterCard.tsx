import { Link } from 'react-router';

// The zone rule exists so a component cannot fetch. This is `import type`, erased at
// compile time — no fetch, no module, nothing in the bundle. The rule has no
// allowTypeImports option, so the exemption has to be written here.
// eslint-disable-next-line import-x/no-restricted-paths
import type { Character } from '@/api/characters';
import { routes } from '@/lib/routes';

/**
 * One character, as a card in the list.
 *
 * The whole card is the link rather than the name alone: a 300px image with a
 * clickable 20px word inside it is a pointer target that punishes anyone who is not
 * precise with a mouse.
 */

/**
 * Status colours, keyed by the exact union the schema parses.
 *
 * A Record over a literal union rather than a lookup with a fallback — a new status in
 * the API becomes a Zod parse failure and a type error here, not a silently unstyled
 * pill.
 *
 * The strings are written out in full because Tailwind scans source text and never
 * runs it: `bg-${colour}-500/15` produces no CSS at all.
 */
const statusClasses: Record<Character['status'], string> = {
  Alive: 'bg-green-500/15 text-green-800 dark:text-green-400',
  Dead: 'bg-red-500/15 text-red-800 dark:text-red-400',
  unknown: 'bg-violet-500/15 text-violet-800 dark:text-violet-400',
};

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
      <img
        src={character.image}
        alt=""
        width={300}
        height={300}
        loading="lazy"
        className="mb-3 aspect-square w-full rounded object-cover"
      />

      <h2 className="mb-2 text-xl font-medium">{character.name}</h2>

      <p className="mt-auto mb-1">
        <span className={`inline-block rounded-full px-2 py-0.5 text-sm ${statusClasses[character.status]}`}>
          {character.status}
        </span>
      </p>

      <p className="text-sm text-slate-600 dark:text-slate-400">{character.species}</p>
    </Link>
  );
}
