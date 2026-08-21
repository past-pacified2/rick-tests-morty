import { QueryClient } from '@tanstack/react-query';
import type { DefaultOptions } from '@tanstack/react-query';

import { FetchError } from '@/api/characters';
import { rateLimitRetryDelayMs, transientRetryDelayMs } from '@/lib/retryDelay';

/**
 * Application-wide query defaults.
 *
 * Only the choices that should hold everywhere live here.
 * `staleTime` set here because the API we query is public, effectively static.
 * See docs/adr/0002-data-fetching-and-caching.md.
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
        retryDelay: (attemptIndex, error) => {
          if (error instanceof FetchError && error.status === 429) {
            // Not the `Retry-After` the 429 carries: it is not CORS-safelisted and this API
            // exposes none, so it reads as null in a browser. See
            // docs/adr/0002-data-fetching-and-caching.md.
            return rateLimitRetryDelayMs(attemptIndex, Math.random());
          }
          return transientRetryDelayMs(attemptIndex, Math.random());
        },
        staleTime: 1_200_000, // public, effectively static api, 20 minutes
        gcTime: 86_400_000, // 24 hours

        ...overrides,
      },
    },
  });
}
