import type React from 'react';
import { Link, useSearchParams } from 'react-router';

import { pageWindow } from '@/lib/pageWindow';

interface PaginationProps {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  pages: number;
}

const RADIUS = 2;

const slotClass = 'flex size-9 items-center justify-center';

const controlClass = 'flex h-9 items-center justify-center px-2';

const linkColor = 'text-blue-700 underline dark:text-blue-300';
const currentColor = 'cursor-default font-semibold text-slate-900 dark:text-slate-100';
const disabledColor = 'text-slate-500 dark:text-slate-400';

function PageLinks({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  const links: React.ReactNode[] = [];

  let previous: number | undefined;

  for (const n of pageWindow(page, pages, RADIUS)) {
    if (previous !== undefined && n - previous > 1) {
      links.push(
        <li key={`${previous.toString()}-ellipsis`} aria-hidden="true" className={`${slotClass} ${disabledColor}`}>
          …
        </li>,
      );
    }
    const isActive = n === page;

    links.push(
      <li key={n.toString()}>
        {isActive ? (
          <span aria-current="page" className={`${slotClass} ${currentColor}`}>
            {n}
          </span>
        ) : (
          <Link to={hrefFor(n)} className={`${slotClass} ${linkColor}`}>
            {n}
          </Link>
        )}
      </li>,
    );

    previous = n;
  }

  return <ul className="hidden justify-center gap-1 tabular-nums sm:flex sm:min-w-89">{links}</ul>;
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
      {hasPrev ? (
        <Link to={hrefFor(page - 1)} className={`${controlClass} ${linkColor}`}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={`${controlClass} cursor-default ${disabledColor}`}>
          Previous
        </span>
      )}
      <PageLinks page={page} pages={pages} hrefFor={hrefFor} />

      <span className="flex h-9 items-center tabular-nums sm:hidden">
        {page} of {pages}
      </span>

      {hasNext ? (
        <Link to={hrefFor(page + 1)} className={`${controlClass} ${linkColor}`}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={`${controlClass} cursor-default ${disabledColor}`}>
          Next
        </span>
      )}
    </nav>
  );
}
