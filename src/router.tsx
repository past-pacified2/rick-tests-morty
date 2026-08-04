import { createBrowserRouter, Navigate } from 'react-router';

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
 */
export const router = createBrowserRouter([
  {
    id: 'root',
    path: patterns.root,
    element: <RootLayout />,
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
]);
