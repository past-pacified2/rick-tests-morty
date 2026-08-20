import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { createMemoryRouter, Link, Outlet, RouterProvider, type RouteObject } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { useRouteFocus } from './useRouteFocus';

/**
 * The real router rather than a stubbed `useLocation`: the hook's whole subject is
 * `location.key`, and a stub would be free to hand it a key the router never
 * produces. A memory router with two routes is the smallest thing that generates
 * real keys.
 */
function Layout() {
  const main = useRef<HTMLElement>(null);

  useRouteFocus(main);

  return (
    <main ref={main} tabIndex={-1}>
      <Link to="/other">Other</Link>
      <Link to="/">Home</Link>
      <Outlet />
    </main>
  );
}

const routeTree: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <h1>Home</h1> },
      { path: 'other', element: <h1>Other</h1> },
    ],
  },
];

function renderRouter() {
  const router = createMemoryRouter(routeTree, { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);

  return { user: userEvent.setup() };
}

describe('useRouteFocus', () => {
  it('leaves focus alone on the initial render', async () => {
    renderRouter();

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('focuses the target after a navigation', async () => {
    const { user } = renderRouter();

    await user.click(await screen.findByRole('link', { name: 'Other' }));

    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  /**
   * Focusing an element scrolls it into view, which would undo <ScrollRestoration />
   * on browser Back. jsdom has no layout to observe that with, so the argument itself
   * is the assertion.
   */
  it('focuses without scrolling', async () => {
    const { user } = renderRouter();

    const main = await screen.findByRole('main');
    const focus = vi.spyOn(main, 'focus');

    await user.click(screen.getByRole('link', { name: 'Other' }));

    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  it('focuses again on every subsequent navigation', async () => {
    const { user } = renderRouter();

    const main = await screen.findByRole('main');
    const focus = vi.spyOn(main, 'focus');

    await user.click(screen.getByRole('link', { name: 'Other' }));
    await user.click(screen.getByRole('link', { name: 'Home' }));

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(focus).toHaveBeenCalledTimes(2);
  });
});
