import { expect, test, settleImages } from './fixtures';

/**
 * Lazy portraits, which is the one journey in ADR-0003 that no layer below this can
 * reach at all: `loading="lazy"` is decided by `IntersectionObserver` against the
 * viewport, and jsdom has neither a viewport nor layout to measure against.
 *
 * A phone viewport, not the desktop default. The browser requests a lazy image once it
 * comes within its load-in margin of the viewport — roughly 3,000px — and a four-column
 * desktop list is short enough to sit inside that margin end to end, which would load
 * all twenty and prove nothing. One column is ~10,000px, so the last card is far enough
 * down that only a scroll can reach it.
 */
test.use({ viewport: { width: 390, height: 844 } });

test('requests a portrait when it comes into reach, not before', async ({ page, charactersPage }) => {
  await charactersPage.goto();

  const firstImage = charactersPage.listItems.first().locator('img');
  const lastImage = charactersPage.listItems.last().locator('img');

  // The top of the list is eager (CharactersRoute marks the first four `priority`), so
  // this also fixes the moment the assertion below is taken: the page has done its
  // initial image loading and stopped.
  await expect(firstImage).not.toHaveJSProperty('naturalWidth', 0);

  // The bottom of it has not been asked for. This is the assertion the whole spec is
  // for — it fails if `loading` is dropped from CharacterCard, because then the image
  // is already loaded by the time anything looks.
  await expect(lastImage).toHaveJSProperty('naturalWidth', 0);

  await settleImages(page);

  await expect(lastImage).not.toHaveJSProperty('naturalWidth', 0);
});
