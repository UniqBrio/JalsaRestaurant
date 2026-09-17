#!/usr/bin/env node
/**
 * check-presentation-labels - a canonical value must not be rendered as user-facing text (CP-32).
 *
 * THE DEFECT THIS FINDS
 *   A union of machine identifiers - 'active' | 'paused' | 'archived' - reaching the screen
 *   unchanged, so the user reads `active` where the product says "Active" everywhere else.
 *
 *   It needs a gate rather than care because the WRONG PATH IS SHORTER. `{item.status}` renders,
 *   passes every visibility assertion, satisfies every accessibility check, and is fewer
 *   characters than looking a label up. Nobody chooses it; it is what happens when nobody
 *   chooses. A rule asking people to type more, forever, to avoid a defect they cannot see is a
 *   rule that loses.
 *
 * WHAT IS AND IS NOT A CANONICAL VALUE (the decidable part)
 *   A union member is treated as canonical when it is MACHINE-CASED: all-lowercase, snake_case,
 *   kebab-case or SCREAMING_SNAKE. 'active' is canonical; 'Monday' and 'Awaiting approval' are
 *   already presentation and are left alone. That line is the same one DR-1 draws - a string
 *   that is already cased for a reader was written for a reader - and it is why this audit needs
 *   no dictionary and no list of known enums.
 *
 * WHAT IT CANNOT SEE - and this is a FLOOR, not a proof
 *   - A value reaching the screen through a name nothing in the tree ever types. A row typed
 *     `Record<string, unknown>` all the way to the JSX is invisible here.
 *   - A label that is declared but BAD. `active: 'Actv'` passes this audit and fails review.
 *   - Anything computed: `{cond ? a : b}`, a template literal, a value through a helper.
 *   The FIRST version of this audit resolved bindings within one file only and therefore missed
 *   the ordinary case - a type in `types.ts`, rendered in a screen that imports it - which is
 *   most real defects. Property names typed by a canonical union are now collected across the
 *   whole tree; a bare identifier stays file-local, because a global set of names like `s` would
 *   flag the entire codebase. CP-32 and the copy pass carry what is left, and say so.
 *
 * ZERO UNIONS IS REPORTED, NEVER SILENTLY GREEN
 *   An application with no string-literal unions has nothing for this audit to find, which looks
 *   exactly like an application that got it right. The union count is printed on every run for
 *   that reason. `parsedSomething` covers the harder failure - reading no files at all.
 *
 * ESCAPE
 *   `PRESENTATION-NA: <reason>` on the offending line or the line above it. One token, this
 *   audit only.
 *
 * USAGE
 *   node scripts/audits/check-presentation-labels.mjs [--dir <src>] [--report|--write-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateRatchet, writeBaseline, walk } from '../lib/ratchet.mjs';
import { appPath } from '../lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = process.cwd();
const DIR = path.resolve(ROOT, arg('--dir', appPath(ROOT, 'src')));
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/presentation-labels-baseline.txt')));
const CMD = 'node scripts/audits/check-presentation-labels.mjs --write-baseline';

/* A machine identifier: what a database, an API or a state machine calls a thing. */
const MACHINE_CASED = (s) =>
  /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/.test(s) || /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(s);

/* `type Name = 'a' | 'b';` - the RHS must be literals and pipes ONLY, or it is not a vocabulary. */
const UNION_DECL = /(?:^|\n)\s*(?:export\s+)?type\s+(\w+)\s*=\s*([^;]+);/g;

const files = walk(DIR, { exts: ['.ts', '.tsx'] }).filter((f) => !/\.(test|spec)\./.test(f));

/**
 * Pass 1: the canonical vocabulary, and the PROPERTY NAMES typed by it - both collected across
 * the WHOLE tree, because the ordinary shape is a type in one file and the screen that renders
 * it in another. A per-file rule missed exactly that, which is most real cases.
 *
 * A qualified tail (`{item.status}`) is safe to resolve globally: the property name is written
 * at the use site. A BARE identifier (`{s}`) is not, so those stay file-local below - a global
 * set of short names would flag every unrelated `s` in the codebase.
 */
const unions = new Map();
const canonicalProps = new Set();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const [, name, rhs] of src.matchAll(UNION_DECL)) {
    const members = [...rhs.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    if (members.length < 2) continue;                       // an alias, not a vocabulary
    const bare = rhs.replace(/'[^']*'/g, '').replace(/[|\s]/g, '');
    if (bare !== '') continue;                              // literals and pipes only
    const canonical = members.filter(MACHINE_CASED);
    if (canonical.length === members.length) unions.set(name, canonical);
  }
}
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const [, n, t] of src.matchAll(/(?:readonly\s+)?(\w+)\s*\??\s*:\s*(\w+)\s*;/g)) {
    if (unions.has(t)) canonicalProps.add(n);
  }
}
const literals = new Set([...unions.values()].flat());

/** Pass 2: per file, which NAMES are bound to a canonical union - then what reaches the screen. */
const signatures = [];
let regionsSeen = 0;
for (const file of files.filter((f) => f.endsWith('.tsx'))) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  const excused = (line) =>
    (lines[line - 1] ?? '').includes('PRESENTATION-NA:')
    || (lines[line - 2] ?? '').includes('PRESENTATION-NA:');

  const names = new Set();
  const add = (name, type) => { if (unions.has(type)) names.add(name); };
  // A property declared by a canonical union: `readonly status: ItemStatus;`
  for (const [, n, t] of src.matchAll(/(?:readonly\s+)?(\w+)\s*\??\s*:\s*(\w+)\s*;/g)) add(n, t);
  // State, a typed const, and a typed parameter.
  for (const [, n, t] of src.matchAll(/const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useState<\s*(\w+)\s*>/g)) add(n, t);
  for (const [, n, t] of src.matchAll(/const\s+(\w+)\s*:\s*(\w+)\s*=/g)) add(n, t);
  for (const [, n, t] of src.matchAll(/\(\s*(\w+)\s*:\s*(\w+)\s*\)/g)) add(n, t);
  // `const STATUSES: readonly ItemStatus[]` then `STATUSES.map((s) => ...)` binds `s`.
  for (const [, arrName, t] of src.matchAll(/const\s+(\w+)\s*:\s*readonly\s+(\w+)\[\]/g)) {
    if (!unions.has(t)) continue;
    const mapped = new RegExp('\\b' + arrName + '\\.map\\(\\s*\\(?\\s*(\\w+)', 'g');
    for (const [, v] of src.matchAll(mapped)) names.add(v);
  }

  /* Children regions only: the text BETWEEN a `>` and the next `<`. An attribute value is not a
     region, which is what keeps a canonical data-testid - correct, and required to stay
     canonical - out of the results. */
  for (const m of src.matchAll(/>([^<>]*)</g)) {
    const region = m[1];
    if (region.trim() === '') continue;
    regionsSeen++;
    const at = lineOf(m.index + 1);
    if (excused(at)) continue;
    if (literals.has(region.trim())) {
      signatures.push(rel + '|' + at + '|literal:' + region.trim());
      continue;
    }
    for (const [, expr] of region.matchAll(/\{\s*([\w$]+(?:\??\.[\w$]+)*)\s*\}/g)) {
      const tail = expr.split('.').pop();
      const qualified = expr.includes('.');
      const hit = qualified ? canonicalProps.has(tail) : names.has(tail);
      if (hit) signatures.push(rel + '|' + at + '|value:' + expr);
    }
  }
}

if (argv.includes('--report')) {
  signatures.length
    ? signatures.forEach((s) => console.log('RAW CANONICAL VALUE RENDERED  ' + s))
    : console.log('No canonical value is rendered as user-facing text.');
  console.log('\n' + files.length + ' file(s) scanned, ' + unions.size + ' canonical vocabular(ies), '
    + literals.size + ' value(s), ' + canonicalProps.size + ' canonical propert(ies), '
    + regionsSeen + ' text region(s).');
  if (unions.size === 0) console.log('NOTE: no string-literal unions were found, so this run could not have failed.');
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, signatures, {
    name: 'PRESENTATION LABELS',
    regenerateCmd: CMD,
    note: 'Signature: <path>|<line>|<what>. A canonical (machine-cased) union value rendered as user-facing text (CP-32).',
  });
  console.log('wrote ' + path.relative(ROOT, BASELINE) + ' (' + n + ' raw canonical value(s) on screen)');
  process.exit(0);
}

if (unions.size === 0) {
  console.error('check-presentation-labels: no string-literal unions found - nothing to audit in this tree.');
}

process.exit(
  evaluateRatchet({
    name: 'PRESENTATION LABELS',
    signatures,
    baselineFile: BASELINE,
    regenerateCmd: CMD,
    parsedSomething: files.length > 0,
    remediation:
      'Declare the labels once and render those (CP-32): presentation<Status>({ active: "Active", ... }).\n'
      + '  Reference: src/lib/presentation.ts. The canonical value stays EXACTLY as it is - it is\n'
      + '  what the database, the API, filters, sorts, permissions and every data-testid use.\n'
      + '  Never rename a canonical value to make it read better; that spreads the defect into the schema.',
  })
);
