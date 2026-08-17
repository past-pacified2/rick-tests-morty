// eslint-disable-next-line import-x/no-restricted-paths
import type { Character } from '@/api/characters';

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

export function CharacterStatusPill({ status }: { status: Character['status'] }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-sm ${statusClasses[status]}`}>{status}</span>;
}
