import { screen, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterProfile } from '@/components/CharacterProfile';
import { expectNoViolations } from '@/test/axe';
import { makeCharacter } from '@/test/handlers';

describe('CharacterProfile', () => {
  it('renders a character profile', () => {
    const character = makeCharacter();
    render(<CharacterProfile character={character} />);

    expect(screen.getByRole('heading', { name: character.name, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('loads its portrait eagerly', () => {
    render(<CharacterProfile character={makeCharacter()} />);

    expect(screen.getByRole('presentation')).toHaveAttribute('loading', 'eager');
    expect(screen.getByRole('presentation')).toHaveAttribute('fetchpriority', 'high');
  });

  it('renders the character details', () => {
    const character = makeCharacter();
    render(<CharacterProfile character={character} />);

    const terms = screen.getAllByRole('term').map((el) => el.textContent ?? '');
    const values = screen.getAllByRole('definition').map((el) => el.textContent);

    expect(Object.fromEntries(terms.map((term, i) => [term, values[i]]))).toEqual({
      Status: character.status,
      Species: character.species,
      Gender: character.gender,
      Origin: character.origin.name,
      Location: character.location.name,
      Episodes: String(character.episode.length),
    });

    expect(screen.getByRole('presentation')).toHaveAttribute('src', character.image);
  });

  it('renders the character details with type', () => {
    const character = makeCharacter({ type: 'Parasite' });
    render(<CharacterProfile character={character} />);

    const terms = screen.getAllByRole('term').map((el) => el.textContent ?? '');
    const values = screen.getAllByRole('definition').map((el) => el.textContent);

    expect(Object.fromEntries(terms.map((term, i) => [term, values[i]]))).toEqual({
      Status: character.status,
      Species: character.species,
      Gender: character.gender,
      Type: character.type,
      Origin: character.origin.name,
      Location: character.location.name,
      Episodes: String(character.episode.length),
    });

    expect(screen.getByRole('presentation')).toHaveAttribute('src', character.image);
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<CharacterProfile character={makeCharacter()} />);

    await expectNoViolations(container);
  });
});
