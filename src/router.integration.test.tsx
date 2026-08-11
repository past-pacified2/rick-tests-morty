import { render, screen } from '@testing-library/react';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { NOT_FOUND, REQUEST_FAILED } from './lib/errors';
import { RootLayout } from './routes/RootLayout';
import { RouteErrorBoundary } from './routes/RouteErrorBoundary';
import { withQueryClient, renderAt } from './test/render';

/**
 * Route-level integration: the real route table, the real layout, the real lazy
 * chunks, and a memory router in place of the browser's history.
 *
 * This is the rung between component tests and E2E, and it catches the class of bug
 * neither of the others can. A component test renders one component and knows nothing
 * about how it is reached. An E2E run would catch these too, but takes a browser and
 * a production build to do it. Everything asserted below is a *wiring* fact — which
 * URL reaches which component, what survives a crash, where a redirect lands.
 *
 */

describe('the route table', () => {
  it('renders the character list at the root', async () => {
    renderAt('/');

    expect(await screen.findByRole('heading', { name: 'Characters' })).toBeInTheDocument();
  });

  it('renders the detail route and passes the id through', async () => {
    renderAt('/character/42');

    expect(await screen.findByRole('heading', { name: 'Character 42' })).toBeInTheDocument();
  });

  it('renders the not-found route for an unknown path', async () => {
    renderAt('/no-such-page');

    expect(await screen.findByRole('heading', { name: NOT_FOUND.title })).toBeInTheDocument();
  });

  it('renders the fatal error route at /500', async () => {
    renderAt('/500');

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  });

  /**
   * `/character` with no id is an incomplete URL rather than an error. Asserting on
   * the resulting *location*, not only on what rendered — otherwise a route that
   * happened to render the list at the wrong URL would pass.
   */
  it('redirects an incomplete character URL to the list', async () => {
    const { router } = renderAt('/character');

    expect(await screen.findByRole('heading', { name: 'Characters' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('the layout', () => {
  it('keeps the navigation present on every route', async () => {
    renderAt('/character/42');

    expect(await screen.findByRole('heading', { name: 'Character 42' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  /**
   * Clicking rather than calling navigate(): a Link that renders the right text but
   * builds the wrong href is invisible to a programmatic navigation test.
   */
  it('navigates home when the brand link is clicked', async () => {
    const { router, user } = renderAt('/character/42');

    expect(await screen.findByRole('heading', { name: 'Character 42' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Character Explorer/ }));

    expect(await screen.findByRole('heading', { name: 'Characters' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

/**
 * The boundary is exercised against a deliberately throwing tree rather than the real
 * one, because no route in the app throws on purpose yet. The components under test
 * are still the real RootLayout and RouteErrorBoundary — only the thing that fails is
 * synthetic.
 */
describe('the error boundary', () => {
  /**
   * Boundaries on the child *and* on the root, mirroring src/router.tsx. The child
   * one is what keeps the layout alive: React Router renders an error to the nearest
   * boundary, and a boundary declared only on the parent replaces the parent's
   * element — layout included. Dropping the child errorElement here makes the last
   * test in this block fail, which is the whole argument for declaring it per route.
   */
  function treeThatThrows(thrown: unknown): RouteObject[] {
    return [
      {
        path: '/',
        element: <RootLayout />,
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            loader: () => {
              throw thrown;
            },
            errorElement: <RouteErrorBoundary />,
            element: <p>never rendered</p>,
          },
        ],
      },
    ];
  }

  function renderThrowing(thrown: unknown) {
    // The boundary logs the real error for developers, and setup.ts turns
    // console.error into a test failure. Opting out here only; restoreMocks puts the
    // guard back before the next test.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const router = createMemoryRouter(treeThatThrows(thrown), { initialEntries: ['/'] });
    return render(withQueryClient(<RouterProvider router={router} />));
  }

  it('shows the not-found copy for a 404 response', async () => {
    renderThrowing(new Response(null, { status: 404 }));

    expect(await screen.findByRole('heading', { name: NOT_FOUND.title })).toBeInTheDocument();
    expect(screen.getByText(NOT_FOUND.body)).toBeInTheDocument();
  });

  it('offers a retry only when the failure is recoverable', async () => {
    renderThrowing(new Response(null, { status: 503 }));

    expect(await screen.findByRole('heading', { name: REQUEST_FAILED.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('does not offer a retry for a 404', async () => {
    renderThrowing(new Response(null, { status: 404 }));

    expect(await screen.findByRole('heading', { name: NOT_FOUND.title })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  /**
   * The reason errors.ts maps a status rather than an error object. If this ever
   * fails, something started rendering the thrown value and internals are on screen.
   * See docs/adr/0006-security.md.
   */
  it('never renders the thrown error text', async () => {
    const secret = 'postgres://user:hunter2@db.internal:5432';
    renderThrowing(new Error(secret));

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).not.toBeInTheDocument();
  });

  it('keeps the navigation visible when a route fails', async () => {
    renderThrowing(new Response(null, { status: 500 }));

    expect(await screen.findByRole('heading', { name: REQUEST_FAILED.title })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
