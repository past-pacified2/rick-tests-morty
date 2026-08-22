import { test as base, type APIRequestContext, type Locator, type Page, type Response } from '@playwright/test';

const AVATAR_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR42mOYsniHe2gmAAt2AvVY2W4gAAAAAElFTkSuQmCC',
  'base64',
);

/**
 * Page objects, delivered as Playwright fixtures.
 *
 * Why page objects here but not in the Vitest integration tests: Testing Library's
 * queries are already a semantic layer — getByRole('heading', { name }) is phrased in
 * user terms and survives markup changes on its own. Playwright locators have no such
 * layer underneath them, and E2E specs multiply, so the selector for "the character
 * heading" needs exactly one home.
 *
 * Fixtures rather than classes constructed in each test: a fixture is created lazily,
 * only for the specs that name it, and it composes with Playwright's tracing.
 *
 * Deliberately thin. These routes currently render a heading and little else, and a
 * page object describing content that does not exist yet is an interface designed for
 * requirements nobody has met. Locators get added when a spec needs them — on the
 * second spec that needs one, not the first.
 */

/** Chrome present on every route, so any page object can reach it. */
class Layout {
  readonly nav: Locator;
  readonly brandLink: Locator;
  readonly skipLink: Locator;
  readonly main: Locator;

  constructor(page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Main' });
    this.brandLink = page.getByRole('link', { name: /Character Explorer/ });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
    this.main = page.getByRole('main');
  }
}

class CharactersPage {
  readonly heading: Locator;
  readonly list: Locator;
  readonly listItems: Locator;
  readonly pagination: Locator;
  readonly nextLink: Locator;
  readonly prevLink: Locator;
  readonly pageIndicator: Locator;
  readonly cardLinks: Locator;
  readonly search: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Characters', level: 1 });
    this.list = page.getByRole('list', { name: 'Characters' });
    this.listItems = this.list.getByRole('listitem');
    this.cardLinks = this.listItems.getByRole('link');
    this.pagination = page.getByRole('navigation', { name: 'Pagination' });
    this.nextLink = this.pagination.getByRole('link', { name: 'Next' });
    this.prevLink = this.pagination.getByRole('link', { name: 'Previous' });
    this.pageIndicator = this.pagination.getByText(/^\d+ of \d+$/);
    this.search = page.getByRole('searchbox', { name: /search characters by name/i });
  }

  async goto({ pageNumber }: { pageNumber?: number } = {}): Promise<Response | null> {
    const queryParams = new URLSearchParams();
    if (pageNumber !== undefined) {
      queryParams.set('page', pageNumber.toString());
    }

    return await this.page.goto(`/?${queryParams.toString()}`);
  }
}

class CharacterPage {
  readonly backLink: Locator;
  /** Only the loaded profile renders a <dl>; the error and skeleton states do not. */
  readonly facts: Locator;

  constructor(private readonly page: Page) {
    this.facts = page.getByRole('term');
    this.backLink = page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Back to characters' });
  }

  /** A hard navigation, which is also the request that proves the SPA fallback works. */
  async goto(id: number | string): Promise<void> {
    await this.page.goto(`/character/${String(id)}`);
  }

  heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }
}

class NotFoundPage {
  readonly heading: Locator;
  readonly homeLink: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Not found', level: 1 });
    this.homeLink = page.getByRole('link', { name: 'Back to characters' });
  }
}

interface Fixtures {
  layout: Layout;
  charactersPage: CharactersPage;
  characterPage: CharacterPage;
  notFoundPage: NotFoundPage;
}

/** Enough of a response to hand the browser the same one twice. */
interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

interface ApiReplay {
  /** Not `route.fetch()`: that response is disposed if the page abandons the request. */
  context: APIRequestContext;
  responses: Map<string, ApiResponse>;
}

interface WorkerFixtures {
  apiReplay: ApiReplay;
}

/** The list and the detail endpoint. Avatars have their own stub. */
const CACHED_API = /\/api\/character(\?|\/\d|$)/;

/**
 * One live request per distinct API URL, per worker.
 *
 * These specs talk to the real API (ADR-0003), and a single project run asks for the
 * same handful of URLs around thirty times in fifteen seconds — enough for the API to
 * start answering 429. That 429 carries no `Access-Control-Allow-Origin`, so the
 * browser reports it as a network error, the query client takes its transient backoff,
 * and the page is showing the error panel about two seconds later. No timeout waits
 * that out; the only fix is to stop asking so often.
 *
 * Replaying the first response keeps the payloads real. A failed one is not stored, so
 * a retry still reaches the network — including the 429 itself, which the app must go
 * on seeing exactly as it does in production.
 */
async function replayApiResponses(page: Page, { context, responses }: ApiReplay): Promise<void> {
  await page.route(CACHED_API, async (route) => {
    const url = route.request().url();
    let replay = responses.get(url);

    if (!replay) {
      const response = await context.fetch(url);

      replay = {
        status: response.status(),
        // Both describe the wire body, which `response.body()` has already decoded.
        headers: Object.fromEntries(
          Object.entries(response.headers()).filter(
            ([name]) => name !== 'content-encoding' && name !== 'content-length',
          ),
        ),
        body: await response.body(),
      };

      // A 404 is an answer the app renders — an empty search, an unknown character — so
      // it is worth keeping. Everything else is a failure, and gets asked again.
      if (response.ok() || response.status() === 404) {
        responses.set(url, replay);
      } else if (response.status() === 429) {
        // Said out loud because the page cannot say it: the browser turns this into a
        // network error, so the failure screenshot shows the generic error panel.
        console.warn(`[api] 429 for ${url} — the live API is rate limiting this run`);
      }
    }

    await route.fulfill(replay);
  });
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  apiReplay: [
    async ({ playwright }, use) => {
      const context = await playwright.request.newContext();

      await use({ context, responses: new Map() });

      await context.dispose();
    },
    { scope: 'worker' },
  ],

  page: async ({ page, apiReplay }, use) => {
    await page.route(/\/character\/avatar\//, (route) => route.fulfill({ contentType: 'image/png', body: AVATAR_PNG }));
    await replayApiResponses(page, apiReplay);
    await use(page);
  },
  layout: async ({ page }, use) => {
    await use(new Layout(page));
  },
  charactersPage: async ({ page }, use) => {
    await use(new CharactersPage(page));
  },
  characterPage: async ({ page }, use) => {
    await use(new CharacterPage(page));
  },
  notFoundPage: async ({ page }, use) => {
    await use(new NotFoundPage(page));
  },
});

export { expect } from '@playwright/test';

export function readyByPagination(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Pagination' });
}

/** The error region any route renders in place of its content, and the control that dismisses it. */
export function alert(page: Page): Locator {
  return page.getByRole('alert');
}

export function retryButton(page: Page): Locator {
  return page.getByRole('button', { name: /try again/i });
}

/**
 * Trigger the lazy card images, then wait for every image to finish loading.
 *
 * `toHaveScreenshot({ fullPage: true })` scrolls the page to compose the capture, and
 * that scroll is what requests the below-the-fold images — so the load races the
 * capture and the baseline records whichever won. Scrolling first makes it
 * deterministic.
 *
 * A viewport at a time, rather than one jump to the bottom. The browser requests a
 * lazy image when it comes within its load-in margin of the viewport, and a single-
 * column mobile list is ~10,000px against a margin of ~3,000 — a jump straight to the
 * bottom leaves a band in the middle that is never requested. `img.complete` stays
 * false for an image nothing asked for, so the wait then hangs until the test times
 * out.
 */
export async function settleImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      // A frame per step: the position has to be laid out before the next one replaces it.
      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
}
