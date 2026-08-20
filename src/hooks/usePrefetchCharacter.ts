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
    [queryClient],
  );
}
