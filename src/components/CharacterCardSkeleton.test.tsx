import { screen, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterCardSkeleton } from '@/components/CharacterCardSkeleton';

describe('CharacterCardSkeleton', () => {
  it('is hidden from the accessibility tree', () => {
    render(<CharacterCardSkeleton />);

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(screen.queryAllByRole('paragraph')).toHaveLength(0);
  });

  it('stands in for the four parts of the card', () => {
    const { container } = render(<CharacterCardSkeleton />);

    // testing-library/no-container and no-node-access exist to stop tests asserting on
    // DOM structure instead of on what a user perceives. This component is `aria-hidden`
    // decoration: it has nothing a user perceives, and the part count is the one thing
    // about it that matters, because it is what keeps the page from shifting when the
    // real card arrives. There is no query that reaches it.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });
});
