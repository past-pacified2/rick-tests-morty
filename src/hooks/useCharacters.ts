import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { fetchCharactersListPage } from '@/api/characters';

const STALE_TIME = 1000 * 60 * 20; // public, effectively static api

export function useCharacters({ page }: { page: number }) {
  return useQuery({
    queryKey: ['characters', { page }],
    queryFn: ({ signal }) => fetchCharactersListPage({ page, signal }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });
}
