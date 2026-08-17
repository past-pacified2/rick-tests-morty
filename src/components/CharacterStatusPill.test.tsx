import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { Character } from '@/api/characters';

import { CharacterStatusPill } from './CharacterStatusPill';

describe('CharacterStatusPill', () => {
  const statuses: Character['status'][] = ['Alive', 'Dead', 'unknown'];
  it.each(statuses)('renders %s status correctly', (status) => {
    render(<CharacterStatusPill status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it('renders different classes for different statuses', () => {
    render(
      <>
        {statuses.map((status) => (
          <CharacterStatusPill key={status} status={status} />
        ))}
      </>,
    );

    const classes = new Set(statuses.map((status) => screen.getByText(status).className));

    expect(classes.size).toBe(statuses.length);
  });
});
