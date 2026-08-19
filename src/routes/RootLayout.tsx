import { Link, Outlet } from 'react-router';

import { LoadingBar } from '@/components/LoadingBar';
import { SiteFooter } from '@/components/SiteFooter';
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
    <div className="flex min-h-dvh flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
        {/*
          Three columns rather than a flex row, so the logo is centred on the header
          itself and not on whatever space the title leaves over. `col-start-2` is
          load-bearing: the title is `display:none` below `md`, which removes it from
          the grid entirely, and without an explicit column the logo would slide into
          the first cell on mobile instead of staying centred.
        */}
        <nav aria-label="Main" className="mx-auto grid max-w-5xl grid-cols-3 items-center px-4 py-3">
          {/*
            Text, not a link. The logo is the one route home, the way the Vue original
            had it — two links to the same destination in one header give a screen
            reader two indistinguishable "home" stops for no gain.
          */}
          <p className="hidden font-semibold md:block">Rick &amp; Morty Character Explorer</p>

          {/*
            The `aria-label` is the accessible name the image cannot supply: `alt=""`
            makes the logo decorative, which is correct, and leaves the link nameless
            without it.
          */}
          <Link
            to={routes.home()}
            aria-label="Rick & Morty Character Explorer"
            className="col-start-2 justify-self-center"
          >
            <img src="/svgs/mortimer.svg" alt="" width={48} height={48} className="h-12 w-12" />
          </Link>
        </nav>
      </header>

      {/* `w-full` because a flex child no longer fills the row on its own, and the
          column layout is what keeps the footer at the bottom of a short page. */}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-8">
        <LoadingBar />
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
