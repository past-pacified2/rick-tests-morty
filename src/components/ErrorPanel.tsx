import type { ErrorCopy } from '@/lib/errors';

interface ErrorPanelProps {
  copy: ErrorCopy;
  onRetry: () => void;
  /**
   * Whether this panel is the page's heading.
   *
   * `h1` where the route has no other heading — the detail route renders nothing but a
   * breadcrumb until its character arrives, so the failure is the page. `p` where the
   * route's own `h1` is still on screen above it, as on the list, because a second `h1`
   * is a second document outline and there is only one page here.
   *
   * Stated as a prop rather than inferred, because a component cannot see what its
   * parent rendered. It has already gone wrong twice in the other direction: an E2E
   * locator for "the character heading" matched the list's `h1` and navigated nowhere.
   */
  titleAs: 'h1' | 'p';
}

/**
 * A failed request, rendered in place of the content it was for.
 *
 * In place, not instead of the page: the route's own chrome — breadcrumb, heading,
 * search — stays where it is, because a failed fetch is a recoverable state of a
 * working page rather than a broken route (ADR-0005). The full-page treatment lives in
 * RouteErrorBoundary, which is for the case where the route cannot render at all.
 *
 * The words come from src/lib/errors.ts and never from the thrown error, whose message
 * is written for a stack trace (ADR-0006). The retry is offered only when the copy says
 * the failure is worth retrying — a 404 is final, a 500 is not.
 */
export function ErrorPanel({ copy, onRetry, titleAs }: ErrorPanelProps) {
  const Title = titleAs;

  return (
    <div role="alert" className="mt-3">
      <Title className={titleAs === 'h1' ? 'text-2xl font-semibold' : 'font-medium'}>{copy.title}</Title>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{copy.body}</p>
      {copy.recoverable && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}
