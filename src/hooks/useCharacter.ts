import { skipToken, useQuery, queryOptions } from '@tanstack/react-query';

import { fetchCharacter } from '@/api/characters';

/**
 * `skipToken` rather than `enabled: id !== undefined`: both hold the query at
 * pending, but only this one narrows `id` for the fetch, so an absent id needs no
 * sentinel value and no assertion to get past the type checker.
 */
export function characterQueryOptions({ id }: { id: number | undefined }) {
  return queryOptions({
    // Stryker disable next-line StringLiteral: nothing looks the list up by prefix, so the
    // namespace has no observable consequence — a test for it could only restate this line.
    queryKey: ['character', { id }],
    queryFn: id === undefined ? skipToken : ({ signal }) => fetchCharacter({ id, signal }),
  });
}

export function useCharacter({ id }: { id: number | undefined }) {
  return useQuery(characterQueryOptions({ id }));
}
