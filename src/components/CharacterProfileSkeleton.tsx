/**
 * Placeholder for the profile while the character query is pending.
 *
 * `aria-hidden` for the same reason as CharacterCardSkeleton: a screen reader gets one
 * announced "Loading character…" from the `role="status"` container the caller wraps
 * this in, not eight unlabelled boxes.
 *
 * The box model is copied from CharacterProfile rather than shared, and it has to stay
 * in step with it — the wrapper, the two-column grid, the image ratio, the `6rem` label
 * column and the `gap-3` between rows are all the same values. Every bar is `h-6`,
 * which is the height of the line box it replaces: `text-2xl leading-none` for the name,
 * the default `text-base` line height for a row, and `text-sm` plus `py-0.5` for the
 * status pill all come out at 24px, so nothing moves when the real profile arrives.
 *
 * Six rows, not seven. CharacterProfile renders `Type` only when the API sends a
 * non-empty one, so there is no row count that is right for every character; six is the
 * common case, and the characters that do have a type shift by one row.
 */
export function CharacterProfileSkeleton() {
  return (
    <div
      aria-hidden="true"
      // motion-reduce disables the pulse for anyone who has asked the OS for less
      // animation. axe does not test this and neither does anything else here, which
      // is exactly why it is easy to forget.
      className="mx-auto max-w-3xl animate-pulse motion-reduce:animate-none"
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr] md:items-start">
        <div className="mx-auto aspect-square w-full max-w-72 rounded-2xl bg-slate-200 dark:bg-slate-800" />

        <div>
          <div className="mb-4 h-6 w-2/3 rounded bg-slate-200 md:mb-6 dark:bg-slate-800" />

          {/*
            Real <dl>/<dt>/<dd> rather than divs, even though nothing here is read out.
            `aria-hidden` on the root removes the whole subtree from the accessibility
            tree, so these elements cost nothing there — and they give the unit test a
            way to count rows in the DOM, which role queries cannot do precisely because
            the subtree is hidden.
          */}
          <dl className="grid gap-3">
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="h-6 w-14 rounded bg-slate-200 dark:bg-slate-800" />
              {/* the status pill, which is rounded-full rather than a bar */}
              <dd className="h-6 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>

            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[6rem_1fr] gap-2">
                <dt className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-800" />
                <dd className="h-6 w-24 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
