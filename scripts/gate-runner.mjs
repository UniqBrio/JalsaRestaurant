#!/usr/bin/env node
/**
 * gate-runner - the deterministic quality gate. The model narrates; this script decides.
 *
 * WHY A SCRIPT AND NOT A CHECKLIST
 *   A verdict typed from memory is a guess with formatting. Every step below runs, in a fixed
 *   prerequisite order, and its result is recorded as one of exactly three values. The dated
 *   report is PREPENDED to TEST_SUMMARY.md so history is never overwritten, and a commit guard
 *   can grep for that block - runner and hook are two ends of one contract.
 *
 * THREE-VALUED RESULTS - and BLOCKED is never silent
 *   PASS     the step ran and succeeded
 *   FAIL     the step ran and found a defect            -> exit 2
 *   BLOCKED  the step COULD NOT run (missing tool, skipped, no environment) -> exit 3
 *   There is deliberately no fourth value for "absent". A step that did not run is BLOCKED and
 *   says why. Green-by-omission is the failure this design exists to prevent: a suite that
 *   reported nothing looks exactly like a suite that passed.
 *
 * PREREQUISITE ORDER
 *   Cheapest and broadest first, and each step runs only if its prerequisite passed. There is
 *   no value in running a browser suite against code that does not compile.
 *
 * EVERY STEP IS TIMED, AND THE REPORT SAYS SO
 *   "Run reports carry stage timings" shipped in v1.13.0 as a rule addressed to the narrator,
 *   and a duration written from memory is a guess with formatting - the same objection that
 *   made the VERDICT a script instead of a checklist. So the runner measures. The report names
 *   the total and the slowest step, and TEST_SUMMARY.md is append-only, so the trend accrues
 *   without anyone maintaining it. A stage nobody can measure is a stage nobody can shorten:
 *   this is the rung under FW-SPEED-003, whose anti-pattern is "a slow run with no timing
 *   data, diagnosed by feeling".
 *
 *   A step that never spawned has no duration - it is reported as "-", never as 0ms. Zero is a
 *   measurement; a step that did not run has none, and printing 0 would make the cheapest
 *   possible run look like the fastest one.
 *
 * USAGE
 *   node scripts/gate-runner.mjs [--only <ids>] [--skip <ids>] [--summary <file>] [--cwd <dir>]
 *                                [--app <dir>] [--logdir <dir>]
 *   Every --skip records the step as BLOCKED with the stated reason. No flag can produce green.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { appPath } from './lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(process.cwd(), arg('--cwd', '.'));

/**
 * ROOT is the thing being CHECKED; FRAMEWORK is where the checkers live. They are the same
 * directory in the framework repo and in a standalone app, and DIFFERENT in a workspace app,
 * where the process half is linked rather than copied - the app deliberately has no scripts/.
 * Resolving a step's own script against ROOT there made every gate report "Cannot find module"
 * as a FAIL: the app's code judged broken because the checker was looking for itself in the
 * wrong repository. A checker's path follows the checker, never the subject.
 */
const FRAMEWORK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fwScript = (rel) => path.resolve(FRAMEWORK, rel);

/**
 * ...and WITHIN the subject, where is the APPLICATION?
 *
 * The FRAMEWORK/ROOT split above answers "where does the checker live". It leaves the second
 * question unasked, and the two are not the same: in the framework repository the application
 * is `starter/`, and in a scaffolded app it is the root. `scripts/lib/layout.mjs` exists to
 * decide that, and every audit imports it. This runner did not - so G5-G8 ran `tsc`, `eslint`
 * and the app's test scripts against the framework root, a directory that deliberately has no
 * tsconfig, no eslint config and no test scripts, because none of those things are the
 * framework's.
 *
 * That did not produce a wrong answer, which someone would have chased. It produced BLOCKED,
 * every time: 24 of the 27 runs in TEST_SUMMARY.md, always the same four steps, always
 * "install the toolchain" pointing at a package.json that would never have one. A verdict
 * that cannot change carries no information, and this file's own comments name the cost - a
 * gate that cries wolf about the environment is a gate people learn to ignore.
 *
 * BLOCKED remains correct when the toolchain is genuinely absent. What changes is that the
 * step is now aimed at the application, and the report says where that is, so a real tooling
 * gap is distinguishable from the runner looking in the wrong place.
 * rung: scripts/gate-scope.test.sh
 */
const APP = path.resolve(ROOT, arg('--app', appPath(ROOT, '.')));
const appRel = path.relative(ROOT, APP).split(path.sep).join('/') || '.';
const SUMMARY = path.resolve(ROOT, arg('--summary', 'TEST_SUMMARY.md'));
// Redirectable, like --summary and for the same reason: a harness that drives the real runner
// must be able to keep its own artifacts out of the tree's. Without this, every test run
// overwrote .gate-logs/G1.log..G11.log with a two-step partial run's output - leaving logs on
// disk that describe a run nobody performed, which is the stale-log trap this file's own
// markBlocked() comment exists to close.
const LOGDIR = path.resolve(ROOT, arg('--logdir', '.gate-logs'));
const ONLY = (arg('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP = (arg('--skip', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP_REASON = arg('--skip-reason', 'skipped by flag, no reason given');

/**
 * G1..G12. Adding a step means adding a row here - there is no other registration point,
 * so a step cannot be added and then silently never called.
 */
const STEPS = [
  { id: 'G1', name: 'Theme artifacts in sync', cmd: ['node', [fwScript('scripts/theme-build.mjs'), '--check']],
    why: 'A hand-edited generated file means the token source is no longer the source of truth.' },
  { id: 'G2', name: 'Contrast (all tokens, both themes)', cmd: ['node', [fwScript('scripts/check-contrast.mjs')]],
    why: 'Proves the palette is readable in every theme before any pixel is rendered.' },
  { id: 'G3', name: 'Theme assets present per theme', cmd: ['node', [fwScript('scripts/check-theme-assets.mjs')]],
    why: 'A logo is a colour decision that lives in a file; no stylesheet gate can see it.' },
  { id: 'G4', name: 'No hard-coded colours', cmd: ['node', [fwScript('scripts/audits/check-hardcoded-colors.mjs')]],
    why: 'Contrast gates prove the tokens are safe; only this proves nothing bypassed them.' },
  // `app: true` means "this step judges the APPLICATION, so run it where the application is".
  // Everything without it judges the tree as a whole and runs at ROOT.
  { id: 'G5', name: 'Types', cmd: ['tsc', ['--noEmit']], localBin: 'typescript', app: true,
    why: 'The deploy build strips types without checking them. This is the only compile gate.',
    prerequisiteFor: ['G6', 'G7', 'G8'] },
  { id: 'G6', name: 'Lint', cmd: ['eslint', ['.', '--max-warnings', '0']], localBin: 'eslint', app: true,
    why: 'Style is cheap; the value is the correctness rules a linter can actually decide.' },
  { id: 'G7', name: 'Unit + pure specs', cmd: ['npm', ['run', '--silent', 'test:unit']], app: true,
    why: 'No server, no credentials: these run in every environment, so they always execute.' },
  { id: 'G8', name: 'Functional / integration', cmd: ['npm', ['run', '--silent', 'test:functional']], app: true,
    why: 'Behaviour against real components. Slower, so it runs after the cheap gates.' },
  { id: 'G9', name: 'Automation addressability', cmd: ['node', [fwScript('scripts/audits/check-testid-coverage.mjs')]],
    why: 'A suite can only assert on elements it can address.' },
  { id: 'G10', name: 'Backward compatibility (fixtures)', cmd: ['node', [fwScript('scripts/audits/check-backward-compat.mjs')]],
    why: 'A framework change may not turn any fixture app green -> red. "Existing features must not break" is tested here, not asserted.' },
  { id: 'G11', name: 'Wide tables are configurable', cmd: ['node', [fwScript('scripts/audits/check-column-control.mjs')]],
    why: 'A table degrades into unusability one column at a time, and no single change is ever the one that broke it. CP-21.' },
  { id: 'G12', name: 'Installable as an application', cmd: ['node', [fwScript('scripts/audits/check-pwa-baseline.mjs')]],
    why: 'Every part of PWA support is easy to half-do, and every half-done version looks finished: a manifest nothing links, '
      + 'a worker nothing registers, an icon that was declared and never added. None break a build; all mean the app cannot '
      + 'be installed, which nobody discovers until someone tries it on a phone. CP-30.' },
];

fs.mkdirSync(LOGDIR, { recursive: true });
const results = [];
const passed = new Set();

/**
 * Record a step that never spawned. The log is written too, and that is the point: a step
 * that did not run this time must not leave last run's log sitting on disk describing it.
 * Reading a stale log as current is the same mistake as reading silence as success.
 */
function markBlocked(step, detail, flagged = false) {
  fs.writeFileSync(path.join(LOGDIR, `${step.id}.log`), `BLOCKED: ${detail}
`, 'utf8');
  // `flagged`: blocked by this run's own --only/--skip. That is a fact about the invocation,
  // not about the step, and the trend below must not count it as one.
  results.push({ ...step, status: 'BLOCKED', detail, flagged });
}

/**
 * Resolve a CLI from the project's own node_modules, walking up as npm itself does.
 * Deliberately NOT `npx`: when a tool is not installed locally, npx treats that as a reason
 * to fetch SOMETHING of that name from the registry and run it. That is wrong twice over.
 * It executes an unreviewed package on every gate run - `npx tsc` in a project without
 * TypeScript installs `tsc@2.0.4`, an unrelated 2016 package that only prints a joke - and
 * the joke exits non-zero, so "this machine cannot check your types" arrives dressed as
 * "your types are broken". A step whose tool is absent has not run, and the honest word
 * for a step that has not run is BLOCKED.
 */
function resolveBin(name, from = ROOT) {
  const exts = process.platform === 'win32' ? ['.cmd', '.CMD', ''] : [''];
  // Walk up from where the step will RUN, not from ROOT. An application tool is installed
  // beside the application's package.json; starting the walk at ROOT found nothing in the
  // framework repository and reported the app's toolchain missing when it was merely
  // elsewhere. Walking up still reaches ROOT, so a hoisted install resolves either way.
  for (let dir = from; ; dir = path.dirname(dir)) {
    for (const ext of exts) {
      const p = path.join(dir, 'node_modules', '.bin', name + ext);
      if (fs.existsSync(p)) return p;
    }
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * Distinguish "the tool ran and found problems" from "the tool could not be obtained".
 * Only the first is a FAIL. Getting this wrong in either direction is expensive: a missing
 * tool reported as FAIL erodes trust in the gate; a missing tool reported as PASS is the
 * green-by-omission this whole design exists to prevent. So it is neither - it is BLOCKED.
 */
const UNAVAILABLE = [
  /npm error code E(403|404|NOTFOUND|AI_FALLBACK|CONNRESET)/i,
  /403 Forbidden - GET https:\/\/registry/i,
  /could not determine executable to run/i,
  /command not found/i,
  /is not recognized as an internal or external command/i,
  /Cannot find module '(typescript|eslint|@playwright)/i,
  /npm error 404 Not Found - GET/i,
  /Missing script:/i,
  /getaddrinfo (ENOTFOUND|EAI_AGAIN)/i,
  // npx announcing an install is proof the tool was NOT present locally, whatever it then ran.
  /npm warn exec The following package was not found and will be installed/i,
  // A gate script that cannot be located is the checker missing, not the code failing.
  /Cannot find module .*[\\/]scripts[\\/]/i,
  /This is not the tsc command you are looking for/i,
];
const unavailable = (text) => UNAVAILABLE.some((re) => re.test(text));
const firstSignal = (text) => {
  for (const re of UNAVAILABLE) { const m = text.match(re); if (m) return m[0].slice(0, 140); }
  return 'tool not runnable';
};

/**
 * A fingerprint of the TREE UNDER TEST - what the gate actually verifies.
 *
 * WHY THIS IS WORTH KNOWING
 *   The gate verifies a tree, not a change. Running it once per correction while several
 *   corrections land in ONE commit re-verifies the same tree N times, and only the last run
 *   describes what ships - the earlier ones described trees that no longer exist. Observed on
 *   this repository: three `guard:test` runs and four gate runs inside a single 25-minute run.
 *
 *   This is a NOTICE, never a block and never a cache. A gate that skipped work because it
 *   believed nothing had changed would be trusting a fingerprint over the code, and the first
 *   time the fingerprint was wrong the failure would be a green run over a broken tree. So it
 *   runs every step every time, and merely says when a run was avoidable.
 */
function treeFingerprint() {
  try {
    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
    const dirty = spawnSync('git', ['status', '--porcelain=v1'], { cwd: ROOT, encoding: 'utf8' });
    if (head.status !== 0 || dirty.status !== 0) return null;
    // The dirty listing includes every modified path; hashing their CONTENT would be more
    // precise and much slower, and the mtime-free porcelain output already changes whenever a
    // file is added, removed or edited between two runs.
    // EXCLUDE THE GATE'S OWN OUTPUT. Every run rewrites TEST_SUMMARY.md and .gate-logs/, so a
    // fingerprint that counted them differed from the previous run BY DEFINITION and could
    // never report a redundant run - the detector reading its own output as evidence, which is
    // the one thing a detector in this repository may never do. Observed failing exactly that
    // way before this exclusion existed.
    const SELF = /(^|\/)(TEST_SUMMARY\.md|\.gate-logs\/)/;
    const stat = (dirty.stdout || '').split(/\r?\n/).filter(Boolean).filter((l) => !SELF.test(l.slice(3).trim())).map((line) => {
      const file = line.slice(3).trim();
      try { const st = fs.statSync(path.resolve(ROOT, file)); return `${line}:${st.size}:${st.mtimeMs}`; }
      catch { return line; }
    }).sort().join('\n');
    return `${(head.stdout || '').trim()}\n${stat}`;
  } catch { return null; }
}

/**
 * Human duration. Seconds below a minute, m+s above: "870ms" reads as noise at a glance, and
 * the point of this number is that a person compares it to the last run without arithmetic.
 * undefined means the step never ran, and prints as "-".
 */
function fmtMs(ms) {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  return `${m}m ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`;
}

/** Keep the SIGNAL and drop installer noise. A naive tail buries the actual error. */
function distil(text) {
  const SIGNAL = [/error/i, /failed/i, /BLOCKED/, /✕/, /✗/, /expected/i, /Cannot find/i, /not found/i];
  const NOISE = [/^npm (warn|notice)/i, /^\s*$/, /deprecated/i, /packages are looking for funding/i];
  const lines = text.split(/\r?\n/)
    .filter((l) => SIGNAL.some((r) => r.test(l)) && !NOISE.some((r) => r.test(l)))
    .slice(0, 15);
  const out = lines.join('\n');
  return out.length > 1200 ? out.slice(0, 1200) + '\n... (truncated)' : out;
}

function run(step) {
  if (ONLY.length && !ONLY.includes(step.id)) {
    markBlocked(step, `not selected by --only ${ONLY.join(',')}`, true);
    return;
  }
  if (SKIP.includes(step.id)) {
    markBlocked(step, SKIP_REASON, true);
    return;
  }
  const unmet = STEPS.filter((s) => s.prerequisiteFor?.includes(step.id) && !passed.has(s.id));
  if (unmet.length) {
    markBlocked(step, `prerequisite ${unmet.map((u) => u.id).join(', ')} did not pass`);
    return;
  }

  let [bin, args] = step.cmd;
  // An application step is judged where the application lives; every other step judges the
  // whole tree and stays at ROOT.
  const cwd = step.app ? APP : ROOT;
  if (step.localBin) {
    const resolved = resolveBin(bin, cwd);
    if (!resolved) {
      // Name the directory. "Run npm install" without one sent the reader to the framework's
      // package.json, which will never carry the application's toolchain - a remediation that
      // cannot work reads as the gate being broken, and it was.
      markBlocked(step, `no local "${bin}" in ${step.app ? appRel : '.'} - not fetched from the `
        + `registry on purpose. Run \`npm install\` in ${step.app ? appRel : '.'} `
        + `(provides ${step.localBin}), or state why this class is unverified.`);
      return;
    }
    bin = resolved;
  }
  // Under a shell the whole line is re-parsed, so anything containing a space must be quoted -
  // args as well as the binary. Step arguments are now absolute framework paths, and
  // "C:\Program Files\..." would otherwise arrive as two arguments.
  const shell = process.platform === 'win32';
  const q = (v) => (shell && /\s/.test(v) && !v.startsWith('"') ? `"${v}"` : v);
  let r;
  const startedAt = Date.now();
  try {
    r = spawnSync(q(bin), args.map(q), { cwd, encoding: 'utf8', shell, timeout: 15 * 60_000 });
  } catch (e) {
    markBlocked(step, `could not launch "${bin}": ${e.message}`);
    return;
  }
  // Measured around the spawn itself, so it is the step's cost and not the report's.
  const ms = Date.now() - startedAt;
  if (r.error?.code === 'ENOENT') {
    markBlocked(step, `tool not found: ${bin}. Install it or state why this class is unverified.`);
    return;
  }
  if (r.error?.code === 'ETIMEDOUT') {
    results.push({ ...step, status: 'FAIL', detail: 'timed out after 15 minutes', ms });
    return;
  }

  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  fs.writeFileSync(path.join(LOGDIR, `${step.id}.log`), output, 'utf8');

  if (r.status === 0) { passed.add(step.id); results.push({ ...step, status: 'PASS', detail: '', ms }); }
  else if (r.status === 3) results.push({ ...step, status: 'BLOCKED', detail: distil(output) || 'step reported BLOCKED', ms });
  else if (unavailable(output)) {
    // The step could not RUN. That is BLOCKED, not FAIL - and the distinction is not pedantry:
    // a FAIL says "your code is broken" when the truth is "this machine cannot check it". A
    // gate that cries wolf about the environment is a gate people learn to ignore, and then it
    // is worth less than no gate at all.
    results.push({ ...step, status: 'BLOCKED', detail: `tooling unavailable - ${firstSignal(output)}`, ms });
  }
  else results.push({ ...step, status: 'FAIL', detail: distil(output) || `exit ${r.status}`, ms });
}

const FINGERPRINT_FILE = path.join(LOGDIR, 'last-tree.txt');
const fingerprint = treeFingerprint();
const priorFingerprint = fs.existsSync(FINGERPRINT_FILE) ? fs.readFileSync(FINGERPRINT_FILE, 'utf8') : null;
const redundant = Boolean(fingerprint && priorFingerprint && fingerprint === priorFingerprint);

/**
 * ONLY A RUN THAT VERIFIED THE WHOLE TREE MAY RECORD THAT THE TREE WAS VERIFIED.
 *
 * The fingerprint answers one question - "has a gate already returned a verdict on exactly
 * these bytes?" - and a run narrowed by --only or --skip has not. It examined two steps out of
 * eleven and knows nothing about the other nine.
 *
 * Writing it anyway made the next FULL run announce "this run was avoidable, the verdict was
 * already known" about a tree no gate had ever judged. Reproduced deterministically: gate a
 * tree, edit a file, run `npm run guard:test` - whose suites drive this runner with --only
 * against the framework root - then gate again, and the notice fires on a run that was
 * mandatory. The suites were not misusing the runner; the runner was recording a claim its
 * own run did not support.
 *
 * This is the same defect the SELF exclusion in treeFingerprint() already fixed once, in its
 * narrow form: a detector must never treat its own output as evidence. The general form is the
 * rule stated above, and it is the one worth keeping - the exclusion list handles the files,
 * this handles the claim.
 *
 * The notice is still only ever a NOTICE. A partial run may READ the fingerprint and say a
 * full verdict on these bytes already exists; what it may not do is leave a record implying it
 * produced one.
 * rung: scripts/gate-scope.test.sh
 */
const verifiedWholeTree = ONLY.length === 0 && SKIP.length === 0;

const runStartedAt = Date.now();
for (const s of STEPS) run(s);
const totalMs = Date.now() - runStartedAt;
if (fingerprint && verifiedWholeTree) fs.writeFileSync(FINGERPRINT_FILE, fingerprint, 'utf8');

const prior = fs.existsSync(SUMMARY) ? fs.readFileSync(SUMMARY, 'utf8') : '# Test summary\n\n_Newest run first. Append-only: never overwrite a prior run._\n\n---\n\n';

/**
 * THE GATE READS ITS OWN LEDGER, so a verdict that never changes becomes visible.
 *
 * RC-009 - four steps aimed at a directory that could never satisfy them - sat in this file
 * for 24 consecutive runs: same steps, same verdict, every time. Nothing noticed, because the
 * ledger is append-only and nothing reads it for a TREND; a signal that never changes is
 * indistinguishable from no signal. That was recorded as honest debt. This is the payment.
 *
 * For every step BLOCKED in THIS run for a reason of its own (not a --only/--skip flag), count
 * how many prior runs, newest first, ALSO blocked it, and stop at the first that did not. Three
 * or more in a row is named in the report. The count includes runs narrowed by --only, where
 * the step was blocked "not selected": those are not evidence about the step, so a run that
 * did not select it neither extends nor breaks the streak - it is skipped.
 * rung: scripts/gate-scope.test.sh
 */
const TREND_AT = 3;
const priorRuns = prior.split(/^## Gate run /m).slice(1);   // newest first, as the file is kept
function consecutiveBlocked(id) {
  let n = 1;                                                 // this run
  for (const run of priorRuns) {
    const line = run.split(/\r?\n/).find((l) => new RegExp(`^- \\*\\*${id} `).test(l));
    if (!line) break;                                         // a run that predates the step
    if (/not selected by --only|skipped by flag/.test(line)) continue;   // not evidence either way
    if (/\*\* - BLOCKED/.test(line)) n++; else break;
  }
  return n;
}
for (const r of results) {
  if (r.status !== 'BLOCKED' || r.flagged) continue;
  const n = consecutiveBlocked(r.id);
  if (n >= TREND_AT) r.trend = n;
}

/* ---- report ---- */
const fails = results.filter((r) => r.status === 'FAIL');
const blocked = results.filter((r) => r.status === 'BLOCKED');
const verdict = fails.length ? 'FAIL' : blocked.length ? 'BLOCKED' : 'PASS';
// Naming the slowest step is the whole point: a total tells you the run was slow, and the
// next question is always "which part". Steps that never spawned have no ms and cannot win.
const timed = results.filter((r) => typeof r.ms === 'number');
const slowest = timed.length ? timed.reduce((a, b) => (b.ms > a.ms ? b : a)) : null;

const block = [
  `## Gate run - ${new Date().toISOString().slice(0, 10)} - VERDICT: ${verdict}`,
  '',
  `Steps: ${results.filter((r) => r.status === 'PASS').length} pass, ${fails.length} fail, ${blocked.length} blocked.`,
  `Time: ${fmtMs(totalMs)} total${slowest ? ` - slowest ${slowest.id} ${slowest.name} (${fmtMs(slowest.ms)})` : ''}.`,
  // State the subject, always - not only when it is surprising. A reader who cannot see which
  // directory G5-G8 were aimed at cannot tell an absent toolchain from a misaimed runner, and
  // for 24 consecutive runs nobody could.
  `Application steps ran in ${appRel}`,
  ...(redundant ? ['',
    '> **This run was avoidable.** The tree is byte-identical to the previous gate run, so this'
    + ' verdict was already known. The gate verifies a TREE, not a change: corrections landing in'
    + ' one commit share one verification, and only the last run describes what ships. Corrections'
    + ' in SEPARATE commits each need their own, so every commit is independently bisectable.'] : []),
  '',
  ...results.map((r) => {
    const head = `- **${r.id} ${r.name}** - ${r.status} (${fmtMs(r.ms)})`;
    if (r.status === 'PASS') return head;
    if (r.status === 'BLOCKED') {
      const why = String(r.detail).split('\n')[0].slice(0, 200);
      // A streak is named where the reader is already looking - on the step's own line.
      return r.trend ? `${head} - ${why} - **${r.trend} consecutive runs**: a verdict that never changes is not a signal; make this class runnable or accept it in writing` : `${head} - ${why}`;
    }
    return `${head}\n\n\`\`\`\n${r.detail}\n\`\`\`\n`;
  }),
  '',
  verdict === 'PASS'
    ? '_All runnable gates green. Merge is cleared by the mechanical gate; the human review items in checklists/DEFINITION_OF_DONE.md still apply._'
    : verdict === 'BLOCKED'
      ? '_One or more classes could NOT be verified. This is a decision for the owner, not a pass. Name the accepted IDs in writing or make the class runnable._'
      : '_Merge blocked. Every FAIL above must resolve. No partial merges._',
  '',
  '---',
  '',
].join('\n');

const headerEnd = prior.indexOf('---\n');
const head = headerEnd >= 0 ? prior.slice(0, headerEnd + 4) : '';
const tail = headerEnd >= 0 ? prior.slice(headerEnd + 4) : prior;
fs.writeFileSync(SUMMARY, `${head}\n${block}${tail}`, 'utf8');

console.log(block);
console.log(`Full logs: ${path.relative(ROOT, LOGDIR)}/`);
console.log(`Report prepended to ${path.relative(ROOT, SUMMARY)}`);
process.exit(verdict === 'FAIL' ? 2 : verdict === 'BLOCKED' ? 3 : 0);
