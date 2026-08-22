import { test as base, type Locator, type Page, type Response } from '@playwright/test';

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

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.route(/\/character\/avatar\//, (route) => route.fulfill({ contentType: 'image/png', body: AVATAR_PNG }));
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
 * The wait alone is not enough. `img.complete` stays false for a lazy image that has
 * never been requested, so on a narrow viewport, where most cards sit below the fold,
 * waiting without scrolling hangs until the test times out.
 */
export async function settleImages(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
}
