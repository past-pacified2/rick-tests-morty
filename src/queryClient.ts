import { QueryClient } from '@tanstack/react-query';
import type { DefaultOptions } from '@tanstack/react-query';

import { FetchError, ParseError } from '@/lib/errors';
import { transientRetryDelayMs } from '@/lib/retryDelay';

/**
 * Application-wide query defaults.
 *
 * Only the choices that should hold everywhere live here.
 * `staleTime` set here because the API we query is public, effectively static.
 * See docs/adr/0002-data-fetching-and-caching.md.
 *
 */
/** Not exported: the tests assert the resulting request count, not this number. */
const RETRY_COUNT = 2;

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

          // A body the schema rejects will be rejected identically three times.
          if (error instanceof ParseError) {
            return false;
          }

          return failureCount < RETRY_COUNT;
        },
        // One policy, because a browser cannot see the other case. This API's 429 is
        // Cloudflare's edge page and carries no `Access-Control-Allow-Origin`, so the
        // response is dropped before `fetch` resolves and a rate limit arrives here as a
        // network error with no status at all. The rate-limit backoff that used to sit in
        // front of this could not run. See docs/adr/0002-data-fetching-and-caching.md.
        retryDelay: (attemptIndex) => transientRetryDelayMs(attemptIndex, Math.random()),
        staleTime: 1_200_000, // public, effectively static api, 20 minutes
        gcTime: 86_400_000, // 24 hours

        ...overrides,
      },
    },
  });
}
