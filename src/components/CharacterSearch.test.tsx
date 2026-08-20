import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CharacterSearch, SEARCH_DEBOUNCE_MS } from '@/components/CharacterSearch';

function renderSearch(url: string) {
  const router = createMemoryRouter([{ path: '/', element: <CharacterSearch /> }], { initialEntries: [url] });
  // `delay: null` keeps typing itself off the clock, so only `advance()` moves it.
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });

  render(<RouterProvider router={router} />);

  return { router, user, input: screen.getByRole('searchbox', { name: /search characters by name/i }) };
}

/** The debounce is the unit under test, so every wait here is a timer advance. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('the character search component', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('labels the input, so it is reachable by name', () => {
    const { input } = renderSearch('/');

    expect(input).toHaveValue('');
  });

  it('seeds the input from the url, so a shared link shows its own term', () => {
    const { input } = renderSearch('/?name=rick');

    expect(input).toHaveValue('rick');
  });

  it('leaves the url alone when the input already matches it', async () => {
    const { router } = renderSearch('/?name=rick&page=3');

    await advance(SEARCH_DEBOUNCE_MS);

    expect(router.state.location.search).toBe('?name=rick&page=3');
  });

  it('writes the term to the url once the input settles', async () => {
    const { router, user, input } = renderSearch('/');

    await user.type(input, 'morty');
    await advance(SEARCH_DEBOUNCE_MS);

    expect(router.state.location.search).toBe('?name=morty');
  });

  it('holds the write until the input settles', async () => {
    const { router, user, input } = renderSearch('/');

    await user.type(input, 'morty');
    await advance(SEARCH_DEBOUNCE_MS / 2);

    expect(router.state.location.search).toBe('');
  });

  it('writes once for a burst of keystrokes, with the last value', async () => {
    const { router, user, input } = renderSearch('/');

    await user.type(input, 'mor');
    await advance(SEARCH_DEBOUNCE_MS / 2);
    await user.type(input, 'ty');
    await advance(SEARCH_DEBOUNCE_MS);

    expect(router.state.location.search).toBe('?name=morty');
    // One entry, replaced in place: a term is not a place the back button returns to.
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('drops the page param, so a new term cannot ask for an out-of-range page', async () => {
    const { router, user, input } = renderSearch('/?page=4');

    await user.type(input, 'morty');
    await advance(SEARCH_DEBOUNCE_MS);

    expect(router.state.location.search).toBe('?name=morty');
  });

  it('removes the name param when the input is cleared', async () => {
    const { router, user, input } = renderSearch('/?name=rick');

    await user.clear(input);
    await advance(SEARCH_DEBOUNCE_MS);

    expect(router.state.location.search).toBe('');
  });

  it('trims the term, so a stray space is not part of the query', async () => {
    const { router, user, input } = renderSearch('/');

    await user.type(input, '  rick  ');
    await advance(SEARCH_DEBOUNCE_MS);

    expect(router.state.location.search).toBe('?name=rick');
  });
});
