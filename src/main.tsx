import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { recoverFromStaleDeploy } from '@/lib/staleDeploy';
import { createQueryClient } from '@/queryClient';
import { router } from '@/router';

import './index.css';

const queryClient = createQueryClient();

/**
 * Vite's event for a route chunk that failed to download, which after a deploy means the
 * chunk is gone rather than the network is down (src/lib/staleDeploy.ts).
 *
 * `router.state.navigation.location` is the route being navigated to, and it is set only
 * while a navigation is in flight: on a click it holds the target, and on a hard load
 * there is no navigation and the address bar already holds it. Measured in Chromium for
 * both.
 *
 * The default is to rethrow, and that is left in place when nothing was done about it.
 */
window.addEventListener('vite:preloadError', (event) => {
  const pending = router.state.navigation.location;
  const target = pending ? `${pending.pathname}${pending.search}${pending.hash}` : null;

  if (recoverFromStaleDeploy(window, Date.now(), target)) {
    event.preventDefault();
  }
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
