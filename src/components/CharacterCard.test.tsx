import { screen, render, fireEvent } from '@testing-library/react';
import { act, type ComponentProps } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { CharacterCard, PREFETCH_INTENT_MS } from '@/components/CharacterCard';
import { expectNoViolations } from '@/test/axe';
import { makeCharacter } from '@/test/handlers';

function renderCharacterCard(props: ComponentProps<typeof CharacterCard>) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <CharacterCard {...props} />,
      },
    ],
    {
      initialEntries: ['/'],
    },
  );

  return render(<RouterProvider router={router} />);
}

describe('the character card component', () => {
  it('renders the character card', () => {
    const character = makeCharacter();
    renderCharacterCard({ character });

    expect(screen.getByRole('link')).toHaveAttribute('href', `/character/${character.id.toString()}`);
  });

  it('renders only one link', () => {
    renderCharacterCard({ character: makeCharacter() });

    expect(screen.getAllByRole('link').length).toBe(1);
  });

  it('image stays in the presentation level', () => {
    renderCharacterCard({ character: makeCharacter() });

    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.queryAllByRole('presentation')).toHaveLength(1);
  });

  it('heading is level 2', () => {
    const character = makeCharacter();
    renderCharacterCard({ character });

    expect(screen.getByRole('heading', { name: character.name, level: 2 })).toBeInTheDocument();
  });

  it('status pill is a present', () => {
    const character = makeCharacter();
    renderCharacterCard({ character });

    expect(screen.getByText(character.status)).toBeInTheDocument();
  });

  it('defers its portrait unless it is a priority card', () => {
    renderCharacterCard({ character: makeCharacter() });

    expect(screen.getByRole('presentation')).toHaveAttribute('loading', 'lazy');
    expect(screen.getByRole('presentation')).toHaveAttribute('fetchpriority', 'auto');
  });

  it('loads a priority portrait eagerly', () => {
    renderCharacterCard({ character: makeCharacter(), priority: true });

    expect(screen.getByRole('presentation')).toHaveAttribute('loading', 'eager');
    expect(screen.getByRole('presentation')).toHaveAttribute('fetchpriority', 'high');
  });

  it('reserves the image box before the image loads', () => {
    renderCharacterCard({ character: makeCharacter() });

    expect(screen.getByRole('presentation')).toHaveAttribute('width', '300');
    expect(screen.getByRole('presentation')).toHaveAttribute('height', '300');
  });

  // fireEvent, not user-event: every user-event call awaits internally, which
  // deadlocks under fake timers. The subject here is the timer, not a pointer path.
  /* eslint-disable testing-library/prefer-user-event */
  describe('prefetch', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('fires after intent timeout', () => {
      const prefetch = vi.fn();
      renderCharacterCard({ character: makeCharacter(), onPrefetch: prefetch });

      const link = screen.getByRole('link');
      fireEvent.pointerEnter(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS);
      });

      expect(prefetch).toHaveBeenCalledOnce();
    });

    it('not fires before intent timeout', () => {
      const prefetch = vi.fn();
      renderCharacterCard({ character: makeCharacter(), onPrefetch: prefetch });

      const link = screen.getByRole('link');
      fireEvent.pointerEnter(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS / 2);
      });

      expect(prefetch).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS / 2);
      });

      expect(prefetch).toHaveBeenCalledOnce();
    });

    it('does not fire when the pointer leaves first', () => {
      const prefetch = vi.fn();
      renderCharacterCard({ character: makeCharacter(), onPrefetch: prefetch });

      const link = screen.getByRole('link');
      fireEvent.pointerEnter(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS / 2);
      });

      fireEvent.pointerLeave(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS * 5);
      });

      expect(prefetch).not.toHaveBeenCalled();
    });

    it('schedules on keyboard focus too', () => {
      const prefetch = vi.fn();
      renderCharacterCard({ character: makeCharacter(), onPrefetch: prefetch });

      const link = screen.getByRole('link');
      fireEvent.focus(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS);
      });

      expect(prefetch).toHaveBeenCalledOnce();
    });

    it('does not fire when focus is lost before timeout', () => {
      const prefetch = vi.fn();
      renderCharacterCard({ character: makeCharacter(), onPrefetch: prefetch });

      const link = screen.getByRole('link');
      fireEvent.focus(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS / 2);
      });

      fireEvent.blur(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS * 5);
      });

      expect(prefetch).not.toHaveBeenCalled();
    });

    it('clears the timeout when the component unmounts', () => {
      const prefetch = vi.fn();
      const { unmount } = renderCharacterCard({ character: makeCharacter(), onPrefetch: prefetch });

      const link = screen.getByRole('link');
      fireEvent.pointerEnter(link);

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS / 2);
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(PREFETCH_INTENT_MS * 5);
      });

      expect(prefetch).not.toHaveBeenCalled();
    });
  });
  /* eslint-enable testing-library/prefer-user-event */

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderCharacterCard({ character: makeCharacter() });

    await expectNoViolations(container);
  });
});
