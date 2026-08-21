import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { expectNoViolations } from '@/test/axe';

import { CharacterProfileSkeleton } from './CharacterProfileSkeleton';

describe('CharacterProfileSkeleton', () => {
  it('is hidden from the accessibility tree', () => {
    render(<CharacterProfileSkeleton />);

    expect(screen.queryAllByRole('term')).toHaveLength(0);
    expect(screen.queryAllByRole('definition')).toHaveLength(0);
  });

  it('stands in for the six rows a character without a type renders', () => {
    const { container } = render(<CharacterProfileSkeleton />);

    // testing-library/no-container and no-node-access exist to stop tests asserting on
    // DOM structure instead of on what a user perceives. This component is `aria-hidden`
    // decoration: it has nothing a user perceives, and the row count is the one thing
    // about it that matters, because it is what keeps the page from shifting when the
    // real profile arrives. There is no query that reaches it.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('dt')).toHaveLength(6);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    expect(container.querySelectorAll('dd')).toHaveLength(6);
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<CharacterProfileSkeleton />);

    await expectNoViolations(container);
  });
});
