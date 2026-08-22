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
 *  - `RouteErrorBoundary`, because one of the errors it has to catch is "the lazy
 *    chunk failed to load". A boundary that is itself a lazy chunk cannot render the
 *    failure of lazy chunk loading.
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
