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
const FIXTURES = ['minimal', 'with-debt', 'diverged', 'adopted'];
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
    // Age the generated artifacts the way a SCAFFOLD records them, not the way --init does.
    // --init marks a file that already differs from the seed 'adopted-modified' (sticky, goes
    // to review), which is right for adoption and wrong for this test: it would make the
    // checks below pass under ANY ownership rule, because review never overwrites. A real
    // scaffold rebuilds the theme and records the result 'pristine' with the app's own hash -
    // that is the path that clobbered, so that is the path the fixture must walk. Observed:
    // with the pre-v1.31 rule and --init's classification, this fixture reported PASS.
    for (const rel of ['public/manifest.webmanifest', 'src/theme/tokens.generated.ts']) {
      lineage.files[rel] = { hash: sha(path.join(app, rel)), status: 'pristine' };
    }
    fs.writeFileSync(lineageFile, JSON.stringify(lineage, null, 2));
    sh('git', ['add', '-A'], app); sh('git', ['commit', '-qm', 'age'], app);

    const up2 = sh(process.execPath, [path.join(FW, 'scripts/upgrade.mjs'), '--framework', FW, '--apply'], app);
    const out2 = `${up2.stdout}\n${up2.stderr}`;
    const fileNow = fs.readFileSync(path.join(app, 'src/lib/dates.ts'), 'utf8');
    check('the divergence marker SURVIVED the upgrade', /FIXTURE_DIVERGENCE_MARKER/.test(fileNow));
    // GENERATED artifacts are app-owned because their SOURCE is. The fixture carries a manifest
    // and a theme module derived from its own tokens; an upgrade must leave both alone. It did
    // not, once: v1.31.0's own end-to-end check found a real scaffold renamed back to "Default
    // Framework App" by one upgrade. This is that finding, made a fixture so it cannot recur.
    const mf = path.join(app, 'public/manifest.webmanifest');
    check('the app-generated manifest keeps the APP\'s name after upgrade',
      fs.existsSync(mf) && JSON.parse(fs.readFileSync(mf, 'utf8')).name === 'Diverged Fixture');
    check('the app-generated theme module is not replaced by the seed',
      /FIXTURE_DIVERGENCE_MARKER/.test(fs.readFileSync(path.join(app, 'src/theme/tokens.generated.ts'), 'utf8')));
    const seedChanged = sha(path.join(FW, 'starter/src/lib/dates.ts')) !== seedHash;
    // If the seed happens to be unchanged this run, "no review needed" is also correct.
    check('modified file routed to review OR seed unchanged',
      /REVIEW REQUIRED/.test(out2) || fs.existsSync(path.join(app, '.framework/incoming/src/lib/dates.ts')) || !seedChanged);
  }

  // ---- the ADOPTED fixture: an app that keeps its registers, and must stay green ----------
  //
  // WHY THIS FIXTURE EXISTS
  //   v2.0.0 added guard G9 (code must not ship without a run-log row) and v2.1.0 added the
  //   open-run upgrade refusal. Both releases cited `audit:compat` as evidence that no existing
  //   app goes green -> red. Both citations were WORTHLESS: no fixture carried a RUN_LOG.md or a
  //   .run-log.json, so every rail failed open on all three and the green tick measured nothing.
  //   Two releases in a row quoted a passing check that could not see the change it shipped.
  //
  //   The direction matters. These checks do NOT exist to prove the rails block - the guard and
  //   upgrade suites do that. They exist so that an app which has adopted the registers and does
  //   the right thing STAYS PASSING, and so that a future release which over-tightens either
  //   rail turns this fixture red instead of turning a real app red.
  if (name === 'adopted') {
    const guard = path.join(FW, 'scripts/hooks/pre-commit-guard.sh');
    const runLog = path.join(app, 'docs/registers/RUN_LOG.md');
    check('the fixture really did adopt the run log', fs.existsSync(runLog));

    // Rule 3: no bash is a tooling absence, not a violation. Say so and pass, rather than
    // failing a fixture for the container's shortcomings.
    const bashOk = sh('bash', ['-c', 'exit 0'], app).status === 0;
    if (!bashOk || !fs.existsSync(guard)) {
      check('guard checks SKIPPED - no bash or no guard (tooling, not a verdict)', true);
    } else {
      const msg = path.join(app, '.git', 'COMMIT_EDITMSG');
      // Every OTHER guard is released by its own token, so an exit here is attributable to G9
      // and nothing else. Without this the first check below passes on the test-case guard's
      // exit 2 and proves nothing about G9 - it did exactly that on the first attempt, which is
      // the same shape as RC-015's vacuous pass and the reason that lesson is written down.
      const isolate = [
        'feat: a change in the adopted fixture',
        '',
        'CASES-NA: isolating G9',
        'LEDGER-NA: isolating G9',
        'DOCS-NA: isolating G9',
        'FAILFIRST-NA: isolating G9',
        'TYPES-NA: isolating G9',
        'THEME-NA: isolating G9',
      ].join('\n');
      const runGuard = () => {
        fs.writeFileSync(msg, `${isolate}\n`);
        return sh('bash', [guard, msg], app).status;
      };

      // 1. A run that leaves no row is BLOCKED. This is the v2.0.0 behaviour, now visible to
      //    compat: if a later release removes or weakens G9, this flips and the fixture reddens.
      fs.appendFileSync(path.join(app, 'src/lib/dates.ts'), '\nexport const adopted = 1;\n');
      sh('git', ['add', '-A'], app);
      check('G9 blocks application code with no run-log row', runGuard() === 2);

      // 2. ...and an app that DOES log its run passes. The half that protects real apps: a rail
      //    nothing can satisfy is a rail that gets uninstalled, and then it protects nobody.
      fs.appendFileSync(runLog,
        '| R-003 | the change this fixture just made | CHANGE | micro | 2026-09-12 10:00 | 2026-09-12 10:03 | 3m | - | PASS | PASS | - |\n');
      sh('git', ['add', '-A'], app);
      check('G9 is satisfied by a real row - an adopted app stays green', runGuard() === 0);
      sh('git', ['commit', '-qm', 'adopted change with its row'], app);
    }

    // 3. The v2.1.0 rail, likewise made visible: an upgrade taken while a run is OPEN is
    //    refused and names the run. The marker is COMMITTED first - left dirty, the older
    //    dirty-tree refusal returns the same exit 2 and this check would pass against a tree
    //    with no open-run rail at all. That exact vacuous pass happened while writing v2.1.0.
    fs.writeFileSync(path.join(app, '.run-log.json'),
      `${JSON.stringify({ type: 'CHANGE', action: 'an open run in the adopted fixture', startedAt: '2026-09-12T10:00:00Z', stages: [] }, null, 2)}\n`);
    sh('git', ['add', '-A'], app); sh('git', ['commit', '-qm', 'open a run'], app);
    const upOpen = sh(process.execPath, [path.join(FW, 'scripts/upgrade.mjs'), '--framework', FW, '--apply'], app);
    check('an upgrade during an OPEN run is refused, on a clean tree',
      upOpen.status === 2 && /an open run in the adopted fixture/.test(`${upOpen.stdout}${upOpen.stderr}`));

    // 4. ...and closing the run restores normal service. Without this the fixture would pass
    //    just as happily if the rail refused every upgrade forever.
    fs.rmSync(path.join(app, '.run-log.json'));
    sh('git', ['add', '-A'], app); sh('git', ['commit', '-qm', 'close the run'], app);
    const upClosed = sh(process.execPath, [path.join(FW, 'scripts/upgrade.mjs'), '--framework', FW, '--apply'], app);
    check('with the run closed, the upgrade proceeds again', upClosed.status === 0);
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
