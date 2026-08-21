import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { fetchCharactersListPage } from '@/api/characters';

export function useCharacters({ page, name }: { page: number; name?: string }) {
  return useQuery({
    // Stryker disable next-line StringLiteral: nothing looks the list up by prefix, so the
    // namespace has no observable consequence — a test for it could only restate this line.
    queryKey: ['characters', { page, name }],
    queryFn: ({ signal }) => fetchCharactersListPage({ page, name: name ?? '', signal }),
    placeholderData: keepPreviousData,
  });
}
