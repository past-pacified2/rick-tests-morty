#!/usr/bin/env node
//
// Every code identifier the documentation names has to exist in the code.
//
// The ADRs are read as commitments, so a name in one is a claim like any other. This
// repo had seven that were not: `fetchCharacters`, `ApiError`, `CharacterSchema`,
// `buildCharacter`, `statusTone`, and two more. Someone following the README's repo map
// hit a dead end on the first name they tried, which is a cheap way to lose the benefit
// of documentation that is otherwise better than most.
//
// Deliberately shallow. It asks whether a token appears anywhere in the source at all,
// not whether it is exported from the file the prose implies. A rename is the failure
// this catches, and a rename makes the old name vanish everywhere.
//
// Usage: node scripts/check-doc-identifiers.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOCS = ['docs', 'README.md'];
const SOURCES = ['src', 'tests', 'package.json', 'tsconfig.json', '.size-limit.json', 'lighthouserc.json'];

/**
 * Names the documentation mentions on purpose without the repo defining them: APIs of
 * libraries we use, and of ones we deliberately do not. Each needs a reason, because an
 * allowlist without reasons is where this check comes to die.
 *
 * @type {Record<string, string>}
 */
const NOT_OURS = {
  getByLabelText: 'Testing Library query named as preferred; not every query is in use',
  useReducer: 'React API named as the alternative not chosen',
  waitForTimeout: 'Playwright API named as the thing the flake policy forbids',
  TypeError: 'the JavaScript built-in that a CORS-blocked fetch rejects with',
};

/** Identifier-shaped: camelCase or PascalCase, so prose words do not qualify. */
const IDENTIFIER = /`([A-Za-z][A-Za-z0-9_.]*)(?:\(\))?`/g;

/**
 * @param {string} entry
 * @returns {string[]}
 */
function filesUnder(entry) {
  if (statSync(entry).isFile()) return [entry];

  return readdirSync(entry, { withFileTypes: true }).flatMap((item) =>
    filesUnder(join(entry, item.name)).filter((file) => !file.includes('node_modules')),
  );
}

const haystack = SOURCES.flatMap(filesUnder)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

/** @type {Map<string, Set<string>>} */
const mentions = new Map();

for (const file of DOCS.flatMap(filesUnder).filter((file) => file.endsWith('.md'))) {
  const text = readFileSync(file, 'utf8');

  for (const match of text.matchAll(IDENTIFIER)) {
    const token = (match[1] ?? '').split('.')[0] ?? '';

    // Two capitals in sequence, or a lowercase followed by an uppercase: `useQuery`,
    // `FetchError`. A bare lowercase word is prose in backticks, not a symbol.
    if (token.length <= 3 || !/[a-z][A-Z]/.test(token)) continue;
    if (token in NOT_OURS) continue;

    mentions.set(token, (mentions.get(token) ?? new Set()).add(file));
  }
}

const missing = [...mentions].filter(([token]) => !new RegExp(`\\b${token}\\b`).test(haystack));

if (missing.length > 0) {
  console.error('check-doc-identifiers: named in the documentation, absent from the code:\n');
  for (const [token, files] of missing) {
    console.error(`  ${token.padEnd(28)} ${[...files].join(', ')}`);
  }
  console.error('\n  Rename it in the docs, or add it to NOT_OURS with the reason it is not ours.');
  process.exit(1);
}

console.log(`check-doc-identifiers: ${String(mentions.size)} identifiers named in the docs, all present in the code.`);
