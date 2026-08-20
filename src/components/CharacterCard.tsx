import { useRef, useEffect } from 'react';
import { Link } from 'react-router';

// The zone rule exists so a component cannot fetch. This is `import type`, erased at
// compile time — no fetch, no module, nothing in the bundle. The rule has no
// allowTypeImports option, so the exemption has to be written here.
// eslint-disable-next-line import-x/no-restricted-paths
import type { Character } from '@/api/characters';
import { routes } from '@/lib/routes';

import { CharacterImage } from './CharacterImage';
import { CharacterStatusPill } from './CharacterStatusPill';

export const PREFETCH_INTENT_MS = 250;

/**
 * One character, as a card in the list.
 *
 * The whole card is the link rather than the name alone: a 300px image with a
 * clickable 20px word inside it is a pointer target that punishes anyone who is not
 * precise with a mouse.
 *
 * `priority` is for the cards the list renders above the fold. Their portrait is the
 * LCP element, and lazy loading it defers the one image the metric measures.
 */
export function CharacterCard({
  character,
  priority = false,
  onPrefetch,
}: {
  character: Character;
  priority?: boolean;
  onPrefetch?: (() => void) | undefined;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function schedulePrefetch() {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    const newTimer = setTimeout(() => {
      onPrefetch?.();
    }, PREFETCH_INTENT_MS);

    timer.current = newTimer;
  }

  function disposePrefetch() {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = null;
  }

  return (
    <Link
      to={routes.character(character.id)}
      className="flex h-full flex-col rounded-lg border border-slate-200 p-4 transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
      onPointerEnter={schedulePrefetch}
      onPointerLeave={disposePrefetch}
      onFocus={schedulePrefetch}
      onBlur={disposePrefetch}
    >
      {/*
        alt="" on purpose. The name is adjacent text inside the same link, so a
        description here would be read out twice; the image carries no information the
        text does not.
      */}
      <CharacterImage
        src={character.image}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className="mb-3 rounded"
      />

      <h2 className="mb-2 text-xl font-medium">{character.name}</h2>

      <p className="mt-auto mb-1">
        <CharacterStatusPill status={character.status} />
      </p>

      <p className="text-sm text-slate-600 dark:text-slate-400">{character.species}</p>
    </Link>
  );
}
