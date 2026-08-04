import { test as base, type Locator, type Page } from '@playwright/test';

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

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Characters', level: 1 });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }
}

class CharacterPage {
  constructor(private readonly page: Page) {}

  /** A hard navigation, which is also the request that proves the SPA fallback works. */
  async goto(id: number | string): Promise<void> {
    await this.page.goto(`/character/${String(id)}`);
  }

  heading(id: number | string): Locator {
    return this.page.getByRole('heading', { name: `Character ${String(id)}`, level: 1 });
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
