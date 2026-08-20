import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { fetchCharactersListPage } from '@/api/characters';

const STALE_TIME = 1000 * 60 * 20; // public, effectively static api

export function useCharacters({ page, name }: { page: number; name?: string }) {
  return useQuery({
    queryKey: ['characters', { page, name }],
    queryFn: ({ signal }) => fetchCharactersListPage({ page, name: name ?? '', signal }),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });
}
