# ADR-0008: SEO and Page Metadata

## Status

Accepted — 2026-08-20

## Context

Every page-level tag lived in `index.html`: one `<title>`, one description, one `<link rel="canonical">` pointing at the
site root. A single-page app serves that same file for every URL, so `/character/1`, `/impressum` and `/privacy` all
announced themselves as the home page and canonicalised to it. A canonical tag is not advisory — it tells a crawler
"index that URL instead of this one", so the site was actively asking for its own pages to be dropped.

Two audiences matter here, and they behave differently:

- **Search crawlers** execute JavaScript. Googlebot renders the page before indexing it, so metadata React produces is
  metadata the index sees.
- **Link-preview scrapers** (Slack, Facebook, WhatsApp, iMessage) do not. They read the HTML as served and stop.

That split, not the SPA architecture, is what determines which tags can move into the bundle and which cannot.

## Decision

### No library

React 19 hoists `<title>`, `<meta>` and `<link>` rendered anywhere in the component tree into `<head>`. That removes the
reason `react-helmet` existed. React Router's `meta` route export is framework-mode only and this app runs the data
router ([ADR-0005](./0005-routing-strategy.md)), so it is not available either.

One component, `src/components/Seo.tsx`, renders the four tags a route owns: title, description, canonical, robots.
Values come from `src/lib/seo.ts` so no route writes the site name or the deployment origin as a literal.

### The per-route tags leave index.html

React **appends** its hoisted tags; it does not replace what the document already contains. Measured directly: a
document with a static canonical plus a rendered one ends up with two. Two canonical URLs in one document is a worse
signal than none, because a crawler resolves the conflict by ignoring both.

So `index.html` keeps only what never varies per route, and the four page-level tags are rendered exclusively by React.

### What each route claims

| Route            | Title                          | Canonical        | Robots            |
| ---------------- | ------------------------------ | ---------------- | ----------------- |
| `/`              | site name alone                | `/`              | `index, follow`   |
| `/?page=N`       | `Characters — page N · <site>` | `/?page=N`       | `index, follow`   |
| `/?name=…`       | `Search: … · <site>`           | `/`              | `noindex, follow` |
| `/character/:id` | `<character> · <site>`         | `/character/:id` | `index, follow`   |
| `/impressum`     | `Legal notice · <site>`        | `/impressum`     | `index, follow`   |
| `/privacy`       | `Data protection · <site>`     | `/privacy`       | `index, follow`   |
| 404, `/500`      | error copy · `<site>`          | `/`              | `noindex, follow` |

Three of those rows are decisions rather than mechanics:

**A search is not a page.** `?name=Rick` is one visitor's query. Indexing it produces near-duplicate thin pages, so it
is `noindex` and canonicalises to the unfiltered list.

**Pagination is the opposite.** `/?page=2` holds characters that appear nowhere else, so it is its own canonical URL.
Page one carries no query, because `/` and `/?page=1` are the same page and both must not compete —
`routes.charactersPage()` is what enforces that.

**`follow` stays on everywhere.** A `noindex` page's links still lead somewhere worth indexing.

### Open Graph stays static

`og:` and `twitter:` tags remain in `index.html`, describing the site rather than the route. A preview scraper never
runs the bundle, so per-route social cards are unreachable without SSR. Static site-level cards are correct for every
URL; per-route cards rendered by React would be correct for nobody, because nobody would ever fetch them.

### No sitemap

`public/robots.txt` stays `Allow: /` with no `Sitemap:` directive. The three static routes are reachable by following
links from `/`, which is what a sitemap would have said. A sitemap listing the ~800 character detail URLs would have to
be generated at build time by paging a third-party API — it would make the build depend on that API's availability, go
stale whenever the API adds a character, and enumerate content the site does not own.

## Consequences

- **The tab shows the URL until the bundle mounts.** `index.html` has no `<title>` to show first. This is the visible
  cost of avoiding duplicate tags, and it lasts one paint.
- **A non-rendering consumer sees no title or description**, only the `og:` set. Search engines render; the ones that do
  not are not the ones being optimised for.
- **Metadata is testable at three layers.** `src/lib/seo.test.ts` covers the value building,
  `src/components/Seo.test.tsx` the tags, and `tests/e2e/seo.spec.ts` asserts the merged result in a real browser —
  including a count that fails if a tag is ever duplicated.
- **Canonical origins are only verified after deploy.** `VITE_SITE_URL` is a property of the deployment, so
  `tests/e2e/seo.spec.ts` asserts canonical _paths_ and `tests/smoke/deployment.spec.ts` asserts the absolute URL.
- **Still no correct HTTP status for a 404.** A crawler receives 200 for an unknown URL; `noindex` is the mitigation,
  not a fix. Recorded in [ADR-0005](./0005-routing-strategy.md).

## Alternatives considered

**Keep the static tags and mutate them from an effect.** Full control, no duplicates, and the served HTML stays complete
for scrapers. Rejected: it means imperative `document.head` writes on every navigation, racing React's own rendering, to
buy a title one paint earlier.

**Prerender the routes at build time** (`vite-plugin-ssg` or similar). This is the real fix — correct HTML for every
consumer, per-route social cards, and it composes with the canonical strategy above rather than replacing it. Out of
scope for the same reason SSR is: it changes the deployment model.
