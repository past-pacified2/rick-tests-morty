/**
 * Placeholder for one card while the page query is pending.
 *
 * `aria-hidden` is the whole accessibility design: a screen reader gets one announced
 * "Loading characters…" from the `role="status"` container the caller wraps this grid
 * in, not twenty unlabelled boxes. Decoration that reaches the accessibility tree is
 * worse than no decoration at all.
 *
 * The box model is copied from CharacterCard rather than shared, and it has to stay in
 * step with it: the point of a skeleton is that nothing moves when the real card
 * replaces it, and Cumulative Layout Shift is an error-level Lighthouse budget. The
 * bars are sized to the type they stand in for — h-7 for the `text-xl` name, h-5 for
 * the `text-sm` species — and deliberately not full width, because a block of
 * identical full-width bars reads as a broken layout rather than as pending content.
 *
 * Real elements because aria-hidden is true on the root element removes the subtree,
 * so these cost nothing in the accessibility tree.
 */
export function CharacterCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      // motion-reduce disables the pulse for anyone who has asked the OS for less
      // animation. axe does not test this and neither does anything else here, which
      // is exactly why it is easy to forget.
      className="flex h-full animate-pulse flex-col rounded-lg border border-slate-200 p-4 motion-reduce:animate-none dark:border-slate-800"
    >
      <div className="mb-3 aspect-square w-full rounded bg-slate-200 dark:bg-slate-800" />
      {/* The rule skips elements that carry their own aria-hidden but does not look at ancestors
      and so is broken here. */}
      {/* eslint-disable-next-line jsx-a11y/heading-has-content */}
      <h2 className="mb-2 h-7 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
      <p className="mt-auto mb-1 h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
      <p className="h-5 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
