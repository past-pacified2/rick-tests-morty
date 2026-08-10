/**
 * User-facing error copy, and the mapping from HTTP status to which copy applies.
 *
 * Deliberately a pure function of a status code rather than of an error object: the
 * thrown value's own message is written for whoever reads the stack trace, not for a
 * user, and rendering it leaks internals (docs/adr/0006-security.md). The boundary
 * component decides *what* status it is looking at; this file decides what the user
 * reads. That split is what makes the copy testable without a router.
 *
 * Bottom layer: this file imports nothing.
 */

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
  body: 'We could not load this right now. Check your connection and try again.',
  recoverable: true,
};

export const UNEXPECTED: ErrorCopy = {
  title: 'Something went wrong',
  body: 'An unexpected error occurred. Reloading the page usually helps.',
  recoverable: false,
};

export const RATE_LIMIT_EXCEEDED: ErrorCopy = {
  title: 'Rate limit exceeded',
  body: 'We have been asked to slow down a bit. Please try again later.',
  recoverable: true,
};

/**
 * Maps an HTTP status to the copy the user sees.
 *
 * `undefined` means the failure never reached the network — a render crash, a chunk
 * that failed to load — which is the unexpected case rather than the retryable one.
 */
export function copyForStatus(status: number | undefined): ErrorCopy {
  if (status === undefined) return UNEXPECTED;
  if (status === 404) return NOT_FOUND;
  if (status === 429) return RATE_LIMIT_EXCEEDED;
  if (status >= 500) return REQUEST_FAILED;
  return UNEXPECTED;
}
