#!/usr/bin/env node
/**
 * check-hardcoded-colors - no colour literal may live outside design/tokens.json.
 *
 * WHY THIS IS THE MOST VALUABLE THEME GATE
 *   Contrast checking proves the TOKENS are safe. It proves nothing about an element that
 *   bypassed them. The classic failure is a component styled with a light-theme grey copied
 *   from another project, rendered onto a dark surface: it is not low contrast, it is
 *   INVISIBLE - and no amount of token tuning can reach it because it never read a token.
 *
 *   Only this gate can see that class of defect, because the defect is the absence of a token.
 *
 * USAGE
 *   node scripts/audits/check-hardcoded-colors.mjs [--dir <src>] [--write-baseline] [--report]
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
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/hardcoded-colors-baseline.txt')));
const CMD = 'node scripts/audits/check-hardcoded-colors.mjs --write-baseline';

/* Generated token files ARE the legitimate home of literals, and this file quotes patterns
 * that would otherwise match itself. A detector that reads its own output as evidence
 * reports nonsense - exclude both, deliberately and visibly. */
const EXEMPT = [/tokens\.generated\./, /\.test\./, /\.spec\./, /check-hardcoded-colors/];

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\([^)]*\)|\bhsla?\s*\([^)]*\)/g;
const ALLOW_LINE = /(eslint-disable|allow-literal-color|GENERATED|currentColor|transparent)/;

const files = walk(DIR, { exts: ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss'] })
  .filter((f) => !EXEMPT.some((re) => re.test(f)));

const signatures = [];
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let count = 0;
  for (const line of lines) {
    if (ALLOW_LINE.test(line)) continue;
    const hits = line.match(COLOR_RE);
    if (hits) count += hits.length;
  }
  if (count > 0) signatures.push(`${rel}|${count}`);
}

if (argv.includes('--report')) {
  signatures.length
    ? signatures.forEach((s) => console.log(s))
    : console.log('No colour literals found outside the token system.');
  console.log(`\n${files.length} file(s) scanned, ${signatures.length} with literals.`);
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, signatures, {
    name: 'HARDCODED COLOUR',
    regenerateCmd: CMD,
    note: 'Signature: <path>|<count>. Count is included so a file may only get BETTER, never quietly worse.',
  });
  console.log(`wrote ${path.relative(ROOT, BASELINE)} (${n} file(s) with literals)`);
  process.exit(0);
}

process.exit(
  evaluateRatchet({
    name: 'HARDCODED COLOUR',
    signatures,
    baselineFile: BASELINE,
    regenerateCmd: CMD,
    parsedSomething: files.length > 0,
    remediation:
      'Replace the literal with a semantic token: var(--text-body) in CSS, v("text.body") in TS.\n' +
      '  If the colour is genuinely new, add a SEMANTIC ROLE to design/tokens.json (not a shade name),\n' +
      '  give it a light and a dark value, add its contrast pairs, then: npm run theme:build.',
  })
);
