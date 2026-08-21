import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { characterQueryOptions } from './useCharacter';

export function usePrefetchCharacter() {
  const queryClient = useQueryClient();

  return useCallback(
    (id: number) => {
      // prefetch is fire and forget, swallows its own errors
      void queryClient.prefetchQuery(characterQueryOptions({ id }));
    },
    // Stryker disable next-line ArrayDeclaration: useQueryClient returns the single client
    // the provider holds for its lifetime, so an empty array builds an identical callback.
    // Killing this would mean swapping the client under a mounted provider, which nothing
    // does — main.tsx creates one and keeps it.
    [queryClient],
  );
}
