import { Link, useSearchParams } from 'react-router';

interface PaginationProps {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  pages: number;
}

export function Pagination({ page, hasPrev, hasNext, pages }: PaginationProps) {
  const [searchParams] = useSearchParams();
  function hrefFor(page: number) {
    const target = new URLSearchParams(searchParams);
    target.set('page', page.toString());
    return `?${target.toString()}`;
  }

  return (
    <nav aria-label="Pagination" className="flex justify-center gap-4">
      {hasPrev ? <Link to={hrefFor(page - 1)}>Previous</Link> : <span aria-disabled="true">Previous</span>}
      <span>
        {page} of {pages}
      </span>
      {hasNext ? <Link to={hrefFor(page + 1)}>Next</Link> : <span aria-disabled="true">Next</span>}
    </nav>
  );
}
