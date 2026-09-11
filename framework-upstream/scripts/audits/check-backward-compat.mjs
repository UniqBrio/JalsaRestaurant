#!/usr/bin/env node
/**
 * check-backward-compat - a framework change may not turn any fixture green -> red.
 *
 * HOW IT WORKS
 *   A committed expectations file (fixtures/expected-verdicts.json) records the verdict each
 *   fixture is REQUIRED to produce. This audit runs conformance fresh and diffs against it:
 *
 *     expected PASS, got PASS      -> ok
 *     expected PASS, got FAIL      -> BLOCKED. The change broke an existing-app scenario.
 *                                     Rework it, or declare it MAJOR with its migration step
 *                                     written in UPGRADES.md - and update the expectations in
 *                                     the SAME commit, so the relaxation is visible in review.
 *     expected PASS, got BLOCKED   -> BLOCKED (the scenario became unverifiable - that is a
 *                                     regression of the test, not a pass).
 *     got PASS, expected FAIL      -> ALSO blocked: an expectation that is stale must be
 *                                     re-committed, or a real regression can hide inside it.
 *                                     (Same two-sided contract as every ratchet.)
 *
 *   This is the constraint "existing features must not break" - TESTED, not asserted.
 *
 * USAGE
 *   node scripts/audits/check-backward-compat.mjs            audit; exit 2 on any mismatch
 *   node scripts/audits/check-backward-compat.mjs --accept   record current verdicts as expected
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const FW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXPECTED = path.join(FW, 'fixtures', 'expected-verdicts.json');
const argv = process.argv.slice(2);

/**
 * THE RESULTS FILE IS DELETED BEFORE THE RUN, and that is not tidiness.
 *
 * This audit used to read `.gate-logs/conformance.json` if it merely EXISTED. When conformance
 * failed to run at all - a crash, a syntax error, the file deleted - the previous run's results
 * were still on disk, and this gate happily reported every fixture "PASS (as required)" and
 * exited 0. A backward-compatibility gate that reads yesterday's answer is worse than no gate:
 * it certifies a change nobody checked. (Observed: with conformance.mjs removed entirely, this
 * printed three PASSes.)
 *
 * So: remove the file, run, and require that THIS run produced it. Same discipline as
 * check-dead-weight excluding its own baseline - a detector must never read its own stale
 * output as evidence.
 */
const resultsFile = path.join(FW, '.gate-logs/conformance.json');
try { fs.rmSync(resultsFile, { force: true }); } catch { /* a file we cannot remove is handled below */ }
if (fs.existsSync(resultsFile)) {
  console.error('BLOCKED: could not clear the previous conformance results, so a fresh measurement');
  console.error(`  cannot be distinguished from a stale one: ${resultsFile}`);
  process.exit(3);
}

const run = spawnSync(process.execPath, [path.join(FW, 'scripts/conformance.mjs'), '--out', '.gate-logs/conformance.json'], {
  cwd: FW, encoding: 'utf8', timeout: 10 * 60_000,
});
if (!fs.existsSync(resultsFile)) {
  console.error('BLOCKED: conformance produced no results file. A compat check that measured nothing is not a pass.');
  console.error(`  conformance exited ${run.status ?? run.error?.message ?? 'abnormally'}.`);
  console.error((run.stderr || run.stdout || '').slice(0, 500));
  process.exit(3);
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
} catch (e) {
  console.error(`BLOCKED: conformance results are unreadable (${e.message}). Unreadable is not a pass.`);
  process.exit(3);
}
const now = parsed.results;
if (!Array.isArray(now) || now.length === 0) {
  console.error('BLOCKED: conformance measured 0 fixtures. A run that measured nothing is indistinguishable');
  console.error('  from a run where everything passed. That is a defect, not a pass.');
  process.exit(3);
}

if (argv.includes('--accept')) {
  fs.writeFileSync(EXPECTED, JSON.stringify({
    comment: 'The verdict each fixture is REQUIRED to produce. check-backward-compat.mjs diffs live conformance against this. Changing a PASS to anything weaker is a deliberate compatibility decision - it belongs in the same commit as the change that forced it, with a MAJOR entry in UPGRADES.md.',
    verdicts: Object.fromEntries(now.map((r) => [r.name, r.verdict])),
  }, null, 2) + '\n');
  console.log(`wrote fixtures/expected-verdicts.json: ${now.map((r) => `${r.name}=${r.verdict}`).join(' ')}`);
  process.exit(0);
}

if (!fs.existsSync(EXPECTED)) {
  console.error('SKIPPED [BACKWARD COMPAT] - no fixtures/expected-verdicts.json yet.');
  console.error('  Create it: node scripts/audits/check-backward-compat.mjs --accept');
  console.error('  Until then this gate is INERT and is telling you so.');
  process.exit(0); // fail open on missing baseline, loudly - same contract as every ratchet
}
const expected = JSON.parse(fs.readFileSync(EXPECTED, 'utf8')).verdicts;

let exit = 0;
for (const r of now) {
  const want = expected[r.name];
  if (want === undefined) {
    console.error(`BLOCKED [BACKWARD COMPAT] fixture "${r.name}" has no recorded expectation. Run --accept.`);
    exit = 2; continue;
  }
  if (r.verdict === want) { console.log(`OK    fixture ${r.name.padEnd(10)} ${r.verdict} (as required)`); continue; }
  exit = 2;
  if (want === 'PASS') {
    console.error(`BLOCKED [BACKWARD COMPAT] fixture ${r.name}: required PASS, got ${r.verdict}${r.detail ? ` - ${r.detail}` : ''}`);
    console.error('  This framework change breaks an existing-app scenario. Rework it, or declare it');
    console.error('  MAJOR: write the migration step in UPGRADES.md and re-run --accept in the SAME commit.');
  } else {
    console.error(`BLOCKED [BACKWARD COMPAT] fixture ${r.name}: expected ${want}, got ${r.verdict}.`);
    console.error('  A stale expectation can hide a real regression. Re-run --accept and commit it.');
  }
}
for (const name of Object.keys(expected)) {
  if (!now.find((r) => r.name === name)) {
    console.error(`BLOCKED [BACKWARD COMPAT] expected fixture "${name}" was not measured at all.`);
    exit = 2;
  }
}
process.exit(exit);
