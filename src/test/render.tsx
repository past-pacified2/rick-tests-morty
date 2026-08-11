import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { createQueryClient } from '@/queryClient';
import { routeTree } from '@/router';

/**
 * Every render goes through a QueryClient built by the same factory the application
 * uses, so these tests exercise the real defaults rather than a convenient invention.
 * Only `retry` is overridden: a failing request retried twice turns a sub-second test
 * into a slow one, and retry behaviour has its own tests in queryClient.test.ts.
 *
 * A fresh client per render, never a shared one — a QueryClient is a cache, and a
 * cache shared between tests makes them order-dependent.
 */
export function withQueryClient(ui: ReactElement) {
  return <QueryClientProvider client={createQueryClient({ retry: false })}>{ui}</QueryClientProvider>;
}

/**
 * Route-level integration: the real route table, the real layout, the real lazy
 * chunks, and a memory router in place of the browser's history.
 *
 */
export function renderAt(path: string) {
  const router = createMemoryRouter(routeTree, { initialEntries: [path] });
  return { router, user: userEvent.setup(), ...render(withQueryClient(<RouterProvider router={router} />)) };
}
