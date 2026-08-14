import { screen, render } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Pagination } from '@/components/Pagination';

function renderPagination(props: ComponentProps<typeof Pagination>, url: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Pagination {...props} />,
      },
    ],
    {
      initialEntries: [url],
    },
  );

  return render(<RouterProvider router={router} />);
}

const MAX_PAGE = 10;

describe('the pagination component', () => {
  it('renders the pagination links', () => {
    const page = 1;
    renderPagination({ page, hasPrev: true, hasNext: true, pages: MAX_PAGE }, `/?page=${page.toString()}`);

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByText(`${page.toString()} of ${MAX_PAGE.toString()}`)).toBeInTheDocument();
  });

  it('renders the pagination without page param', () => {
    renderPagination({ page: 1, hasPrev: false, hasNext: true, pages: MAX_PAGE }, '/');

    expect(screen.getByRole('link', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/?page=2');
  });

  it('renders the pagination links with other search params', () => {
    renderPagination({ page: 1, hasPrev: false, hasNext: true, pages: MAX_PAGE }, '/?page=1&name=Rick&status=alive');

    expect(screen.getByRole('link', { name: 'Next' })).toBeInTheDocument();

    const href = screen.getByRole('link', { name: 'Next' }).getAttribute('href') ?? '';
    const params = new URL(href, 'http://test.invalid').searchParams;

    expect(params.get('page')).toBe('2');
    expect(params.get('name')).toBe('Rick');
    expect(params.get('status')).toBe('alive');
  });

  it('renders the previous link', () => {
    renderPagination({ page: 3, hasPrev: true, hasNext: true, pages: MAX_PAGE }, '/?page=3');

    expect(screen.getByRole('link', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/?page=2');
  });

  it('renders the previous link disabled', () => {
    renderPagination({ page: 1, hasPrev: false, hasNext: true, pages: MAX_PAGE }, '/?page=1');

    expect(screen.queryByRole('link', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('renders the next link disabled', () => {
    renderPagination(
      { page: MAX_PAGE, hasPrev: true, hasNext: false, pages: MAX_PAGE },
      `/?page=${MAX_PAGE.toString()}`,
    );

    expect(screen.queryByRole('link', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });
});
