import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CharacterImage } from './CharacterImage';

const SRC = 'https://rickandmortyapi.com/api/character/avatar/780.jpeg';
/** The fallback is a background, so it is a class rather than a `src`. */
const PLACEHOLDER_CLASS = 'bg-[url(/imgs/placeholder.jpeg)]';

/**
 * jsdom never loads an image, so `load` and `error` are fired by hand.
 *
 * Element identity (`not.toBe(...)`) is what asserts a new request: the component
 * retries by changing the img's key and `src` never changes. `presentation` rather than
 * `img` because `alt=""` makes the image decorative in both callers.
 */
describe('CharacterImage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const image = () => screen.getByRole('presentation');

  /** `shouldAdvanceTime` keeps Testing Library's timers alive under fake ones. */
  function useFixedTimers(random: number) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(Math, 'random').mockReturnValue(random);
  }

  /** The timer's setState is React work, and setup.ts fails on an act warning. */
  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('reserves the box and pulses before the image arrives', () => {
    render(<CharacterImage src={SRC} alt="" />);

    expect(image()).toHaveAttribute('width', '300');
    expect(image()).toHaveAttribute('height', '300');
    expect(image().className).toContain('animate-pulse');
    expect(image().className).toContain('motion-reduce:animate-none');
    expect(image()).not.toHaveAttribute('loading');
    expect(image()).not.toHaveAttribute('fetchpriority');
  });

  it('takes the size, loading and fetch priority its caller asks for', () => {
    render(<CharacterImage src={SRC} alt="" loading="eager" fetchPriority="high" className="rounded-2xl" />);

    expect(image()).toHaveAttribute('loading', 'eager');
    expect(image()).toHaveAttribute('fetchpriority', 'high');
    expect(image().className).toContain('rounded-2xl');
  });

  it('stops pulsing once the image loads', () => {
    render(<CharacterImage src={SRC} alt="" />);

    fireEvent.load(image());

    expect(image().className).not.toContain('animate-pulse');
    expect(image().className).not.toContain(PLACEHOLDER_CLASS);
    expect(image()).toHaveAttribute('src', SRC);
  });

  it('retries twice with a growing backoff before giving up', async () => {
    useFixedTimers(0); // no jitter: 10s, then 20s
    render(<CharacterImage src={SRC} alt="" />);
    const first = image();

    fireEvent.error(first);
    await advance(9900);
    expect(image()).toBe(first);

    await advance(200);
    const second = image();
    expect(second).not.toBe(first);
    expect(second).toHaveAttribute('src', SRC);

    fireEvent.error(second);
    await advance(19_900);
    expect(image()).toBe(second);

    await advance(200);
    const third = image();
    expect(third).not.toBe(second);
    expect(third).toHaveAttribute('src', SRC);

    fireEvent.error(third);
    await advance(60_000);
    expect(image()).toBe(third);
  });

  it('waits the jitter on top of the backoff', async () => {
    useFixedTimers(1); // full jitter: 10s + 3s
    render(<CharacterImage src={SRC} alt="" />);
    const first = image();

    fireEvent.error(first);
    await advance(12_900);
    expect(image()).toBe(first);

    await advance(200);
    expect(image()).not.toBe(first);
  });

  /** Drives the component to its terminal state. */
  async function exhaustRetries() {
    fireEvent.error(image());
    await advance(10_100);
    fireEvent.error(image());
    await advance(20_100);
    fireEvent.error(image());
  }

  it('shows the placeholder the moment the first attempt fails', () => {
    useFixedTimers(0);
    render(<CharacterImage src={SRC} alt="" />);

    fireEvent.error(image());

    // Before any retry has been spent.
    expect(image().className).toContain(PLACEHOLDER_CLASS);
    expect(image().className).not.toContain('animate-pulse');
    // Blank rather than the failed URL: a broken img paints the browser's own icon.
    expect(image()).toHaveAttribute('src', expect.stringContaining('data:image/gif'));
  });

  it('keeps the placeholder up while a retry is in flight', async () => {
    useFixedTimers(0);
    render(<CharacterImage src={SRC} alt="" />);

    fireEvent.error(image());
    await advance(10_100);

    expect(image().className).toContain(PLACEHOLDER_CLASS);
    expect(image().className).not.toContain('animate-pulse');
    // The retry requests the real URL again, not the blank.
    expect(image()).toHaveAttribute('src', SRC);
  });

  it('drops the backdrop once a retry finally loads', async () => {
    useFixedTimers(0);
    render(<CharacterImage src={SRC} alt="" />);

    fireEvent.error(image());
    await advance(10_100);
    fireEvent.load(image());

    expect(image().className).not.toContain(PLACEHOLDER_CLASS);
    expect(image()).toHaveAttribute('src', SRC);
  });

  it('stops requesting once the retries are spent', async () => {
    useFixedTimers(0);
    render(<CharacterImage src={SRC} alt="" />);

    await exhaustRetries();
    const last = image();

    fireEvent.error(last);
    await advance(60_000);

    expect(image()).toBe(last);
    expect(image().className).toContain(PLACEHOLDER_CLASS);
  });

  it('cancels a pending retry when it unmounts', async () => {
    useFixedTimers(0);
    const { unmount } = render(<CharacterImage src={SRC} alt="" />);

    fireEvent.error(image());
    unmount();
    await advance(30_000);

    // A surviving timer would setState on an unmounted tree, which setup.ts fails on.
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });
});
