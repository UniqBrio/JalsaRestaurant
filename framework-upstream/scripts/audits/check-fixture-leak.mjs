#!/usr/bin/env node
/**
 * check-fixture-leak - is placeholder data wired into a screen a user can reach?
 *
 * THE FAILURE THIS EXISTS FOR
 *   A screen is built against a hand-written array so it can be seen before the API exists.
 *   The API arrives, the screen is wired up - and the array stays, because it still renders
 *   something plausible. Nothing fails. No test goes red. The screen shows numbers, and the
 *   numbers are fiction.
 *
 *   Three shapes of the same defect, all observed in one release:
 *     - an Edit screen reading a fixture list, so it never finds the real record and opens
 *       blank (or worse, opens somebody else's record);
 *     - report figures that never move when the underlying data changes;
 *     - a picker whose options are a literal array that has quietly gone stale.
 *
 *   Every one of these is invisible to a type checker, a linter and a passing test suite. It
 *   is visible to a grep, which is why this exists.
 *
 * WHY IT IS A RATCHET AND NOT A CLEAN GATE
 *   Real applications legitimately carry constant tables - a list of Indian states, a currency
 *   ladder, an enum of statuses. Those are configuration, not fixtures, and forbidding them
 *   outright would get this switched off in a day. So the baseline records what exists today,
 *   each entry reviewed once, and only NEW placeholder data blocks.
 *
 * SCOPE: application source only. Tests, stories, fixtures directories and seed scripts are
 * where placeholder data BELONGS - flagging it there would be flagging the point.
 *
 * USAGE  node scripts/audits/check-fixture-leak.mjs [--dirs src] [--report|--write-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateRatchet, writeBaseline, walk } from '../lib/ratchet.mjs';
import { appPath } from '../lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = process.cwd();
const DIRS = arg('--dirs', appPath(ROOT, 'src')).split(',').map((d) => path.resolve(ROOT, d.trim()));
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/fixture-leak-baseline.txt')));
const CMD = 'node scripts/audits/check-fixture-leak.mjs --write-baseline';

/* Where placeholder data legitimately lives. */
const EXEMPT = /(^|\/)(tests?|__tests__|__mocks__|fixtures?|stories|mocks?|seed|seeds|test-data|examples?)(\/|$)|\.(spec|test|stories)\.[jt]sx?$/i;

const SIGNALS = [
  {
    id: 'fixture-import',
    // Importing from a fixture/mock directory in shipped code: the strongest signal there is.
    re: /^\s*import\s[^;]*?from\s+['"][^'"]*\/(?:__mocks__|fixtures?|mocks?|test-data|stubs?)\/[^'"]*['"]/gm,
    why: 'imports from a fixture/mock path',
  },
  {
    id: 'named-placeholder',
    // MOCK_MEMBERS = [...], sampleCourses = {...}, dummyRows = [...]
    re: /\b(?:const|let|var)\s+((?:MOCK|SAMPLE|DUMMY|FIXTURE|FAKE|STUB|PLACEHOLDER)_[A-Z0-9_]+|(?:mock|sample|dummy|fixture|fake|stub|placeholder)[A-Z]\w*)\s*(?::[^=]+)?=\s*[[{]/g,
    why: 'a placeholder-named data literal',
  },
  {
    id: 'hardcoded-dataset',
    // reportRows = [ {...}, {...} ] - a data-shaped name assigned two or more object literals.
    // This is the shape behind "the figures never change when the data does".
    re: /\b(?:const|let|var)\s+(\w*(?:[Dd]ata|[Rr]ows|[Rr]ecords|[Ii]tems|[Ll]ist|[Rr]eport|[Ss]tats|[Mm]etrics|[Rr]esults))\s*(?::[^=]+)?=\s*\[\s*\{[\s\S]{0,4000}?\}\s*,\s*\{/g,
    why: 'a hardcoded dataset literal (two or more object rows)',
  },
];

const audited = DIRS.filter(fs.existsSync).flatMap((d) => walk(d, { exts: ['.ts', '.tsx', '.js', '.jsx'] }));
const signatures = [];
let scanned = 0;

for (const file of audited) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (EXEMPT.test(rel)) continue;
  scanned++;
  const src = fs.readFileSync(file, 'utf8');
  for (const sig of SIGNALS) {
    sig.re.lastIndex = 0;
    let m;
    while ((m = sig.re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      const what = (m[1] ?? '').trim();
      signatures.push(`${rel}|${sig.id}${what ? `|${what}` : ''}`);
      void line;
    }
  }
}

/* Rule 3's corollary: a scan that matched no FILES looks exactly like a clean codebase. */
const parsedSomething = scanned > 0;

if (argv.includes('--report')) {
  console.log(`${scanned} application source file(s) scanned.`);
  signatures.length
    ? [...new Set(signatures)].sort().forEach((s) => console.log('  ' + s))
    : console.log('  No placeholder data found in application source.');
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, [...new Set(signatures)].sort(), {
    name: 'FIXTURE LEAK',
    regenerateCmd: CMD,
    note: 'Each entry is placeholder data in shipped source. Review once: a constant table (states, statuses, a currency ladder) is configuration and may stay; anything standing in for real data must be wired to the real source.',
  });
  console.log(`Baseline written: ${n} entry(ies) -> ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

process.exit(evaluateRatchet({
  name: 'FIXTURE LEAK',
  signatures: [...new Set(signatures)].sort(),
  baselineFile: BASELINE,
  regenerateCmd: CMD,
  parsedSomething,
  emptyParseHint: `No application source found under ${DIRS.map((d) => path.relative(ROOT, d)).join(', ')}. Pass --dirs.`,
  advice: 'Placeholder data reached shipped source. Wire the screen to its real source, or move the literal to a fixtures/ path if it is genuinely test-only. A screen that renders fiction fails no test and passes no user.',
}));
