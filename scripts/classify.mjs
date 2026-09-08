#!/usr/bin/env node
/**
 * classify - sort a request into its track BEFORE any agent reads it, and say when it cannot.
 *
 * WHY THIS EXISTS
 *   `/request` R1 is a table of nine rows applied by a model re-reading it against a sentence
 *   of plain English. Measured on this repository, the "ground" stage - reading, understanding
 *   and deciding, before a line is written - was 13 of 25 minutes on a real run. That is the
 *   largest single stage, and classification sits at the front of it.
 *
 * WHAT IT WILL AND WILL NOT DECIDE - the honest half
 *   Roughly the clear cases, deterministically. The rest it REFUSES, by design.
 *
 *   The one distinction it structurally cannot make is NEW vs NEW-APP, because that turns on
 *   whether a codebase exists to receive the work - a fact about the repository, not about the
 *   sentence. It is answered by looking, not by reading, so this script looks: an application
 *   with no source tree is NEW-APP.
 *
 *   And it cannot tell "improve X" apart when X may be broken. Neither can a person, which is
 *   why R1 already says to ask exactly one question. UNSURE is a real answer here, and a
 *   confident wrong route costs an entire track - far more than the seconds this saves.
 *
 * IT DOES NOT REPLACE R1, IT FRONT-RUNS IT
 *   R1 stays the authority on what the classes MEAN. This decides the obvious ones so the
 *   expensive reader never processes the table at all, and hands over the moment it is unsure.
 *   A router that answers everything is a router that answers some of them wrongly.
 *
 * EXIT CODES
 *   0 classified   2 bad usage   3 UNSURE - deliberately not classified; ask the one question.
 *
 * USAGE
 *   node scripts/classify.mjs "<the request, in the requester's words>" [--json] [--cwd <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const JSON_OUT = argv.includes('--json');
const ROOT = path.resolve(process.cwd(), flag('--cwd', '.'));
const text = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--cwd').join(' ').trim();

if (!text) {
  console.error('classify: give it the request. node scripts/classify.mjs "<what the requester said>"');
  process.exit(2);
}

const t = ` ${text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ')} `;
const any = (...words) => words.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `));
const phrase = (...ps) => ps.some((p) => t.includes(p));

/* Signals, each one a fact about the sentence. Kept separate from the decision below so the
 * output can show its working: a classification nobody can audit is a guess with a label. */
const sig = {
  broken: any('broken', 'error', 'errors', 'failing', 'fails', 'crash', 'crashes', 'wrong', 'incorrect', 'bug', 'defect', 'not working', 'stopped')
       || phrase('does not work', "doesn't work", 'is not working', 'no longer', 'since last', 'used to work'),
  change: any('should', 'instead', 'rather', 'prefer', 'also', 'add', 'change', 'rename', 'move', 'reorder', 'adjust')
       || phrase('works but', 'would be better', 'can we make'),
  brandNew: phrase('does not exist', "doesn't exist", 'there is no', 'we need a new', 'build a new', 'create a new', 'from scratch'),
  wholeApp: any('app', 'application', 'product', 'platform', 'system', 'portal')
         && phrase('new app', 'new application', 'new product', 'new platform', 'new system', 'build an app', 'build a new'),
  refactor: phrase('same behaviour', 'same behavior', 'without changing behaviour', 'without changing behavior',
                   'clean up', 'tidy up', 'restructure', 'reorganise', 'reorganize', 'refactor', 'split up', 'extract'),
  list: /(^|\s)(\d+[.)]|\*|-)\s+\S+[\s\S]*?(\r?\n)\s*(\d+[.)]|\*|-)\s+\S+/.test(text)
     || phrase('a few things', 'several things', 'these issues', 'the following', 'couple of issues', 'list of'),
  openQuestion: phrase('what should happen', 'should we', 'which is better', 'thinking about', 'weighing', 'pros and cons', 'options are', 'not sure whether'),
  processFailure: phrase('the gate', 'the process', 'the workflow', 'the runbook', 'should have caught', 'never caught', 'slipped through', 'why did the check'),
  vague: phrase('improve', 'better', 'not great', 'clean it up', 'sort out', 'fix up') && !any('broken', 'error', 'fails', 'crash'),
};

/* Facts about the repository, not the sentence. NEW vs NEW-APP turns on this and nothing else. */
const SRC = ['src', 'app', 'starter/src', 'components', 'lib'];
const hasCodebase = SRC.some((d) => fs.existsSync(path.join(ROOT, d)));

function decide() {
  if (sig.processFailure) return ['FRAMEWORK', 'workflows/framework-update.md', 'the process itself is named as having failed', false];
  if (sig.list) return ['TRIAGE', 'workflows/triage.md', 'several items in one request - they are deduped, ordered and scored first', false];
  if (sig.openQuestion && !sig.broken) return ['BRAINSTORM', 'workflows/brainstorm.md', 'a situation to weigh, with no single next action', false];
  if (sig.refactor && !sig.broken) return ['REFACTOR', 'workflows/refactor.md', 'structure changes, behaviour does not', false];

  // The genuinely ambiguous one, and R1 already prescribes the answer: ask ONE question.
  if (sig.vague && !sig.change) {
    return ['UNSURE', null,
      '"improve"-shaped, and X may be broken or may merely be improvable - these route to '
      + 'different tracks (BUG roots-causes first; CHANGE does not). Ask exactly one question.', true];
  }
  if (sig.broken && sig.change) {
    return ['UNSURE', null,
      'the request reads as both broken AND as a preference. A BUG misfiled as a CHANGE skips '
      + 'root cause, which is the whole value of Track C. Ask exactly one question.', true];
  }

  if (sig.broken) return ['BUG', 'workflows/bug.md', 'something is reported as not working, so root cause comes first', false];
  if (sig.brandNew || sig.wholeApp) {
    return hasCodebase
      ? ['NEW', 'workflows/feature.md', 'a capability that does not exist yet, in a codebase that does', false]
      : ['NEW-APP', 'docs/02-PROJECT-INITIALIZATION.md then workflows/feature.md',
         'no source tree here to receive the work - this is a product, not a feature', false];
  }
  if (sig.change) return ['CHANGE', 'workflows/enhance.md', 'it works and should behave or look different', false];

  return ['UNSURE', null, 'no signal was strong enough to route on. R1 decides this one by reading.', true];
}

const [cls, route, why, unsure] = decide();
const fired = Object.entries(sig).filter(([, v]) => v).map(([k]) => k);

const out = {
  classification: cls,
  route,
  why,
  signals: fired,
  hasCodebase,
  runLogType: cls === 'UNSURE' ? null : cls,
  request: text,
};

if (JSON_OUT) { console.log(JSON.stringify(out, null, 2)); process.exit(unsure ? 3 : 0); }

if (unsure) {
  console.log(`UNSURE - not classified.\n  ${why}`);
  console.log(`  Signals: ${fired.length ? fired.join(', ') : 'none'}`);
  console.log('\nThis is a real answer, not a failure. A confident wrong route costs an entire');
  console.log('track; the seconds saved by guessing are not worth one. Hand it to /request R1.');
  process.exit(3);
}

console.log(`${cls}  ->  ${route}`);
console.log(`  ${why}`);
console.log(`  Signals: ${fired.length ? fired.join(', ') : 'none'}`);
console.log(`\n  node scripts/run-log.mjs start --type ${cls} --action ${JSON.stringify(text.slice(0, 120))}`);
console.log('\nR1 in workflows/request.md remains the authority on what these classes MEAN.');
console.log('This only decides the obvious ones, so the table need not be read for them.');
process.exit(0);
