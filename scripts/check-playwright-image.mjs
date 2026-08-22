#!/usr/bin/env node
//
// Every pinned Playwright container tag has to match the installed @playwright/test.
//
// The image ships browsers built for one library version, and the visual baselines are
// generated inside it. A tag one version behind the lockfile renders text a few pixels
// differently and the screenshot specs fail with a diff nobody can explain — or worse,
// it does not fail, and the baselines quietly stop describing the browser CI runs.
//
// scripts/update-visual-snapshots.sh derives the tag from package.json and so cannot
// drift. A workflow cannot: `container:` is resolved before any step runs, so the tag
// is a literal there and Dependabot's bump of @playwright/test leaves it behind. This
// turns that silence into a failed static-analysis job on the bump PR itself.
//
// Usage: node scripts/check-playwright-image.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SEARCH = ['.github', 'docs', 'scripts', 'README.md', 'playwright.config.ts'];

/** Only fully pinned tags. The derived `:v${PLAYWRIGHT_VERSION}-noble` is not one. */
const PINNED_TAG = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-/g;

/**
 * @param {string} entry
 * @returns {string[]}
 */
function filesUnder(entry) {
  if (statSync(entry).isFile()) return [entry];

  return readdirSync(entry, { withFileTypes: true }).flatMap((item) => filesUnder(join(entry, item.name)));
}

/**
 * Narrowed rather than asserted: a manifest is a file on disk, and a cast would claim
 * the shape without reading it.
 *
 * @param {unknown} manifest
 * @returns {string}
 */
function pinnedVersion(manifest) {
  if (typeof manifest !== 'object' || manifest === null || !('devDependencies' in manifest)) return '';

  const dependencies = manifest.devDependencies;

  if (typeof dependencies !== 'object' || dependencies === null || !('@playwright/test' in dependencies)) return '';

  const range = dependencies['@playwright/test'];

  return typeof range === 'string' ? range.replace(/^[^0-9]*/, '') : '';
}

const expected = pinnedVersion(/** @type {unknown} */ (JSON.parse(readFileSync('package.json', 'utf8'))));

if (expected === '') {
  console.error('check-playwright-image: @playwright/test is not a devDependency.');
  process.exit(1);
}

/** @type {{ file: string; found: string }[]} */
const stale = [];
let pinned = 0;

for (const file of SEARCH.flatMap(filesUnder)) {
  for (const match of readFileSync(file, 'utf8').matchAll(PINNED_TAG)) {
    const found = match[1] ?? '';

    pinned += 1;
    if (found !== expected) stale.push({ file, found });
  }
}

// A check that silently matches nothing is a check that has already stopped working.
if (pinned === 0) {
  console.error(`check-playwright-image: no pinned image tag found under ${SEARCH.join(', ')}.`);
  process.exit(1);
}

if (stale.length > 0) {
  console.error(`check-playwright-image: @playwright/test is ${expected}, but:\n`);
  for (const { file, found } of stale) {
    console.error(`  ${file.padEnd(36)} pins v${found}`);
  }
  console.error(`\n  Update the tag to v${expected}-noble, then regenerate the visual baselines:`);
  console.error('  npm run test:visual:update');
  process.exit(1);
}

console.log(`check-playwright-image: ${String(pinned)} pinned tags, all on v${expected}.`);
