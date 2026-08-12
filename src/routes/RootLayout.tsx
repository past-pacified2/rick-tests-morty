import { Link, Outlet } from 'react-router';

import { routes } from '@/lib/routes';

/**
 * The shell every route renders inside.
 *
 * It exists so the per-route error boundaries have something to fail *inside of*:
 * a crash in the detail view replaces the `<Outlet />` only, leaving the header and
 * navigation intact. See docs/adr/0005-routing-strategy.md.
 */
export function RootLayout() {
  return (
    <div className="min-h-dvh bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* `focus:not-sr-only` — the skip link is invisible until tabbed to, which is
          the only state in which it is useful. Landmarks below give screen-reader
          users the same shortcut. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="border-b border-slate-200 dark:border-slate-800">
        <nav aria-label="Main" className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to={routes.home()} className="font-semibold hover:underline">
            Rick &amp; Morty Character Explorer
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
