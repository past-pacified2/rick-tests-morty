import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { fetchCharactersListPage } from '@/api/characters';

export function useCharacters({ page, name }: { page: number; name?: string }) {
  return useQuery({
    queryKey: ['characters', { page, name }],
    queryFn: ({ signal }) => fetchCharactersListPage({ page, name: name ?? '', signal }),
    placeholderData: keepPreviousData,
  });
}
