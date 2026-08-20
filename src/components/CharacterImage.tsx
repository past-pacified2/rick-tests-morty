import { useEffect, useState } from 'react';

import { retryDelayMs } from '@/lib/retryDelay';

/** Image requests after the first. */
const MAX_RETRIES = 2;

type Status = 'pending' | 'loaded' | 'failed';

/** A 1x1 transparent GIF. Shown while failed so the browser paints no broken-image icon. */
const BLANK_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Literal strings: Tailwind does not see classes built from a path constant. */
const PLACEHOLDER = 'bg-[url(/imgs/placeholder.jpeg)] bg-cover bg-center';
const PULSE = 'animate-pulse bg-slate-200 motion-reduce:animate-none dark:bg-slate-800';

/**
 * A character portrait, with its own loading, retry and failure states.
 *
 * The browser fetches images, not TanStack Query, so `onLoad` and `onError` are the only
 * signals available. The API 429s under the burst a list page fires, and the retry is
 * blind: the `Retry-After` on that 429 is not readable cross-origin
 * (docs/adr/0002-data-fetching-and-caching.md).
 *
 * The fallback is a background behind the image rather than a fallback `src`, so it
 * shows on the first failure instead of after the last retry and a successful retry
 * paints over it. The img itself goes blank meanwhile, since a broken img renders the
 * browser's own icon on top. `width`/`height` are the CLS guard; callers size the box
 * with `className`.
 */
export function CharacterImage({
  src,
  alt,
  className = '',
  loading,
  fetchPriority,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  // Per mount. The list keys its cards by id, so a new character remounts.
  const [status, setStatus] = useState<Status>('pending');
  // Also the img's `key`: a new element re-requests, an unchanged `src` does not.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status !== 'failed' || attempt >= MAX_RETRIES) return;

    const timer = setTimeout(
      () => {
        setAttempt((current) => current + 1);
        setStatus('pending');
      },
      retryDelayMs(attempt, Math.random()),
    );

    return () => {
      clearTimeout(timer);
    };
  }, [status, attempt]);

  // `attempt > 0` too: a retry in flight is `pending` again, and the grey pulse would
  // reappear mid-retry.
  const hasFailed = status === 'failed' || attempt > 0;

  // A loaded image is opaque, so the backdrop is dropped rather than left under it.
  const backdrop = status === 'loaded' ? '' : hasFailed ? PLACEHOLDER : PULSE;

  return (
    <img
      key={attempt}
      src={status === 'failed' ? BLANK_SRC : src}
      alt={alt}
      width={300}
      height={300}
      loading={loading}
      fetchPriority={fetchPriority}
      onLoad={() => {
        // The blank fires `load` too; treating it as success would drop the backdrop.
        setStatus((current) => (current === 'failed' ? current : 'loaded'));
      }}
      onError={() => {
        setStatus('failed');
      }}
      className={`aspect-square w-full object-cover ${backdrop} ${className}`}
    />
  );
}
