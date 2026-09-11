#!/usr/bin/env node
/**
 * review-plan - decide WHICH review passes a change needs, from the diff, deterministically.
 *
 * WHY A SCRIPT AND NOT THE TABLE
 *   The review matrix in workflows/agents/README.md is correct and has been since v1.15.0. It
 *   is also applied by a model re-reading it and judging each row against a diff it has just
 *   written - so the same change can select different reviewers on two runs, and the failure
 *   is invisible: a missing pass looks exactly like a pass that found nothing. Selection is a
 *   decision about facts in the diff, and facts in the diff are computable.
 *
 * THIS IS THE AUTHORITY, THE TABLE IS THE EXPLANATION
 *   Two sources of truth for one rule always drift, and the drifted one is always the one
 *   someone finds first - the same reason CLAUDE.md forbids copying runbooks into slash
 *   commands. So the README table now points HERE for selection and keeps the job of saying
 *   WHY each pass exists, which no script can do.
 *
 * WHAT IT HONESTLY CANNOT SEE - and says so rather than guessing
 *   - HOTSPOT: whether a file is one is a judgement about history, not a fact in this diff.
 *     Pass --hotspot to declare it; the plan then escalates to full-scale.
 *   - ADDITIVE vs DESTRUCTIVE SCHEMA: it detects that a migration exists, never that it is
 *     safe. Any schema change pulls in the parity pass and forbids micro.
 *   - VISIBLE STRINGS: a heuristic (a quoted phrase containing a space, in UI source). It errs
 *     toward INCLUDING the copy pass: a needless copy review costs one agent, a missed one
 *     ships a reworded shipped string, and only one of those is recoverable.
 *
 * EXIT CODES
 *   0 plan produced   2 bad usage   3 BLOCKED - no diff could be read, so nothing was decided.
 *   A plan of "no reviewers" and a plan that could not be computed must never look alike.
 *
 * USAGE
 *   node scripts/review-plan.mjs [--range <git-range>] [--scale auto|micro|scoped|full-scale]
 *                                [--hotspot] [--json]
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

const RANGE = flag('--range', '');
const WANT_SCALE = flag('--scale', 'auto');
const JSON_OUT = has('--json');
const HOTSPOT = has('--hotspot');

if (!['auto', 'micro', 'scoped', 'full-scale'].includes(WANT_SCALE)) {
  console.error('review-plan: --scale must be auto | micro | scoped | full-scale');
  process.exit(2);
}

const git = (args) => spawnSync('git', args, { encoding: 'utf8' });

/* The change is the staged index at commit time and the range at push/review time - the same
 * two modes the pre-commit guard reads, for the same reason: reading only the index finds an
 * empty diff in the mode people actually review in. */
function changedFiles() {
  const r = RANGE ? git(['diff', '--name-only', RANGE]) : git(['diff', '--cached', '--name-only']);
  if (r.status !== 0) return null;
  let files = r.stdout.split(/\r?\n/).filter(Boolean);
  if (!files.length && !RANGE) {
    // Nothing staged: fall back to the working tree, so the plan is usable mid-change.
    const w = git(['diff', '--name-only']);
    if (w.status === 0) files = w.stdout.split(/\r?\n/).filter(Boolean);
  }
  return files;
}

function addedFiles() {
  const r = RANGE ? git(['diff', '--name-only', '--diff-filter=A', RANGE])
                  : git(['diff', '--cached', '--name-only', '--diff-filter=A']);
  return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
}

/** Added or changed lines only. A reviewer is selected by what the diff DID, not what the file contains. */
function addedLines() {
  const r = RANGE ? git(['diff', '-U0', RANGE]) : git(['diff', '--cached', '-U0']);
  if (r.status !== 0) return '';
  return r.stdout.split(/\r?\n/).filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
}

const files = changedFiles();
if (files === null) {
  console.error('BLOCKED [review-plan] no git diff could be read - not a repository, or git is unavailable.');
  console.error('  A plan of "no reviewers needed" and a plan that could not be computed must never look alike.');
  process.exit(3);
}
if (!files.length) {
  console.error('BLOCKED [review-plan] the diff is empty - there is no change to plan reviews for.');
  process.exit(3);
}

const added = addedFiles();
const plus = addedLines();

/* Close-out ARTIFACTS are not the change: tests, docs, baselines and the ledger. Counting them
 * pushes every honest small run over its own limit - the same exclusion guard G8 applies. */
const SOURCE_EXCLUDE = /(\.spec\.[jt]sx?$|\.test\.[jt]sx?$|^tests\/|\/tests\/|\.md$|\.baselines\/|^\.gate-logs\/)/;
const source = files.filter((f) => !SOURCE_EXCLUDE.test(f));

const facts = {
  files: files.length,
  sourceFiles: source.length,
  schema: files.some((f) => /(^|\/)migrations\//.test(f) || /\.sql$/.test(f)),
  newComponent: added.some((f) => /(^|\/)components\//.test(f)),
  dependency: files.some((f) => /(^|\/)package\.json$/.test(f)),
  // An exported symbol is where two files become twenty.
  sharedSymbol: /^\+\s*export\s/m.test(plus),
  // Two shapes, because a detector that knew only one missed the commoner one. A quoted phrase
  // catches labels, titles and messages passed as props; JSX TEXT (>Save your changes<) carries
  // no quotes at all and is how most visible copy is actually written. Looking only for quotes
  // read a component full of user-facing sentences as having no strings in it.
  //
  // The JSX half requires TWO WORDS OF LETTERS between the brackets. Matching ">" whitespace
  // "<" instead matched `=> <div` - an arrow function returning JSX, which is how almost every
  // React component is written, so the copy pass would have been selected on nearly every
  // change. A pass that fires on everything is noise, and a noisy pass stops being read, which
  // costs more than the one it was trying not to miss.
  visibleString: files.some((f) => /\.(tsx|jsx)$/.test(f))
    && (/^\+.*["'`][^"'`]*[A-Za-z]{2,}\s+[A-Za-z]{2,}[^"'`]*["'`]/m.test(plus)
     || /^\+.*>[^<>{}]*[A-Za-z]{2,}\s+[A-Za-z]{2,}[^<>{}]*</m.test(plus)),
  permissions: files.some((f) => /(role|permission|policy|rls|tenant|auth)/i.test(f))
    || /^\+.*\b(role|permission|policy|tenant|canAccess|isAdmin)\b/im.test(plus),
  hotspot: HOTSPOT,
};

/* ---- scale ---- */
function deriveScale() {
  if (WANT_SCALE !== 'auto') return { scale: WANT_SCALE, why: 'declared on the command line' };
  if (facts.hotspot) return { scale: 'full-scale', why: 'a hotspot file was declared' };
  if (facts.sourceFiles > 5) return { scale: 'full-scale', why: `${facts.sourceFiles} source files (> 5)` };
  const microBlockers = [
    facts.sourceFiles > 2 && `${facts.sourceFiles} source files (limit 2)`,
    facts.schema && 'a schema change',
    facts.newComponent && 'a newly added component',
    facts.dependency && 'a dependency change',
  ].filter(Boolean);
  if (!microBlockers.length) return { scale: 'micro', why: 'within every micro limit' };
  return { scale: 'scoped', why: `not micro: ${microBlockers.join('; ')}` };
}
const { scale, why } = deriveScale();

/* ---- the matrix, executed ---- */
const plan = [];
const inline = [];
const add = (agent, reason) => plan.push({ agent, reason });
const inl = (pass, reason) => inline.push({ pass, reason });

if (scale === 'full-scale') {
  add('blast-radius-explorer', 'full scale: the impact table is too large to hold inline');
  add('implementation-planner', 'full scale: the plan is its own artifact');
  add('code-reviewer', 'always');
  add('fresh-context-reviewer', 'full scale: a second pass with no memory of building it');
  add('test-gate-runner', 'full scale: exit codes interpreted independently');
  add('close-out-auditor', 'full scale: the close-out is verified, not asserted');
  if (facts.schema || facts.permissions) add('parity-gate-checker', 'data or schema is touched');
} else if (scale === 'scoped') {
  inl('blast radius', 'scoped: the impact table is done inline');
  inl('plan', 'scoped: the plan is a section of RUN_<feature>.md');
  add('code-reviewer', 'always - and for a scoped run it IS the fresh context, having built nothing');
  if (facts.schema) add('parity-gate-checker', 'the schema changed');
  inl('gate', 'scoped: npm run gate inline, read the verdict');
  inl('close-out', 'scoped: the DoD table is the close-out');
} else {
  inl('blast radius', 'micro: one line');
  inl('plan', 'micro: there is no plan to write');
  inl('gate', 'micro: npm run gate inline');
  inl('close-out', 'micro: inline');
  if (facts.sharedSymbol) {
    add('code-reviewer', 'a shared or exported symbol is touched - where two files become twenty');
  } else {
    inl('code review', 'micro: no exported symbol touched, so the inline review stands');
  }
}

if (facts.visibleString) add('copy-gate-reviewer', 'a visible string was added or altered');
if (facts.permissions && scale !== 'micro') add('permission-reviewer', 'roles, policies or tenant data are touched');

/* preview-smoke-verifier is never optional: static gates prove the code agrees with itself;
 * only opening the running app proves it works. Every defect that reached a user was, by
 * definition, runtime-visible. */
add('preview-smoke-verifier', 'after merge - the only stage that opens the running application');

const out = { scale, why, facts, spawn: plan, inline };

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`Review plan - SCALE: ${scale}  (${why})`);
console.log(`  ${facts.files} changed file(s), ${facts.sourceFiles} of them source.`);
const signals = Object.entries(facts)
  .filter(([k, v]) => v === true)
  .map(([k]) => k);
console.log(`  Signals: ${signals.length ? signals.join(', ') : 'none'}`);
console.log('\nSPAWN, in ONE message, in parallel:');
for (const p of plan) console.log(`  - ${p.agent.padEnd(24)} ${p.reason}`);
if (inline.length) {
  console.log('\nInline (the main agent does these itself):');
  for (const i of inline) console.log(`  - ${i.pass.padEnd(24)} ${i.reason}`);
}
console.log('\nTheir boundaries are disjoint by design, so the wall-clock cost of the spawned');
console.log('set is the cost of its slowest member - never the sum. Build in parallel; review after.');
if (!HOTSPOT) console.log('\nNote: hotspot status is a judgement about history, not a fact in this diff. Pass --hotspot if it is one.');
process.exit(0);
