import { Link } from 'react-router';

import { Seo } from '@/components/Seo';
import { routes } from '@/lib/routes';

/**
 * The legal notice.
 *
 * Deliberately carries no name, postal address or email. § 5 DDG requires all three of
 * a site that is `geschäftsmäßig` — offered in a business-like way — and this page is
 * only defensible while that is not true of this deployment: a non-commercial
 * demonstration with no product, no service, no advertising and no data collection.
 * Operating it commercially, or under a custom domain that presents it as a business,
 * makes the omission a compliance problem rather than a privacy choice.
 *
 * Contact is the repository rather than an email address, because a `mailto:` in a
 * static page is scraped within days. Note that German courts have held obfuscated or
 * indirect contact routes insufficient where § 5 does apply — this trade-off buys
 * privacy at the cost of compliance, not in addition to it.
 *
 * Static copy, no data source, no state. Lazy like every other route, so the bytes
 * only load for the few visitors who follow the footer link.
 */
export function ImprintRoute() {
  return (
    <div className="mx-auto max-w-prose">
      <Seo
        title="Legal notice"
        description="Who runs this site, what it is for, and where its data comes from."
        path={routes.imprint()}
      />

      <h1 className="text-2xl font-semibold">Legal notice</h1>

      <h2 className="mt-8 text-lg font-medium">About this site</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        This is a non-commercial technical demonstration, built to show how a small React application is structured and
        tested. Nothing is sold or advertised here, no service is offered, no account exists and no personal data is
        collected — see the{' '}
        <Link
          to={routes.privacy()}
          className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
        >
          data protection notice
        </Link>
        .
      </p>

      <h2 className="mt-8 text-lg font-medium">Contact</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Through the public repository this site is built from:{' '}
        <a
          href="https://github.com/past-pacified2/rick-tests-morty"
          className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
        >
          github.com/past-pacified2/rick-tests-morty
        </a>
        . Legal enquiries that require a named recipient can be raised there and will be answered directly.
      </p>

      <h2 className="mt-8 text-lg font-medium">Content and sources</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Character data and images are supplied by the public{' '}
        <a
          href="https://rickandmortyapi.com"
          className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
        >
          Rick and Morty API
        </a>
        , which is not operated by this site and whose contents are the responsibility of its providers. Rick and Morty
        and all related names and images are trademarks of their respective rights holders; this site is unaffiliated
        with them and claims no ownership of the material it displays.
      </p>

      <h2 className="mt-8 text-lg font-medium">Liability for links</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        The external sites linked from here are outside this site&apos;s control. They were unobjectionable when the
        link was added; their current contents are the responsibility of their operators.
      </p>

      <p className="mt-8">
        <Link
          to={routes.home()}
          className="text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-100"
        >
          Back to characters
        </Link>
      </p>
    </div>
  );
}

export { ImprintRoute as Component };
