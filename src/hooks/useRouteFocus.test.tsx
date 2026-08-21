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
function Layout({ attached }: { attached: boolean }) {
  const main = useRef<HTMLElement>(null);

  useRouteFocus(main);

  return (
    // Unattached leaves `main.current` null while the DOM stays identical, so a
    // navigation still happens and only the hook's target is missing.
    <main ref={attached ? main : null} tabIndex={-1}>
      <Link to="/other">Other</Link>
      <Link to="/">Home</Link>
      <Outlet />
    </main>
  );
}

function routeTree(attached: boolean): RouteObject[] {
  return [
    {
      path: '/',
      element: <Layout attached={attached} />,
      children: [
        { index: true, element: <h1>Home</h1> },
        { path: 'other', element: <h1>Other</h1> },
      ],
    },
  ];
}

function renderRouter({ attached = true }: { attached?: boolean } = {}) {
  const router = createMemoryRouter(routeTree(attached), { initialEntries: ['/'] });
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

  /**
   * The optional chain, asserted rather than assumed. A layout that never attaches the
   * ref has to navigate silently — the hook reaches for a target that is not there on
   * every route change, and throwing inside that effect would take the route with it.
   */
  it('navigates without a target rather than throwing', async () => {
    const { user } = renderRouter({ attached: false });

    await user.click(await screen.findByRole('link', { name: 'Other' }));

    expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument();
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
