import { screen, render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from '@/components/SiteFooter';
import { expectNoViolations } from '@/test/axe';

function renderSiteFooter() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <SiteFooter />,
      },
    ],
    {
      initialEntries: ['/'],
    },
  );

  return render(<RouterProvider router={router} />);
}

describe('SiteFooter', () => {
  it('renders the site footer', () => {
    renderSiteFooter();

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('renders the links to the privacy and imprint routes', () => {
    renderSiteFooter();

    expect(screen.getByRole('link', { name: 'Data protection' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Legal notice' })).toHaveAttribute('href', '/impressum');
    expect(screen.getAllByRole('navigation', { name: 'Legal' })).toHaveLength(1);
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderSiteFooter();

    await expectNoViolations(container);
  });
});
