import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { router } from '@/router';

import './index.css';

/**
 * Application-wide query defaults.
 *
 * Per-query options (staleTime, placeholderData) belong on the individual hooks —
 * see docs/adr/0002-data-fetching-and-caching.md. Only the choices that should hold
 * everywhere live here.
 *
 * This file is excluded from coverage (vitest.config.ts) because it is composition,
 * not behaviour: there is no branch here worth asserting on. When the integration
 * tests arrive they will need a QueryClient with these same defaults, and that is the
 * moment to extract a `createQueryClient()` factory — a test client that silently
 * disagrees with the real one is an integration test that proves nothing.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetching every time the tab regains focus is a sensible default for a
      // dashboard and a wasteful one for a read-only public catalogue.
      refetchOnWindowFocus: false,
      // A 404 is a definitive answer, not a transient failure, and retrying it three
      // times delays the not-found route by seconds (ADR-0005). The status-aware
      // predicate lands together with ApiError in src/api; two retries until then.
      retry: 2,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root is missing from index.html — the entry point and the template have diverged.');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
