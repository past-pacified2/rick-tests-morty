export function parseNameParam(nameParam: string | null) {
  if (nameParam === null) return '';

  return nameParam.trim();
}
