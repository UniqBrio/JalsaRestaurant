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
 * USAGE
 *   node scripts/gate-runner.mjs [--only <ids>] [--skip <ids>] [--summary <file>] [--cwd <dir>]
 *   Every --skip records the step as BLOCKED with the stated reason. No flag can produce green.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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
const SUMMARY = path.resolve(ROOT, arg('--summary', 'TEST_SUMMARY.md'));
const LOGDIR = path.resolve(ROOT, '.gate-logs');
const ONLY = (arg('--only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP = (arg('--skip', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP_REASON = arg('--skip-reason', 'skipped by flag, no reason given');

/**
 * G1..G11. Adding a step means adding a row here - there is no other registration point,
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
  { id: 'G5', name: 'Types', cmd: ['tsc', ['--noEmit']], localBin: 'typescript',
    why: 'The deploy build strips types without checking them. This is the only compile gate.',
    prerequisiteFor: ['G6', 'G7', 'G8'] },
  { id: 'G6', name: 'Lint', cmd: ['eslint', ['.', '--max-warnings', '0']], localBin: 'eslint',
    why: 'Style is cheap; the value is the correctness rules a linter can actually decide.' },
  { id: 'G7', name: 'Unit + pure specs', cmd: ['npm', ['run', '--silent', 'test:unit']],
    why: 'No server, no credentials: these run in every environment, so they always execute.' },
  { id: 'G8', name: 'Functional / integration', cmd: ['npm', ['run', '--silent', 'test:functional']],
    why: 'Behaviour against real components. Slower, so it runs after the cheap gates.' },
  { id: 'G9', name: 'Automation addressability', cmd: ['node', [fwScript('scripts/audits/check-testid-coverage.mjs')]],
    why: 'A suite can only assert on elements it can address.' },
  { id: 'G10', name: 'Backward compatibility (fixtures)', cmd: ['node', [fwScript('scripts/audits/check-backward-compat.mjs')]],
    why: 'A framework change may not turn any fixture app green -> red. "Existing features must not break" is tested here, not asserted.' },
  { id: 'G11', name: 'Wide tables are configurable', cmd: ['node', [fwScript('scripts/audits/check-column-control.mjs')]],
    why: 'A table degrades into unusability one column at a time, and no single change is ever the one that broke it. CP-21.' },
];

fs.mkdirSync(LOGDIR, { recursive: true });
const results = [];
const passed = new Set();

/**
 * Record a step that never spawned. The log is written too, and that is the point: a step
 * that did not run this time must not leave last run's log sitting on disk describing it.
 * Reading a stale log as current is the same mistake as reading silence as success.
 */
function markBlocked(step, detail) {
  fs.writeFileSync(path.join(LOGDIR, `${step.id}.log`), `BLOCKED: ${detail}
`, 'utf8');
  results.push({ ...step, status: 'BLOCKED', detail });
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
function resolveBin(name) {
  const exts = process.platform === 'win32' ? ['.cmd', '.CMD', ''] : [''];
  for (let dir = ROOT; ; dir = path.dirname(dir)) {
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
    markBlocked(step, `not selected by --only ${ONLY.join(',')}`);
    return;
  }
  if (SKIP.includes(step.id)) {
    markBlocked(step, SKIP_REASON);
    return;
  }
  const unmet = STEPS.filter((s) => s.prerequisiteFor?.includes(step.id) && !passed.has(s.id));
  if (unmet.length) {
    markBlocked(step, `prerequisite ${unmet.map((u) => u.id).join(', ')} did not pass`);
    return;
  }

  let [bin, args] = step.cmd;
  if (step.localBin) {
    const resolved = resolveBin(bin);
    if (!resolved) {
      markBlocked(step, `no local "${bin}" - not fetched from the registry on purpose. `
        + `Run \`npm install\` (provides ${step.localBin}), or state why this class is unverified.`);
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
  try {
    r = spawnSync(q(bin), args.map(q), { cwd: ROOT, encoding: 'utf8', shell, timeout: 15 * 60_000 });
  } catch (e) {
    markBlocked(step, `could not launch "${bin}": ${e.message}`);
    return;
  }
  if (r.error?.code === 'ENOENT') {
    markBlocked(step, `tool not found: ${bin}. Install it or state why this class is unverified.`);
    return;
  }
  if (r.error?.code === 'ETIMEDOUT') {
    results.push({ ...step, status: 'FAIL', detail: 'timed out after 15 minutes' });
    return;
  }

  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  fs.writeFileSync(path.join(LOGDIR, `${step.id}.log`), output, 'utf8');

  if (r.status === 0) { passed.add(step.id); results.push({ ...step, status: 'PASS', detail: '' }); }
  else if (r.status === 3) results.push({ ...step, status: 'BLOCKED', detail: distil(output) || 'step reported BLOCKED' });
  else if (unavailable(output)) {
    // The step could not RUN. That is BLOCKED, not FAIL - and the distinction is not pedantry:
    // a FAIL says "your code is broken" when the truth is "this machine cannot check it". A
    // gate that cries wolf about the environment is a gate people learn to ignore, and then it
    // is worth less than no gate at all.
    results.push({ ...step, status: 'BLOCKED', detail: `tooling unavailable - ${firstSignal(output)}` });
  }
  else results.push({ ...step, status: 'FAIL', detail: distil(output) || `exit ${r.status}` });
}

for (const s of STEPS) run(s);

/* ---- report ---- */
const fails = results.filter((r) => r.status === 'FAIL');
const blocked = results.filter((r) => r.status === 'BLOCKED');
const verdict = fails.length ? 'FAIL' : blocked.length ? 'BLOCKED' : 'PASS';

const block = [
  `## Gate run - ${new Date().toISOString().slice(0, 10)} - VERDICT: ${verdict}`,
  '',
  `Steps: ${results.filter((r) => r.status === 'PASS').length} pass, ${fails.length} fail, ${blocked.length} blocked.`,
  '',
  ...results.map((r) => {
    const head = `- **${r.id} ${r.name}** - ${r.status}`;
    if (r.status === 'PASS') return head;
    if (r.status === 'BLOCKED') return `${head} - ${String(r.detail).split('\n')[0].slice(0, 200)}`;
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

const prior = fs.existsSync(SUMMARY) ? fs.readFileSync(SUMMARY, 'utf8') : '# Test summary\n\n_Newest run first. Append-only: never overwrite a prior run._\n\n---\n\n';
const headerEnd = prior.indexOf('---\n');
const head = headerEnd >= 0 ? prior.slice(0, headerEnd + 4) : '';
const tail = headerEnd >= 0 ? prior.slice(headerEnd + 4) : prior;
fs.writeFileSync(SUMMARY, `${head}\n${block}${tail}`, 'utf8');

console.log(block);
console.log(`Full logs: ${path.relative(ROOT, LOGDIR)}/`);
console.log(`Report prepended to ${path.relative(ROOT, SUMMARY)}`);
process.exit(verdict === 'FAIL' ? 2 : verdict === 'BLOCKED' ? 3 : 0);
