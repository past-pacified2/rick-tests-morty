#!/usr/bin/env node
//
// Per-path mutation thresholds, the way vitest.config.ts already does it for coverage.
//
// Stryker's own `thresholds.break` is a single number over every mutated file, so a
// layer can sit far below it while the aggregate passes. Measured 2026-08-21: 95.7%
// overall, 72.4% in hooks/ — the layer holding most of the app's branching, and the
// one the aggregate was hiding.
//
// Reads the JSON report rather than running Stryker per path group: one mutation run
// takes minutes, and four of them would not fit the nightly job's budget.
//
// Usage: node scripts/check-mutation-thresholds.mjs [path/to/mutation.json]

import { readFileSync } from 'node:fs';

/**
 * The slice of the mutation-testing report schema this script reads.
 *
 * @typedef {{ status: string }} Mutant
 * @typedef {{ files?: Record<string, { mutants?: Mutant[] }> }} MutationReport
 */

const REPORT_PATH = process.argv[2] ?? 'reports/mutation/mutation.json';

/**
 * A floor per layer, strictest where the logic is densest — the opposite of what a
 * single global number produces. A ratchet: raise one when it is comfortably
 * exceeded, never lower it to make a run pass.
 *
 * Every mutated file must match exactly one prefix. An unmatched file fails the run
 * rather than passing unmeasured, which is the failure mode this script exists for.
 */
const FLOORS = [
  { prefix: 'src/lib/', floor: 95 },
  { prefix: 'src/api/', floor: 95 },
  { prefix: 'src/hooks/', floor: 90 },
  { prefix: 'src/queryClient.ts', floor: 90 },
];

/**
 * The mutation-testing report schema's own arithmetic. `CompileError` and `Ignored`
 * are excluded from the denominator — src/lib/routes.ts produces nothing but those,
 * because Stryker skips `as const` (see stryker.config.json's routes_comment).
 */
const DETECTED = new Set(['Killed', 'Timeout']);
const UNDETECTED = new Set(['Survived', 'NoCoverage']);

/**
 * @param {string} path
 * @returns {MutationReport}
 */
function readReport(path) {
  try {
    const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(path, 'utf8')));

    return /** @type {MutationReport} */ (parsed);
  } catch (error) {
    const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    const reason = missing
      ? 'no report at that path — did `stryker run` finish?'
      : error instanceof Error
        ? error.message
        : String(error);

    console.error(`check-mutation-thresholds: cannot read ${path}\n  ${reason}`);
    process.exit(1);
  }
}

/**
 * Report paths may be absolute or repo-relative; the floors are written repo-relative.
 *
 * @param {string} filePath
 */
function normalize(filePath) {
  const posix = filePath.replaceAll('\\', '/');
  const index = posix.lastIndexOf('src/');

  return index === -1 ? posix : posix.slice(index);
}

/** @param {readonly Mutant[]} mutants */
function tally(mutants) {
  let detected = 0;
  let undetected = 0;

  for (const { status } of mutants) {
    if (DETECTED.has(status)) detected += 1;
    else if (UNDETECTED.has(status)) undetected += 1;
  }

  return { detected, undetected };
}

const report = readReport(REPORT_PATH);
const groups = new Map(FLOORS.map(({ prefix, floor }) => [prefix, { floor, detected: 0, undetected: 0, files: 0 }]));
const unmatched = [];

for (const [filePath, file] of Object.entries(report.files ?? {})) {
  const path = normalize(filePath);
  const match = FLOORS.find(({ prefix }) => path.startsWith(prefix));

  if (!match) {
    unmatched.push(path);
    continue;
  }

  const group = groups.get(match.prefix);
  const { detected, undetected } = tally(file.mutants ?? []);

  group.detected += detected;
  group.undetected += undetected;
  group.files += 1;
}

const rows = [];
let belowFloor = false;

for (const [prefix, { floor, detected, undetected, files }] of groups) {
  const valid = detected + undetected;

  // A group with no valid mutants is not a pass. Either the glob stopped matching or
  // every mutant compiled away, and both are worth knowing about.
  if (valid === 0) {
    rows.push({ prefix, score: '—', floor, verdict: files === 0 ? 'NO FILES' : 'NO MUTANTS' });
    belowFloor = true;
    continue;
  }

  const score = (detected / valid) * 100;
  const passes = score >= floor;

  rows.push({ prefix, score: score.toFixed(2), floor, verdict: passes ? 'ok' : 'BELOW FLOOR' });
  if (!passes) belowFloor = true;
}

const width = Math.max(...rows.map(({ prefix }) => prefix.length));
console.log('');
for (const { prefix, score, floor, verdict } of rows) {
  console.log(`  ${prefix.padEnd(width)}  ${score.padStart(6)}  floor ${String(floor).padStart(3)}  ${verdict}`);
}
console.log('');

if (unmatched.length > 0) {
  console.error('check-mutation-thresholds: mutated files matched by no floor:');
  for (const path of unmatched) console.error(`  ${path}`);
  console.error('  Add a prefix to FLOORS, or narrow `mutate` in stryker.config.json.');
}

if (belowFloor) console.error('check-mutation-thresholds: a layer is below its floor.');

if (belowFloor || unmatched.length > 0) process.exit(1);
