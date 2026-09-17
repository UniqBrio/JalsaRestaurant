#!/usr/bin/env node
/**
 * capture-candidate - park a lesson an app learned, WITHOUT touching the framework.
 *
 * WHAT THIS IS FOR
 *   The expensive part of the promotion loop was never the edit. It was that a lesson found on
 *   a Tuesday, in an app, in a session that then ended, was gone by Thursday - so the same
 *   defect class was paid for twice, at full price, months apart. This makes the CAPTURE
 *   cheap and immediate, so nothing is lost between sessions.
 *
 * WHAT THIS DELIBERATELY CANNOT DO - and this is the whole design
 *   **It cannot promote.** There is no code path here that edits a rule, a checklist, a
 *   canonical pattern, a gate or a workflow. It appends one row to one register and stops.
 *
 *   That is not timidity, it is the point. `workflows/promote.md` Filter 3 is the rule of
 *   three: a lesson becomes a framework rule on the SECOND sighting from a DIFFERENT app.
 *   Promoting on first sighting is how a framework becomes a museum of one app's accidents,
 *   and the screen checklist is capped at 20 items and declared FULL - every rule admitted
 *   without evidence of generality spends a budget that a later, better rule then cannot.
 *
 *   So automating capture is free. Automating promotion would generate rules with no rung, no
 *   case, and no version bump - exactly the "rule that nothing executes" this framework exists
 *   to refuse - only now at machine speed. The judgement step is the load-bearing one; it stays
 *   human, and `/promote` then `/framework-update` is where it happens.
 *
 * THE FILTERS IT DOES AND DOES NOT ENFORCE, stated rather than implied
 *   Filter 1 (path test - is this framework-origin behaviour at all?) is NOT mechanised. It
 *     needs judgement about where a change came from, and a wrong automatic answer here is
 *     worse than no answer, because it looks like a verdict.
 *   Filter 2 (domain-word test) IS mechanised, as `promote.md` says it can be: the rule is
 *     grepped against the source app's PRODUCT_LEXICON.md. A lexicon word in the rule means it
 *     is app-specific by definition. A heuristic, not a proof - hence one narrow escape token.
 *   Filter 3 (the rule of three) is REPORTED, never acted on. A second sighting from a
 *     different app flips the row to ELIGIBLE and prints what to run. It does not promote.
 *
 * USAGE
 *   node scripts/capture-candidate.mjs --rule "<domain-free rule>" --app <name> [--apply]
 *   node scripts/capture-candidate.mjs --sighting-of CAND-003 --app <other-app> [--apply]
 *   node scripts/capture-candidate.mjs --list
 *
 *   --lexicon <path>        override the auto-located PRODUCT_LEXICON.md
 *   --allow-lexicon-word    Filter 2 is a heuristic; this excuses IT and nothing else
 *                           (CLAUDE.md rule 2 - one token, one guard, auditable in history)
 *   --apply                 write. Without it this is a dry run that prints the row.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// The register lives in the FRAMEWORK, not in whichever app is calling. Resolved from this
// file's own location so a linked app invoking `node <fw>/scripts/capture-candidate.mjs`
// writes to the one register, not to a copy beside itself.
const FRAMEWORK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

// `--register` exists so `capture-candidate.test.sh` can drive the REAL code against a scratch
// copy. The alternative is a suite that mutates the live register to prove it mutates registers
// correctly, and then has to put it back - on every run, including the interrupted ones.
const REGISTER = path.resolve(arg('--register', path.join(FRAMEWORK, 'docs/registers/CANDIDATES.md')));

const OK = 0, REFUSED = 2, BLOCKED = 3;

function die(code, ...lines) { for (const l of lines) console.error(l); process.exit(code); }

if (!fs.existsSync(REGISTER)) {
  // Rule 3: a missing input is BLOCKED and audible, never a silent success.
  die(BLOCKED, `BLOCKED [CAPTURE]: no register at ${REGISTER}.`,
    '  Nothing was captured. This is not a pass - the lesson is still unrecorded.');
}

const register = fs.readFileSync(REGISTER, 'utf8');

/* Every CAND row, parsed from the table. The parse is asserted below: a register that yields
 * no rows means the format moved, and guessing the next id from a failed parse would overwrite
 * CAND-001. */
const rows = [...register.matchAll(/^\|\s*(CAND-(\d+))\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/gm)]
  .map((m) => ({ id: m[1], n: Number(m[2]), rule: m[3].trim(), source: m[4].trim(), sightings: m[5].trim(), status: m[6].trim() }));

if (!rows.length) {
  die(BLOCKED, 'BLOCKED [CAPTURE]: parsed zero candidate rows from the register.',
    '  A scan that matched nothing is indistinguishable from an empty register, and the next',
    '  id derived from it would collide with an existing row. Check the table format.');
}

if (has('--list')) {
  for (const r of rows) console.log(`${r.id}  ${r.sightings.padEnd(4)}  ${r.status.replace(/\*\*/g, '')}\n      ${r.rule.slice(0, 100)}`);
  console.log(`\n${rows.length} row(s). Nothing was changed.`);
  process.exit(OK);
}

const APP = arg('--app');
/* Fixed month names, not toLocaleDateString: newer ICU renders September as "Sept", and the
 * register's existing rows are three-letter ("30-Aug-2026"). A date format that varies with the
 * runtime's ICU version is a register that disagrees with itself over time. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const now = new Date();
const today = `${String(now.getDate()).padStart(2, '0')}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`;

/* ---- Second sighting: REPORT the rule of three. Never act on it. --------------------------- */
const sightingOf = arg('--sighting-of');
if (sightingOf) {
  if (!APP) die(REFUSED, 'REFUSED: --sighting-of needs --app (which app sighted it this time).');
  const row = rows.find((r) => r.id.toLowerCase() === sightingOf.toLowerCase());
  if (!row) die(REFUSED, `REFUSED: no ${sightingOf} in the register. Run --list.`);

  const sameApp = row.source.toLowerCase().includes(APP.toLowerCase());
  if (sameApp) {
    // promote.md Filter 3: a same-app repeat is a Track C matter, not a promotion signal.
    console.log(`${row.id} was already sighted in ${APP}. Still n=1 for promotion purposes.`);
    console.log('A same-app repeat means the app\'s own fix did not hold - that is a BUG (Track C),');
    console.log('not evidence of generality. Nothing was changed.');
    process.exit(OK);
  }

  const updated = register.replace(
    new RegExp(`^(\\|\\s*${row.id}\\s*\\|[^|]*\\|)([^|]*)\\|([^|]*)\\|([^|]*)\\|`, 'm'),
    (_m, head, source, _s, _st) => `${head}${source.trimEnd()} · ${APP} · ${today} | n=2 | **ELIGIBLE (n=2)** - run \`/promote\` then \`/framework-update\` |`,
  );
  if (updated === register) die(BLOCKED, `BLOCKED: could not rewrite ${row.id}'s row; the register was not touched.`);

  if (!has('--apply')) {
    console.log(`DRY RUN. ${row.id} would become ELIGIBLE (n=2) - second sighting, from ${APP}.`);
    console.log('Re-run with --apply to record it.');
    process.exit(OK);
  }
  fs.writeFileSync(REGISTER, updated);
  console.log(`${row.id} -> ELIGIBLE (n=2). Second sighting from ${APP} recorded.`);
  console.log('');
  console.log('NOT PROMOTED. This tool does not change the framework, by design.');
  console.log('The rule of three is met; the human gate is not. Run:  /promote   then  /framework-update');
  process.exit(OK);
}

/* ---- First sighting: park it at n=1. ------------------------------------------------------- */
const RULE = arg('--rule');
if (!RULE || !APP) {
  die(REFUSED, 'REFUSED: need --rule "<domain-free rule>" and --app <name>.',
    '  node scripts/capture-candidate.mjs --rule "A derived value must recompute when any input changes" --app my-app',
    '  node scripts/capture-candidate.mjs --sighting-of CAND-003 --app other-app',
    '  node scripts/capture-candidate.mjs --list');
}

/* Filter 2, the mechanical assist promote.md describes. A lexicon word in the rule means the
 * rule names a business concept, which makes it app-specific BY DEFINITION - not by degree. */
const lexPath = arg('--lexicon', path.join(FRAMEWORK, '..', APP, 'docs', 'PRODUCT_LEXICON.md'));
if (fs.existsSync(lexPath) && !has('--allow-lexicon-word')) {
  const words = [...fs.readFileSync(lexPath, 'utf8').matchAll(/^\s*[-*|]\s*\*{0,2}([A-Za-z][A-Za-z -]{2,30})\*{0,2}/gm)]
    .map((m) => m[1].trim().toLowerCase())
    .filter((w) => w.length > 3 && !['the', 'and', 'name', 'term', 'meaning', 'definition'].includes(w));
  const hit = words.find((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(RULE));
  if (hit) {
    die(REFUSED,
      `REFUSED [Filter 2]: the rule contains the lexicon word "${hit}".`,
      `  Read from: ${lexPath}`,
      '  A rule that names a business concept is app-specific by definition, not by degree.',
      '  Restate it without the domain noun - that restatement IS the filter, and it is usually',
      '  where a candidate either becomes general or reveals that it never was.',
      '  If this is a false positive, --allow-lexicon-word excuses THIS check and nothing else.');
  }
}

const nextId = `CAND-${String(Math.max(...rows.map((r) => r.n)) + 1).padStart(3, '0')}`;
const row = `| ${nextId} | "${RULE.replace(/"/g, "'")}" | ${APP} · ${today} | n=1 | **PARKED (n=1)** |`;

/* Newest first, append-only: inserted directly under the header separator, so no existing row
 * moves and nothing is renumbered (CLAUDE.md rule 8). */
const anchor = /^\|---\|---\|---\|---\|---\|$/m;
if (!anchor.test(register)) die(BLOCKED, 'BLOCKED: could not find the table header in the register; nothing was written.');
const out = register.replace(anchor, (m) => `${m}\n${row}`);

if (!has('--apply')) {
  console.log('DRY RUN - nothing written. The row would be:\n');
  console.log(row);
  console.log('\nRe-run with --apply to park it.');
  process.exit(OK);
}

fs.writeFileSync(REGISTER, out);
console.log(`Parked ${nextId} at n=1.\n`);
console.log(row);
console.log('');
console.log('The framework is UNCHANGED, and that is correct: one sighting is not evidence of');
console.log('generality. If a DIFFERENT app hits this, record it with:');
console.log(`  node scripts/capture-candidate.mjs --sighting-of ${nextId} --app <that-app> --apply`);
process.exit(OK);
