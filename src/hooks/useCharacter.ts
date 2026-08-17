import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchCharacter } from '@/api/characters';

const STALE_TIME = 1000 * 60 * 20; // public, effectively static api

/**
 * `skipToken` rather than `enabled: id !== undefined`: both hold the query at
 * pending, but only this one narrows `id` for the fetch, so an absent id needs no
 * sentinel value and no assertion to get past the type checker.
 */
export function useCharacter({ id }: { id: number | undefined }) {
  return useQuery({
    queryKey: ['character', { id }],
    queryFn: id === undefined ? skipToken : ({ signal }) => fetchCharacter({ id, signal }),
    staleTime: STALE_TIME,
  });
}
