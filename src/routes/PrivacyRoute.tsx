import { Link } from 'react-router';

import { Seo } from '@/components/Seo';
import { routes } from '@/lib/routes';

/**
 * What the site does with personal data, which is close to nothing.
 *
 * Written from what the code actually does rather than from a generator: there is no
 * account, no cookie, no analytics and no form. The one disclosure that matters is the
 * third-party API, because the browser requests character data and images from it
 * directly and that request carries the visitor's IP address.
 *
 * Keep this in step with the code. A privacy statement is a claim about behaviour, and
 * adding an analytics script or a cookie without editing this page makes it false.
 */
export function PrivacyRoute() {
  return (
    <div className="mx-auto max-w-prose">
      <Seo
        title="Data protection"
        description="What this site collects, which is nothing, and the one third-party request it makes."
        path={routes.privacy()}
      />

      <h1 className="text-2xl font-semibold">Data protection</h1>

      <h2 className="mt-8 text-lg font-medium">Controller</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        This site carries no operator name by choice; see the{' '}
        <Link
          to={routes.imprint()}
          className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
        >
          legal notice
        </Link>{' '}
        for what that means and how to make contact.
      </p>

      <h2 className="mt-8 text-lg font-medium">What this site collects</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Nothing. There is no account, no contact form, no cookie, no local storage of personal data and no analytics or
        tracking of any kind. Nothing you do here is recorded by the site owner.
      </p>

      <h2 className="mt-8 text-lg font-medium">Hosting</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        The site is served as static files by Cloudflare Pages. The host processes the technical data any web server
        receives — IP address, requested URL, user agent, timestamp — in order to deliver the page and to defend against
        attacks. That processing rests on Art. 6 (1)(f) GDPR, the legitimate interest in operating the site securely.
      </p>

      <h2 className="mt-8 text-lg font-medium">Third-party requests</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Character data and character images are fetched by your browser directly from the public{' '}
        <a
          href="https://rickandmortyapi.com"
          className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
        >
          Rick and Morty API
        </a>
        . Those requests reveal your IP address and user agent to its operator, and they happen automatically when a
        page loads. No other third party receives a request from this site.
      </p>

      <h2 className="mt-8 text-lg font-medium">Your rights</h2>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Under the GDPR you may request access to, correction of, or erasure of your personal data, object to its
        processing, and complain to a supervisory authority. Because this site stores no personal data, a request
        addressed to the site owner will generally be answered with that fact; requests concerning hosting logs should
        go to the host.
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

export { PrivacyRoute as Component };
