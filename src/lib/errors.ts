/**
 * Everything the app knows about a failure: the error it throws, the diagnosis the user
 * reads, and the mapping between them.
 *
 * Not the labels on the controls beside it. "Try again" and "Back to characters" are
 * written where they are rendered: they name what a button does rather than what went
 * wrong, and the second is the same breadcrumb the character route shows when nothing
 * has failed at all. Copy for states that are not failures — "Loading characters…",
 * "No characters found for …" — belongs to the route that renders it for the same
 * reason.
 *
 * Deliberately a pure function of a status code rather than of an error object: the
 * thrown value's own message is written for whoever reads the stack trace, not for a
 * user, and rendering it leaks internals (docs/adr/0006-security.md). The boundary
 * component decides *what* status it is looking at; this file decides what the user
 * reads. That split is what makes the copy testable without a router.
 *
 * Bottom layer: this file imports nothing. `FetchError` lives here rather than beside
 * the fetchers that throw it for that reason — queryClient.ts needs the class to tell a
 * 404 from every other failure, and importing it from `api/` dragged Zod and every schema
 * into the chunk that blocks first paint, for a class with no dependencies at all.
 */

/**
 * A failed request, carrying the status the boundary reads. `status` is `0` for a
 * failure that never reached a server — see `copyForStatus` below.
 *
 * The message is written for a stack trace and never rendered; the user-facing words
 * come from the copy in this file (docs/adr/0006-security.md).
 */
export class FetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

export interface ErrorCopy {
  readonly title: string;
  readonly body: string;
  /** Whether the situation is worth offering a retry for, or is simply final. */
  readonly recoverable: boolean;
}

export const NOT_FOUND: ErrorCopy = {
  title: 'Not found',
  body: 'That page does not exist. It may have been moved, or the link may be wrong.',
  recoverable: false,
};

export const REQUEST_FAILED: ErrorCopy = {
  title: 'Something went wrong',
  body: 'We could not load this right now. Please try again later.',
  recoverable: true,
};

export const UNEXPECTED: ErrorCopy = {
  title: 'Something went wrong',
  body: 'An unexpected error occurred. Reloading the page usually helps.',
  recoverable: false,
};

export const NETWORK_ERROR: ErrorCopy = {
  title: 'Network error',
  body: 'We could not load this right now. Check your connection and try again.',
  recoverable: true,
};

/**
 * Maps an HTTP status to the copy the user sees.
 *
 * `undefined` means an unexpected error occurred, such as a render crash or a chunk
 * that failed to load, which is the unexpected case rather than the retryable one.
 * `0` is a sentinel value for a network error, which is the retryable case rather
 * than the unexpected one.
 *
 * No 429: this API's rate limit reaches a browser as a network error with no status,
 * so the copy it used to map to could not render (docs/adr/0002-data-fetching-and-caching.md).
 */
export function copyForStatus(status: number | undefined): ErrorCopy {
  if (status === 0) return NETWORK_ERROR;
  if (status === 404) return NOT_FOUND;
  if (status && status >= 500) return REQUEST_FAILED;
  return UNEXPECTED; // undefined and other statuses are unexpected
}
