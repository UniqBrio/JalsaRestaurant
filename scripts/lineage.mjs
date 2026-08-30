#!/usr/bin/env node
/**
 * lineage - record and inspect what an app received from the framework.
 *
 * USAGE (run from the APP root)
 *   node <framework>/scripts/lineage.mjs --init [--framework <path>]   adopt an existing app
 *   node <framework>/scripts/lineage.mjs --status                      report drift, read-only
 *
 * The scaffolder calls the same logic automatically for new apps; --init exists so the apps
 * that predate the lineage system can join it. On --init every current seed file is recorded
 * with TODAY'S hash - meaning "whatever you have now counts as your baseline". Honest, and the
 * same demand-no-worse contract as every ratchet in this framework.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  LINEAGE_PATH, isExpectedDivergent, sha, walkFiles,
  readLineage, writeLineage, statusOf, frameworkVersion,
} from './lib/lineage.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = process.cwd();
const FRAMEWORK = path.resolve(arg('--framework', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));

if (argv.includes('--init')) {
  if (readLineage(APP)) {
    console.error(`${LINEAGE_PATH} already exists. Delete it first if you truly want to re-baseline.`);
    process.exit(2);
  }
  const seedRoot = path.join(FRAMEWORK, 'starter');
  const seedFiles = walkFiles(seedRoot).filter((rel) => !rel.startsWith('.baselines/'));
  const files = {};
  let present = 0;
  for (const rel of seedFiles) {
    const inApp = path.join(APP, rel);
    if (!fs.existsSync(inApp)) continue; // the app may have deleted seed files; that is its right
    present++;
    // Compare against the CURRENT seed: a file that already differs was edited by the app (or
    // predates this seed) - either way the app owns it, and it must be recorded as
    // 'adopted-modified' so no upgrade ever auto-overwrites it. Recording it 'pristine' here
    // was a real defect: the first post-adoption upgrade clobbered the edit.
    const seedTwin = path.join(seedRoot, rel);
    const differs = fs.existsSync(seedTwin) && sha(inApp) !== sha(seedTwin);
    files[rel] = {
      hash: sha(inApp), // TODAY's hash: existing edits become the app's accepted baseline
      status: isExpectedDivergent(rel) ? 'expected-divergent' : differs ? 'adopted-modified' : 'pristine',
    };
  }
  const f = writeLineage(APP, {
    frameworkVersion: frameworkVersion(FRAMEWORK),
    seededAt: new Date().toISOString().slice(0, 10),
    initMode: 'adopted-existing-app',
    // Which half-A arrangement this app uses, so upgrade.mjs knows whether the process half is
    // linked (nothing to move) or copied (refresh it wholesale). Detected, not assumed.
    mode: fs.existsSync(path.join(APP, '.framework-link.json')) ? 'workspace'
      : fs.existsSync(path.join(APP, 'scripts', 'audits')) ? 'standalone' : 'workspace',
    files,
  });
  console.log(`wrote ${path.relative(APP, f)} - ${present} seed file(s) recorded at framework v${frameworkVersion(FRAMEWORK)}`);
  console.log('Note: --init records CURRENT hashes, so existing edits are your accepted baseline.');
  process.exit(0);
}

/* --refresh <file>: after a hand-merge of an incoming file, re-record its hash so it counts
 * as pristine against the CURRENT seed. This is the explicit human sign-off the three-way rule
 * requires - an upgrade never does it silently. */
if (argv.includes('--refresh')) {
  const rel = arg('--refresh');
  const lineage = readLineage(APP);
  if (!lineage) { console.error('No lineage file here.'); process.exit(2); }
  // A file can be untracked and still legitimate: an adopted app that TAKES an offered seed
  // file follows the printed instruction "cp ... then --refresh <path>" - and refusing it here
  // left the taken file invisible to every future upgrade. Untracked is fine exactly when the
  // current seed has such a file; anything else is a typo and is still refused.
  const inSeed = rel && fs.existsSync(path.join(FRAMEWORK, 'starter', rel));
  if (!rel || (!lineage.files[rel] && !inSeed)) { console.error(`Not a tracked seed file: ${rel}`); process.exit(2); }
  const full = path.join(APP, rel);
  if (!fs.existsSync(full)) { console.error(`File missing in app: ${rel}`); process.exit(2); }
  lineage.files[rel] = { hash: sha(full), status: 'pristine' };
  writeLineage(APP, lineage);
  const incoming = path.join(APP, '.framework', 'incoming', rel);
  if (fs.existsSync(incoming)) fs.rmSync(incoming);
  console.log(`re-recorded ${rel} - now pristine against the current merge.`);
  process.exit(0);
}

/* --decline <file>: permanently refuse an OFFERED file. Adopted apps are offered every seed
 * file they lack, and an app on a different stack will never want most of them. Without a way to
 * say no, each upgrade re-lists the same rejects until nobody reads the report at all. Recorded
 * rather than silent, so the decision stays visible and reversible (delete the entry to re-offer). */
if (argv.includes('--decline')) {
  const rel = arg('--decline');
  const lineage = readLineage(APP);
  if (!lineage) { console.error('No lineage file here.'); process.exit(2); }
  if (!rel) { console.error('Usage: --decline <path-relative-to-app-root>'); process.exit(2); }
  lineage.files[rel] = { hash: null, status: 'declined', declinedAt: new Date().toISOString().slice(0, 10) };
  writeLineage(APP, lineage);
  const incoming = path.join(APP, '.framework', 'incoming', rel);
  if (fs.existsSync(incoming)) fs.rmSync(incoming);
  console.log(`declined ${rel} - it will not be offered again. Delete its entry in ${LINEAGE_PATH} to reconsider.`);
  process.exit(0);
}

/* --status (default) */
const lineage = readLineage(APP);
if (!lineage) {
  console.error(`No ${LINEAGE_PATH} here. Run with --init from the app root, or scaffold via new-app.mjs.`);
  process.exit(2);
}
const rows = statusOf(APP, lineage);
const counts = {};
for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

console.log(`Lineage: seeded from framework v${lineage.frameworkVersion} on ${lineage.seededAt}`);
console.log(`  pristine            ${counts['pristine'] ?? 0}`);
console.log(`  modified            ${counts['modified'] ?? 0}`);
console.log(`  expected-divergent  ${counts['expected-divergent'] ?? 0}`);
console.log(`  deleted             ${counts['deleted'] ?? 0}`);
console.log(`  declined            ${counts['declined'] ?? 0}`);
if (argv.includes('--verbose')) {
  for (const r of rows.filter((x) => x.status === 'modified' || x.status === 'deleted')) {
    console.log(`  ${r.status.toUpperCase().padEnd(9)} ${r.rel}`);
  }
}
