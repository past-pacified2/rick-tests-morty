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

  return n;
}
