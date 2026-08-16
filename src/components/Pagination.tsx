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

const linkColor = 'text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100';
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
          <span aria-current="page" className={`${slotClass} ${currentColor} underline`}>
            {n}
          </span>
        ) : (
          <Link to={hrefFor(n)} className={`${slotClass} ${linkColor} hover:underline`}>
            {n}
          </Link>
        )}
      </li>,
    );

    previous = n;
  }

  return <ul className="hidden justify-center gap-1 tabular-nums sm:flex sm:min-w-89">{links}</ul>;
}

function IconPrevious() {
  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        stroke="currentColor"
        fill="currentColor"
        className="size-5"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
      >
        <path d="M169.4 297.4C156.9 309.9 156.9 330.2 169.4 342.7L361.4 534.7C373.9 547.2 394.2 547.2 406.7 534.7C419.2 522.2 419.2 501.9 406.7 489.4L237.3 320L406.6 150.6C419.1 138.1 419.1 117.8 406.6 105.3C394.1 92.8 373.8 92.8 361.3 105.3L169.3 297.3z" />
      </svg>
      <span className="sr-only">Previous</span>
    </>
  );
}

function IconNext() {
  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        stroke="currentColor"
        fill="currentColor"
        className="size-5"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 640 640"
      >
        <path d="M471.1 297.4C483.6 309.9 483.6 330.2 471.1 342.7L279.1 534.7C266.6 547.2 246.3 547.2 233.8 534.7C221.3 522.2 221.3 501.9 233.8 489.4L403.2 320L233.9 150.6C221.4 138.1 221.4 117.8 233.9 105.3C246.4 92.8 266.7 92.8 279.2 105.3L471.2 297.3z" />
      </svg>
      <span className="sr-only">Next</span>
    </>
  );
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
        <Link to={hrefFor(page - 1)} className={`${slotClass} ${linkColor}`}>
          <IconPrevious />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${slotClass} cursor-default ${disabledColor}`}>
          <IconPrevious />
        </span>
      )}
      <PageLinks page={page} pages={pages} hrefFor={hrefFor} />

      <span className="flex h-9 items-center tabular-nums sm:hidden">
        {page} of {pages}
      </span>

      {hasNext ? (
        <Link to={hrefFor(page + 1)} className={`${slotClass} ${linkColor}`}>
          <IconNext />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${slotClass} cursor-default ${disabledColor}`}>
          <IconNext />
        </span>
      )}
    </nav>
  );
}
