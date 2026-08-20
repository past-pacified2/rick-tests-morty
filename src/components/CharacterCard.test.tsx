import { screen, render } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CharacterCard } from '@/components/CharacterCard';
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
});
