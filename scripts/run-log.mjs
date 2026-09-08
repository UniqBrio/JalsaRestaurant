#!/usr/bin/env node
/**
 * run-log - the audit log of runs: what was asked, which kind of request, and how long it took.
 *
 * WHY A SCRIPT AND NOT A MARKDOWN TEMPLATE
 *   A start time written at the END of a run is a recalled time, and a duration derived from
 *   two recalled times is an estimate presented as a record. That is exactly the failure this
 *   framework paid for in RC-008: "run reports carry stage timings" was a rule for three
 *   versions and produced not one measured number, because the only party asked to honour it
 *   was a narrator. So the clock is read by a machine, twice, and the log is APPENDED by this
 *   script rather than typed into by hand.
 *
 * THE HONESTY RULE THIS ENFORCES
 *   `end` without a recorded `start` does NOT invent a start time. It exits 3 (BLOCKED) and
 *   says so. An audit log whose durations are sometimes measured and sometimes guessed is
 *   worse than no audit log, because nothing on the row says which kind each one is.
 *   Back-filling is possible but must be EXPLICIT: --started <ISO>, which marks the row.
 *
 * THE GATE TIME COMES FROM THE GATE
 *   `end` reads the newest `Time:` line out of TEST_SUMMARY.md - the number gate-runner.mjs
 *   measured - instead of asking anyone what the gate cost. That is the one sub-duration the
 *   framework can state mechanically, and it answers the first question a long run raises:
 *   was it the machine or the agent? (It was the agent: the whole mechanical stack is ~87s.)
 *
 * THE STAGE BREAKDOWN - why a total alone is not actionable
 *   A run that took an hour tells you to do something; it does not tell you WHAT. The five
 *   stage names come from FW-SPEED-003 (ground / plan / build / verify / gate) and were prose
 *   for three versions. `stage <name>` closes the previous stage and opens the next, both from
 *   the clock, so the row carries "ground 4m - plan 2m - build 14m - verify 5m" beside the
 *   total. Only the stages actually marked appear: an unmarked stage is absent, never zero.
 *
 * USAGE
 *   node scripts/run-log.mjs start --type <TYPE> --action "<what was asked>" [--scale <s>] [--id <id>]
 *   node scripts/run-log.mjs stage <ground|plan|build|verify|gate>
 *   node scripts/run-log.mjs end   [--verdict PASS|FAIL|BLOCKED] [--scale <s>] [--note "<text>"]
 *   node scripts/run-log.mjs status
 *   node scripts/run-log.mjs end --started <ISO>   # explicit back-fill, marked on the row
 *
 * TYPES - the SAME vocabulary as /request R1. A second vocabulary for the same concern is a
 * defect, not a convenience: two names for one thing means two answers to "how many bug runs".
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const FRAMEWORK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const has = (n) => argv.includes(n);

const ACTIVE = path.resolve(ROOT, arg('--active', '.run-log.json'));
const LOG = path.resolve(ROOT, arg('--log', 'docs/registers/RUN_LOG.md'));
const SUMMARY = path.resolve(ROOT, arg('--summary', 'TEST_SUMMARY.md'));

/* The request classifications from workflows/request.md R1, plus the routed-out tracks. A run
 * that produces no request file still consumes time, and a log that cannot name it will have
 * that time attributed to nothing. */
const TYPES = {
  'NEW-APP': 'a whole new application',
  NEW: 'a new feature in an app that exists',
  CHANGE: 'a functionality correction - works, should behave or look different',
  BUG: 'a defect - erroring, wrong output, wrong data',
  REFACTOR: 'same behaviour, better structure',
  TRIAGE: 'a list of items, ordered and scored',
  BRAINSTORM: 'thinking it through - no code',
  FRAMEWORK: 'the process itself failed and was repaired',
};
const SCALES = ['micro', 'scoped', 'full-scale', 'n/a'];
/* The five stage names FW-SPEED-003 has named since v1.13.0. Closed, and in run order: an
 * ad-hoc sixth name would make two runs incomparable, which is the one thing this column is
 * for. `gate` is here for completeness - its cost also arrives measured, from the runner. */
const STAGES = ['ground', 'plan', 'build', 'verify', 'gate'];
const VERDICTS = ['PASS', 'FAIL', 'BLOCKED'];

const die = (code, msg) => { console.error(msg); process.exit(code); };
const iso = (d) => d.toISOString();

/** "2026-09-08 09:12" in local time - a log is read by a person in their own timezone. */
function stamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Durations a person compares without arithmetic: "6m", "1h 04m", "38s". */
function human(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

/** A pipe inside a cell silently splits the row and shifts every column after it. */
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();

/* ---------------------------------------------------------------- start ---- */
function start() {
  const type = String(arg('--type', '')).toUpperCase();
  const action = arg('--action', '');
  const scale = arg('--scale', 'n/a');
  if (!TYPES[type]) {
    die(2, `run-log: --type must be one of ${Object.keys(TYPES).join(' | ')}\n`
      + Object.entries(TYPES).map(([k, v]) => `  ${k.padEnd(10)} ${v}`).join('\n'));
  }
  if (!action.trim()) die(2, 'run-log: --action "<what the requester asked, in their words>" is required.');
  if (!SCALES.includes(scale)) die(2, `run-log: --scale must be one of ${SCALES.join(' | ')}`);

  if (fs.existsSync(ACTIVE)) {
    const prior = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
    die(2, `run-log: a run is already open since ${prior.startedAt} - "${prior.action}".\n`
      + '  Close it first: node scripts/run-log.mjs end --verdict <PASS|FAIL|BLOCKED>\n'
      + '  Overlapping runs would make both durations meaningless.');
  }

  const now = new Date();
  const rec = { id: arg('--id', ''), type, action, scale, startedAt: iso(now), stages: [] };
  fs.writeFileSync(ACTIVE, JSON.stringify(rec, null, 2) + '\n', 'utf8');
  console.log(`run-log: started ${type} at ${stamp(now)} - ${action}`);
}

/* ---------------------------------------------------------------- stage ---- */

/**
 * Mark the boundary between one stage and the next. Called at the START of each stage, so the
 * previous one ends where this begins and no wall-clock falls between two stages unattributed.
 * The final stage is closed by `end`.
 */
function stage() {
  const name = String(argv[1] || '').toLowerCase();
  if (!STAGES.includes(name)) {
    die(2, `run-log: stage must be one of ${STAGES.join(' | ')} - got "${argv[1] ?? ''}".\n`
      + '  The vocabulary is closed on purpose: an ad-hoc sixth name makes two runs\n'
      + '  incomparable, and comparing runs is the only thing this column is for.');
  }
  if (!fs.existsSync(ACTIVE)) {
    die(3, 'BLOCKED [run-log] stage marked with no open run.\n'
      + '  A stage boundary is only meaningful inside a run: start one first.\n'
      + '  node scripts/run-log.mjs start --type <T> --action "<...>"');
  }
  const rec = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
  rec.stages = rec.stages || [];
  const last = rec.stages[rec.stages.length - 1];
  if (last && last.name === name) {
    // Re-marking the stage you are already in would silently split it into two rows that sum
    // to the same thing - noise, not information. Say so rather than recording it.
    console.log(`run-log: already in "${name}" since ${stamp(new Date(last.at))} - not re-marked.`);
    return;
  }
  const now = new Date();
  rec.stages.push({ name, at: iso(now) });
  fs.writeFileSync(ACTIVE, JSON.stringify(rec, null, 2) + '\n', 'utf8');
  const prior = last ? ` (${name === last.name ? '' : last.name} took ${human(now - new Date(last.at))})` : '';
  console.log(`run-log: stage "${name}" at ${stamp(now)}${prior}`);
}

/**
 * "ground 4m - plan 2m - build 14m" from the marks. Each stage runs until the next mark, and
 * the last until the run ends. An unmarked stage does not appear at all: absent is not zero,
 * and a zero would claim the stage ran instantly rather than that nobody measured it.
 */
function renderStages(marks, endedAt) {
  if (!marks || !marks.length) return '-';
  return marks.map((m, i) => {
    const until = i + 1 < marks.length ? new Date(marks[i + 1].at) : endedAt;
    return `${m.name} ${human(until - new Date(m.at))}`;
  }).join(' · ');
}

/* ------------------------------------------------------------------ end ---- */

/** The newest "Time: 6.1s total - slowest ..." from the append-only gate ledger. */
function gateTime() {
  if (!fs.existsSync(SUMMARY)) return '-';
  const m = fs.readFileSync(SUMMARY, 'utf8').match(/^Time:\s*(.+?)\s+total/m);
  return m ? m[1] : '-';
}

function end() {
  let rec = null;
  const backfill = arg('--started', '');

  if (fs.existsSync(ACTIVE)) {
    rec = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
  } else if (backfill) {
    // Explicit, and the row says so. An unmarked estimate among measurements is the failure.
    const d = new Date(backfill);
    if (Number.isNaN(d.getTime())) die(2, `run-log: --started "${backfill}" is not a parseable date.`);
    rec = { id: '', type: String(arg('--type', 'NEW')).toUpperCase(), action: arg('--action', ''),
            scale: arg('--scale', 'n/a'), startedAt: iso(d), backfilled: true };
    if (!TYPES[rec.type]) die(2, `run-log: --type must be one of ${Object.keys(TYPES).join(' | ')}`);
    if (!rec.action.trim()) die(2, 'run-log: --action is required when back-filling.');
  } else {
    die(3, 'BLOCKED [run-log] end called with no open run, and no explicit --started.\n'
      + '  This does NOT invent a start time. A log whose durations are sometimes measured and\n'
      + '  sometimes guessed is worse than no log: nothing on the row says which kind each is.\n'
      + '  Start runs with: node scripts/run-log.mjs start --type <T> --action "<...>"\n'
      + '  Back-fill explicitly with: --started <ISO> --type <T> --action "<...>"');
  }

  const verdict = String(arg('--verdict', '-')).toUpperCase();
  if (verdict !== '-' && !VERDICTS.includes(verdict)) {
    die(2, `run-log: --verdict must be one of ${VERDICTS.join(' | ')} - there is no fourth value.`);
  }
  const scale = arg('--scale', rec.scale || 'n/a');
  if (!SCALES.includes(scale)) die(2, `run-log: --scale must be one of ${SCALES.join(' | ')}`);

  const startedAt = new Date(rec.startedAt);
  const endedAt = new Date();
  const total = human(endedAt - startedAt);

  const note = arg('--note', '');
  const marks = [rec.backfilled ? 'back-filled start' : '', note].filter(Boolean).join('; ');

  const row = '| ' + [
    cell(rec.id || nextId()),
    cell(rec.action),
    cell(rec.type),
    cell(scale),
    cell(stamp(startedAt)),
    cell(stamp(endedAt)),
    cell(total),
    cell(renderStages(rec.stages, endedAt)),
    cell(gateTime()),
    cell(verdict),
    cell(marks || '-'),
  ].join(' | ') + ' |';

  appendRow(row);
  if (fs.existsSync(ACTIVE)) fs.unlinkSync(ACTIVE);
  console.log(`run-log: ${rec.type} took ${total} (gate ${gateTime()}), verdict ${verdict}`);
  console.log(`  appended to ${path.relative(ROOT, LOG)}`);
}

/* Newest first, and never renumber: the next id is one above the highest ever used. */
function nextId() {
  if (!fs.existsSync(LOG)) return 'R-001';
  const ids = [...fs.readFileSync(LOG, 'utf8').matchAll(/^\|\s*R-(\d+)\s*\|/gm)].map((m) => Number(m[1]));
  return 'R-' + String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, '0');
}

/**
 * Insert directly under the DATA table's separator - newest first, prior rows untouched.
 * Append-only: this function never rewrites a line it did not add.
 *
 * ANCHORED ON THE HEADER'S OWN COLUMNS, NOT ON "THE FIRST TABLE"
 *   The register explains itself before it lists anything, so the first markdown table in the
 *   file is the column glossary. Matching the first separator put rows into that table, where
 *   they rendered as documentation - observed on the very first real use. A register that
 *   silently files entries in the wrong place is worse than one that refuses: the write
 *   reports success and the record is not where anyone will read it.
 */
const HEADER_RE = /^\|\s*ID\s*\|\s*Action\s*\|\s*Type\s*\|.*\|[ \t]*$/m;

function appendRow(row) {
  if (!fs.existsSync(LOG)) die(2, `run-log: ${path.relative(ROOT, LOG)} is missing. It is a governed register; restore it rather than letting this script invent one.`);
  const text = fs.readFileSync(LOG, 'utf8');
  const head = text.match(HEADER_RE);
  if (!head) {
    die(2, `run-log: no data-table header (| ID | Action | Type | ...) in ${path.relative(ROOT, LOG)}`
      + ' - refusing to guess where a row belongs.');
  }
  const afterHead = text.indexOf(head[0]) + head[0].length;
  const rest = text.slice(afterHead);
  // [ \t]* and NOT \s*: with the m flag \s also matches the newline, so a greedy tail swallows
  // the line ending, the insert then adds its own, and the row arrives after a BLANK LINE -
  // which in markdown ends the table. The rows render as loose text while the write reports
  // success, so the failure is invisible in the tool and obvious only to a reader.
  const sep = rest.match(/^\|[-\s|:]+\|[ \t]*$/m);
  if (!sep || rest.indexOf(sep[0]) > 2) {
    die(2, `run-log: the data-table header in ${path.relative(ROOT, LOG)} is not followed by a separator row`
      + ' - refusing to write into a malformed table.');
  }
  const at = afterHead + rest.indexOf(sep[0]) + sep[0].length;
  fs.writeFileSync(LOG, text.slice(0, at) + '\n' + row + text.slice(at), 'utf8');
}

/* --------------------------------------------------------------- status ---- */
function status() {
  if (!fs.existsSync(ACTIVE)) { console.log('run-log: no run open.'); return; }
  const rec = JSON.parse(fs.readFileSync(ACTIVE, 'utf8'));
  const elapsed = human(Date.now() - new Date(rec.startedAt).getTime());
  console.log(`run-log: ${rec.type} open ${elapsed} - "${rec.action}" (started ${stamp(new Date(rec.startedAt))})`);
  const marks = rec.stages || [];
  if (marks.length) {
    console.log(`  stages so far: ${renderStages(marks, new Date())}`);
  } else {
    console.log('  no stages marked - the total will have no breakdown. node scripts/run-log.mjs stage ground');
  }
}

switch (cmd) {
  case 'start': start(); break;
  case 'stage': stage(); break;
  case 'end': end(); break;
  case 'status': status(); break;
  default:
    console.error('usage: run-log.mjs start --type <TYPE> --action "<...>" [--scale <s>]');
    console.error(`       run-log.mjs stage <${STAGES.join('|')}>`);
    console.error('       run-log.mjs end [--verdict PASS|FAIL|BLOCKED] [--note "<...>"]');
    console.error('       run-log.mjs status');
    console.error('\nTYPE: ' + Object.keys(TYPES).join(' | '));
    process.exit(2);
}
