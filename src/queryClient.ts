import { QueryClient } from '@tanstack/react-query';
import type { DefaultOptions } from '@tanstack/react-query';

import { FetchError } from '@/api/characters';
import { retryDelayMs } from '@/lib/retryDelay';

/**
 * Application-wide query defaults.
 *
 * Per-query options (staleTime, placeholderData) belong on the individual hooks —
 * see docs/adr/0002-data-fetching-and-caching.md. Only the choices that should hold
 * everywhere live here.
 *
 */
export const RETRY_COUNT = 2;

export function createQueryClient(overrides?: DefaultOptions['queries']) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Refetching every time the tab regains focus is a sensible default for a
        // dashboard and a wasteful one for a read-only public catalogue.
        refetchOnWindowFocus: false,
        // A 404 is a definitive answer, not a transient failure, and retrying it three
        // times delays the not-found route by seconds (ADR-0005).
        retry: (failureCount, error) => {
          if (error instanceof FetchError && error.status === 404) {
            return false;
          }

          return failureCount < RETRY_COUNT;
        },
        // Not the `Retry-After` the 429 carries: it is not CORS-safelisted and this API
        // exposes none, so it reads as null in a browser. See
        // docs/adr/0002-data-fetching-and-caching.md.
        retryDelay: (attemptIndex) => retryDelayMs(attemptIndex, Math.random()),

        ...overrides,
      },
    },
  });
}
