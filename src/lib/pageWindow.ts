function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pageWindow(page: number, pages: number, radius = 2): number[] {
  if (pages < 1) return [];

  const window: number[] = [];
  const width = radius * 2 + 1;
  // The latest a full-width window may start without running off the end. Math.max
  // keeps it at 1 when there are fewer pages than the window is wide.
  const lastStart = Math.max(1, pages - width + 1);
  // Clamping here is also what absorbs an out-of-range `page`: parsePageParam has no
  // upper bound, so `?page=99` on a 10-page list arrives here as 99.
  const start = clamp(page - radius, 1, lastStart);
  const end = Math.min(pages, start + width - 1);

  for (let i = start; i <= end; i++) {
    window.push(i);
  }

  if (window[0] !== 1) {
    window.unshift(1);
  }

  if (window[window.length - 1] !== pages) {
    window.push(pages);
  }

  return window;
}
