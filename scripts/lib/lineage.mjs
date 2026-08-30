/**
 * lib/lineage - shared logic for lineage.mjs and upgrade.mjs.
 *
 * The lineage file is the mechanical answer to "never clobber my work": at scaffold time the
 * app records the fingerprint of every seed file it received. From then on, three statuses
 * decide everything an upgrade may do:
 *
 *   pristine            the app never touched it        -> may auto-update
 *   modified            the app changed it              -> compare; a HUMAN decides; never overwrite
 *   expected-divergent  meant to differ from day one    -> skip silently, forever
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const LINEAGE_PATH = '.framework/lineage.json';

/**
 * HALF A - the PROCESS half (EVOLUTION_PLAN.md decision 1). Apps never edit these; they are
 * linked in a workspace app and copied wholesale into a standalone one. Declared here, in the
 * one module both the scaffolder and the upgrader import, because two copies of this list
 * drift and the drift is silent: a directory the scaffolder ships but the upgrader does not
 * know about is a directory that never receives a fix again.
 */
export const HALF_A = ['scripts', 'docs', 'checklists', 'workflows', 'templates', 'ci', '.claude'];

/* Files that are SUPPOSED to diverge. An upgrade that even mentions them is noise, and noise
 * is how upgrade reports stop being read. */
export const EXPECTED_DIVERGENT = [
  'design/tokens.json',
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  'TEST_SUMMARY.md',
  'CHANGELOG.md',
  'FRAMEWORK_ADOPTION.md',
  '.env.example',
  'package.json',
];
export const EXPECTED_DIVERGENT_DIRS = ['docs/registers/', '.baselines/', 'public/brand/', 'docs/modules/', 'tests/cases/'];

export const isExpectedDivergent = (rel) =>
  EXPECTED_DIVERGENT.includes(rel) || EXPECTED_DIVERGENT_DIRS.some((d) => rel.startsWith(d));

export const sha = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

export function walkFiles(dir, skip = ['node_modules', '.git', '.next', 'dist', 'test-results', 'playwright-report', '.gate-logs'], out = [], root = dir) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, skip, out, root);
    else out.push(path.relative(root, full).replace(/\\/g, '/'));
  }
  return out;
}

export function readLineage(appRoot) {
  const f = path.join(appRoot, LINEAGE_PATH);
  if (!fs.existsSync(f)) return null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    throw new Error(`${LINEAGE_PATH} is not valid JSON (${e.message}). Fix or delete it - an upgrade planned from a corrupt lineage would be a guess.`);
  }
  if (!parsed || typeof parsed.files !== 'object' || parsed.files === null) {
    throw new Error(`${LINEAGE_PATH} has no "files" map. It cannot be used to plan an upgrade.`);
  }
  return parsed;
}

export function writeLineage(appRoot, lineage) {
  const f = path.join(appRoot, LINEAGE_PATH);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(lineage, null, 2) + '\n', 'utf8');
  return f;
}

/**
 * Compute the live status of every tracked file by re-hashing.
 * The recorded hash is the hash AT SEED TIME (or at last upgrade) - comparing against it is
 * what distinguishes "the app changed this" from "the framework changed this".
 */
export function statusOf(appRoot, lineage) {
  const rows = [];
  for (const [rel, rec] of Object.entries(lineage.files)) {
    const full = path.join(appRoot, rel);
    if (isExpectedDivergent(rel) || rec.status === 'expected-divergent') {
      rows.push({ rel, status: 'expected-divergent' });
      continue;
    }
    // A DECLINED offer is checked before existence, because a declined file is precisely one
    // the app chose not to take - it is absent on purpose, and reporting it as 'deleted' would
    // re-offer it on every future upgrade. An offer that cannot be turned down permanently is
    // an offer that gets ignored permanently, and then so is the rest of the report.
    if (rec.status === 'declined') {
      rows.push({ rel, status: 'declined' });
      continue;
    }
    if (!fs.existsSync(full)) {
      rows.push({ rel, status: 'deleted' });
      continue;
    }
    // 'adopted-modified' is sticky: at --init time the file ALREADY differed from the seed, so
    // "recorded hash == live hash" does not mean pristine - it means "unchanged since adoption,
    // and the app owns it". Treating it as pristine made the first upgrade after adoption
    // auto-overwrite the app's edit - the exact clobbering this system exists to prevent.
    // (Found by fixtures/diverged before it ever shipped. That is what fixtures are for.)
    if (rec.status === 'adopted-modified') {
      rows.push({ rel, status: 'modified' });
      continue;
    }
    rows.push({ rel, status: sha(full) === rec.hash ? 'pristine' : 'modified' });
  }
  return rows;
}

export function frameworkVersion(frameworkRoot) {
  const f = path.join(frameworkRoot, 'VERSION');
  if (!fs.existsSync(f)) throw new Error(`No VERSION file at ${frameworkRoot} - is this a framework checkout?`);
  return fs.readFileSync(f, 'utf8').trim();
}
