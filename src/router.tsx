import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { patterns, routes } from '@/lib/routes';

import { RootLayout } from './routes/RootLayout';
import { RouteErrorBoundary } from './routes/RouteErrorBoundary';

/**
 * The route table from docs/adr/0005-routing-strategy.md, and nothing else.
 *
 * Two things are deliberately *not* lazy:
 *
 *  - `RootLayout`, because it renders on every route, so deferring it only adds a
 *    round trip to the first paint.
 *  - `RouteErrorBoundary`, so that a boundary is on hand without a second chunk having
 *    to arrive first.
 *
 *    It does not catch the failure that reasoning was written for. React Router 8.3.0
 *    routes a loader or render throw to `errorElement` and drops a rejected `lazy()`:
 *    the parent's element stays on screen with an empty outlet and no error anywhere.
 *    Measured in Chromium on both a hard load and a client-side navigation, and
 *    reproduced in a bare memory router with no app code in it — so a chunk that 404s
 *    after a deploy would leave the header, the footer and nothing between them. That
 *    one is handled below the router, by src/lib/staleDeploy.ts on Vite's
 *    `vite:preloadError`. The boundary stays eager because the reasoning holds for
 *    whatever else reaches it, and src/router.integration.test.tsx covers that through
 *    a loader throw, which is the path React Router does route.
 *
 * Everything else is a separate chunk, so visiting the list never downloads the
 * detail view.
 *
 * The tree is exported separately from the router built out of it so tests can mount
 * it in a memory router, one fresh instance per test. Sharing a single browser router
 * across tests would carry navigation state between them, and an order-dependent test
 * suite is a suite that lies at least once.
 */
export const routeTree: RouteObject[] = [
  {
    id: 'root',
    path: patterns.root,
    element: <RootLayout />,
    // The shell, again, for the window before the matched route's lazy chunk arrives.
    // Without it React Router renders null at the root and the page is blank until the
    // chunk lands — it says so on every load: "No `HydrateFallback` element provided to
    // render during initial hydration", a warning that ships in the production bundle.
    //
    // The same component rather than a second copy of the header and footer: the chrome
    // is identical either side of the swap, so nothing moves when the route fills in.
    hydrateFallbackElement: <RootLayout hydrating />,
    // The root boundary is the backstop: anything a child boundary does not catch,
    // and anything thrown while resolving a child route, lands here.
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        id: 'home',
        index: true,
        lazy: () => import('./routes/CharactersRoute'),
        errorElement: <RouteErrorBoundary />,
      },
      {
        // `/character` with no id is an incomplete URL, not an error — most likely a
        // hand-edited address bar or a truncated link. `replace` keeps it out of the
        // history stack, so Back does not bounce the user straight back into it.
        path: patterns.characterIndex,
        element: <Navigate to={routes.home()} replace />,
      },
      {
        id: 'character',
        path: patterns.character,
        lazy: () => import('./routes/CharacterRoute'),
        errorElement: <RouteErrorBoundary />,
      },
      {
        id: 'imprint',
        path: patterns.imprint,
        lazy: () => import('./routes/ImprintRoute'),
      },
      {
        id: 'privacy',
        path: patterns.privacy,
        lazy: () => import('./routes/PrivacyRoute'),
      },
      {
        id: 'fatal-error',
        path: patterns.fatalError,
        lazy: () => import('./routes/FatalErrorRoute'),
      },
      {
        // Must stay last: `*` matches anything the routes above did not.
        id: 'not-found',
        path: patterns.notFound,
        lazy: () => import('./routes/NotFoundRoute'),
      },
    ],
  },
];

export const router = createBrowserRouter(routeTree);
