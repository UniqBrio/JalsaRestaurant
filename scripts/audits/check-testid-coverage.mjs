#!/usr/bin/env node
/**
 * check-testid-coverage - every interactive element is addressable by an automated runner.
 *
 * WHY IT MATTERS BEFORE YOU HAVE TESTS
 *   Test cases written as "click the Save button" are executable by a human and by nobody
 *   else. The moment you want a runner - or an agent - to execute the suite, addressability
 *   becomes the blocker, and retrofitting it across a mature UI is far more expensive than
 *   adding it as you go.
 *
 * NAMING (one convention, no variants)
 *   <module>-<element>                e.g. invoices-save
 *   <module>-<element>-<entityId>     e.g. invoices-row-8f21c3
 *   The entity id is the DATABASE id, NEVER the list index. A positional id renames itself
 *   on every insert, filter and sort - exactly when a test needs it to be stable.
 *   Place it on the element that HANDLES the interaction, never on a wrapper.
 *
 * WHAT THIS GATE CANNOT SEE (state the limit; do not imply more)
 *   Stability, uniqueness, entity-derivation, and correct placement are not syntactically
 *   decidable. This is a FLOOR - it sees existence. The rest stays a review question, and
 *   the review checklist says so.
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
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/testid-baseline.txt')));
const CMD = 'node scripts/audits/check-testid-coverage.mjs --write-baseline';

/* Genuinely interactive elements only. Wrappers are deliberately excluded: an id on a
 * wrapper is one of the defects this gate exists to make visible, not to bless. */
const INTERACTIVE = ['button', 'a', 'input', 'select', 'textarea', 'Button', 'Pressable', 'TouchableOpacity', 'Link'];
const OPEN_TAG = new RegExp(`<(${INTERACTIVE.join('|')})(\\s[^>]*?)?/?>`, 'gs');
const HAS_ID = /\b(data-testid|testID)\s*=/;

const files = walk(DIR, { exts: ['.tsx', '.jsx'] }).filter((f) => !/\.(test|spec)\./.test(f));

const signatures = [];
let totalTags = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  let missing = 0;
  for (const m of src.matchAll(OPEN_TAG)) {
    totalTags++;
    if (!HAS_ID.test(m[0])) missing++;
  }
  if (missing > 0) signatures.push(`${rel}|${missing}`);
}

if (argv.includes('--report')) {
  signatures.forEach((s) => console.log(s));
  console.log(`\n${files.length} file(s), ${totalTags} interactive element(s), ${signatures.length} file(s) with gaps.`);
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, signatures, {
    name: 'TEST ID COVERAGE',
    regenerateCmd: CMD,
    note: 'Signature: <path>|<count of interactive elements with no test id>.',
  });
  console.log(`wrote ${path.relative(ROOT, BASELINE)} (${n} file(s) with gaps)`);
  process.exit(0);
}

process.exit(
  evaluateRatchet({
    name: 'TEST ID COVERAGE',
    signatures,
    baselineFile: BASELINE,
    regenerateCmd: CMD,
    parsedSomething: files.length > 0,
    remediation:
      'Add data-testid="<module>-<element>" (or "<module>-<element>-<entityId>" on a row)\n' +
      '  to the element that HANDLES the interaction. The entity id is the database id, never the index.',
  })
);
