export function parsePageParam(pageParam: string | null) {
  if (pageParam === null) return 1;

  const t = pageParam.trim();

  if (!/^\d+$/.test(t)) {
    return 1;
  }

  const n = parseInt(t);

  if (n === 0) {
    return 1;
  }

  // A digit string can hold more than a double can. Past 2^53 the value loses precision,
  // and past 1e21 `String()` writes it back as "8e+21", which no longer matches the
  // `\d+` above — so the page would be reachable once and never again.
  //
  // Clamped rather than rejected: a page beyond the end is a not-found (ADR-0008), and
  // returning 1 would quietly show page one to someone who asked for something else.
  return Math.min(n, Number.MAX_SAFE_INTEGER);
}
