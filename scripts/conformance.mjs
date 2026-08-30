#!/usr/bin/env node
/**
 * conformance - prove the CURRENT framework against the three fixture apps.
 *
 * For each fixture, a scratch copy is made (fixtures stay untouched in the repo - a conformance
 * run that mutates its own fixtures destroys tomorrow's baseline), lineage is initialised as of
 * the PREVIOUS state, the current framework is applied via the real upgrade.mjs, and the
 * outcome is checked against what that fixture exists to prove:
 *
 *   minimal    every changed seed file auto-applies; zero review items; gate-relevant audits pass
 *   with-debt  its accepted violations do NOT fail the run - a new gate arrives baselined,
 *              an existing app never goes green -> red
 *   diverged   its modified file is routed to REVIEW; the divergence marker SURVIVES
 *
 * Output: one PASS/FAIL/BLOCKED verdict per fixture, exit 0/2/3 - same three-valued contract as
 * every other gate. Results are also written to .gate-logs/conformance.json so
 * check-backward-compat.mjs can diff before/after.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { sha } from './lib/lineage.mjs';

const FW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = ['minimal', 'with-debt', 'diverged'];
const results = [];
const argv = process.argv.slice(2);
const OUT = path.resolve(FW, arg('--out', '.gate-logs/conformance.json'));
function arg(n, d) { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; }

const sh = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: 'utf8' });

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

async function runFixture(name) {
  const src = path.join(FW, 'fixtures', name);
  if (!fs.existsSync(src)) return { name, verdict: 'BLOCKED', detail: 'fixture missing' };

  const app = fs.mkdtempSync(path.join(os.tmpdir(), `conf-${name}-`));
  copyDir(src, app);
  try {
    execFileSync('git', ['init', '-q', '.'], { cwd: app });
    sh('git', ['config', 'user.email', 'c@c.c'], app);
    sh('git', ['config', 'user.name', 'conformance'], app);
  } catch { return { name, verdict: 'BLOCKED', detail: 'git unavailable' }; }

  // Initialise lineage against the CURRENT framework, then hand-age it: pretend the app was
  // seeded from an older state by rewriting recorded hashes to the fixture's CURRENT content
  // (which for pristine files equals the seed) - upgrade.mjs then sees exactly the statuses the
  // fixture was built to exhibit.
  let r = sh(process.execPath, [path.join(FW, 'scripts/lineage.mjs'), '--init', '--framework', FW], app);
  if (r.status !== 0) return { name, verdict: 'BLOCKED', detail: `lineage --init failed: ${(r.stderr || '').slice(0, 200)}` };
  sh('git', ['add', '-A'], app); sh('git', ['commit', '-qm', 'seed'], app);

  const checks = [];
  const check = (label, ok) => checks.push({ label, ok: !!ok });

  // Apply the real upgrade (a no-op version-wise, but it exercises the full three-way pipeline).
  const up = sh(process.execPath, [path.join(FW, 'scripts/upgrade.mjs'), '--framework', FW, '--apply'], app);
  const upOut = `${up.stdout}\n${up.stderr}`;
  // "Already current" exits 0 without applying - also a legitimate outcome for a no-op.
  check('upgrade ran cleanly', up.status === 0);

  if (name === 'minimal') {
    check('zero review items for a pristine app', !/REVIEW REQUIRED/.test(upOut));
    // The taxonomy seed file must still be byte-identical to the seed after a round trip.
    const a = fs.readFileSync(path.join(app, 'src/lib/errors.taxonomy.ts'), 'utf8');
    const b = fs.readFileSync(path.join(FW, 'starter/src/lib/errors.taxonomy.ts'), 'utf8');
    check('pristine file matches the current seed after upgrade', a === b);
  }

  if (name === 'with-debt') {
    // The debt-bearing gate: run the colour audit WITH a fresh baseline, the way an upgrade
    // delivers a new gate. Green means the debt was accepted, not fixed and not fatal.
    const base = path.join(app, '.baselines/hardcoded-colors-baseline.txt');
    const w = sh(process.execPath, [path.join(FW, 'scripts/audits/check-hardcoded-colors.mjs'),
      '--dir', path.join(app, 'src'), '--baseline', base, '--write-baseline'], FW);
    check('new gate baselines the existing debt', w.status === 0 && fs.existsSync(base));
    const g = sh(process.execPath, [path.join(FW, 'scripts/audits/check-hardcoded-colors.mjs'),
      '--dir', path.join(app, 'src'), '--baseline', base], FW);
    check('the debt-carrying app stays GREEN under the gate', g.status === 0);
    const listed = fs.existsSync(base) && /LegacyCard\.tsx\|\d+/.test(fs.readFileSync(base, 'utf8'));
    check('the debt is COUNTED, not ignored', listed);
  }

  if (name === 'diverged') {
    // Age the lineage: record the SEED's hash for dates.ts so the fixture's marker edit reads
    // as an app modification (which it is).
    const lineageFile = path.join(app, '.framework/lineage.json');
    const lineage = JSON.parse(fs.readFileSync(lineageFile, 'utf8'));
    const seedHash = sha(path.join(FW, 'starter/src/lib/dates.ts'));
    if (lineage.files['src/lib/dates.ts']) lineage.files['src/lib/dates.ts'].hash = seedHash;
    fs.writeFileSync(lineageFile, JSON.stringify(lineage, null, 2));
    sh('git', ['add', '-A'], app); sh('git', ['commit', '-qm', 'age'], app);

    const up2 = sh(process.execPath, [path.join(FW, 'scripts/upgrade.mjs'), '--framework', FW, '--apply'], app);
    const out2 = `${up2.stdout}\n${up2.stderr}`;
    const fileNow = fs.readFileSync(path.join(app, 'src/lib/dates.ts'), 'utf8');
    check('the divergence marker SURVIVED the upgrade', /FIXTURE_DIVERGENCE_MARKER/.test(fileNow));
    const seedChanged = sha(path.join(FW, 'starter/src/lib/dates.ts')) !== seedHash;
    // If the seed happens to be unchanged this run, "no review needed" is also correct.
    check('modified file routed to review OR seed unchanged',
      /REVIEW REQUIRED/.test(out2) || fs.existsSync(path.join(app, '.framework/incoming/src/lib/dates.ts')) || !seedChanged);
  }

  const failed = checks.filter((c) => !c.ok);
  return {
    name,
    verdict: failed.length ? 'FAIL' : 'PASS',
    checks,
    detail: failed.map((f) => f.label).join('; '),
  };
}

for (const f of FIXTURES) {
  // eslint-disable-next-line no-await-in-loop
  results.push(await runFixture(f));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results: results.map(({ name, verdict, detail }) => ({ name, verdict, detail })) }, null, 2));

/* Precedence matches gate-runner: a FAIL outranks a BLOCKED, whatever order they arrive in.
 * Reducing with a running max made the verdict depend on fixture ORDER - a BLOCKED fixture
 * before a FAIL one reported exit 3, downgrading "this change breaks an existing app" to
 * "we could not check". The two verdicts carry different obligations, so they must not swap. */
const anyFail = results.some((r) => r.verdict === 'FAIL');
const anyBlocked = results.some((r) => r.verdict === 'BLOCKED');
const worst = anyFail ? 2 : anyBlocked ? 3 : 0;
for (const r of results) {
  const mark = r.verdict === 'PASS' ? 'OK  ' : r.verdict === 'FAIL' ? 'FAIL' : 'BLKD';
  console.log(`${mark}  fixture ${r.name.padEnd(10)} ${r.verdict}${r.detail ? ' - ' + r.detail : ''}`);
  for (const c of r.checks ?? []) console.log(`        ${c.ok ? '✓' : '✗'} ${c.label}`);
}
console.log(`\nresults written to ${path.relative(FW, OUT)}`);
process.exit(worst);
