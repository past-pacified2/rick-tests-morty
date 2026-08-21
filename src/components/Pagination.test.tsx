import { screen, render } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Pagination } from '@/components/Pagination';
import { expectNoViolations } from '@/test/axe';

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

  it('ellipsis renders where the numbers jump', () => {
    renderPagination(
      {
        page: 3,
        hasPrev: true,
        hasNext: true,
        pages: MAX_PAGE,
      },
      '/?page=3',
    );

    expect(screen.getAllByText('…')).toHaveLength(1);
  });

  it('does not render ellipsis if pages fit into the pagination component', () => {
    renderPagination(
      {
        page: 2,
        hasPrev: true,
        hasNext: false,
        pages: 3,
      },
      '/?page=2',
    );

    expect(screen.queryByText('…')).toBeNull();
  });

  it('current page is aria-current="page" and is not a link', () => {
    renderPagination({ page: 3, hasPrev: true, hasNext: true, pages: MAX_PAGE }, '/?page=3');

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('3')).not.toHaveRole('link');
    expect(screen.getByText('3')).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: /^\d+$/ })).toHaveLength(5);
  });

  it('page=99, pages=10 does not have aria-current="page"', () => {
    renderPagination({ page: 99, hasPrev: true, hasNext: false, pages: 10 }, '/?page=99');

    expect(screen.queryByText('99')).not.toBeInTheDocument();

    expect(screen.queryAllByRole('link', { name: /^\d+$/ })).toHaveLength(6);
  });

  it('numbers href is ?page=n and preserves other params', () => {
    renderPagination({ page: 3, hasPrev: true, hasNext: true, pages: MAX_PAGE }, '/?page=3&name=Rick&status=alive');

    const links = screen.getAllByRole('link', { name: /^\d+$/ });

    for (const link of links) {
      const queryParams = new URL(link.getAttribute('href') ?? '', 'http://test.invalid').searchParams;
      expect(queryParams.size).toEqual(3);
      expect(queryParams.get('page')).toBe(link.textContent);
      expect(queryParams.get('name')).toBe('Rick');
      expect(queryParams.get('status')).toBe('alive');
    }
  });

  it('ellipsis is aria-hidden and getAllByRole("link") only returns real pages', () => {
    renderPagination({ page: 3, hasPrev: true, hasNext: true, pages: MAX_PAGE }, '/?page=3');

    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(7);

    // 5 numbers + Previous + Next
    expect(screen.getAllByRole('link')).toHaveLength(7);
  });

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = renderPagination({ page: 2, hasPrev: true, hasNext: true, pages: MAX_PAGE }, '/?page=2');

    await expectNoViolations(container);
  });
});
