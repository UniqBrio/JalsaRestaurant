#!/usr/bin/env node
/**
 * check-contrast - assert WCAG contrast for every declared token pair, in EVERY theme.
 *
 * WHY THIS EXISTS
 *   "Both themes were checked" is a claim; this is the evidence. Eyeball QA misses the state
 *   it had no data for, and a grep cannot find a colour that was never written down - an
 *   element with no explicit colour has no literal to match. This computes the ratio from the
 *   token values themselves, so it holds for every state the tokens can produce.
 *
 * WHAT IT DOES NOT PROVE
 *   That the RENDERED element actually uses these tokens. That is the job of the runtime
 *   computed-contrast assertion in the test gate (see docs/13-CONTRAST-AND-ACCESSIBILITY.md).
 *   This is the floor, not the ceiling. Say so rather than implying more.
 *
 * USAGE
 *   node scripts/check-contrast.mjs                     audit; exit 2 on any failure
 *   node scripts/check-contrast.mjs --report            print every pair, always exit 0
 *   node scripts/check-contrast.mjs --write-baseline    record current failures as accepted debt
 *   node scripts/check-contrast.mjs --tokens <path> --baseline <path>
 *
 * RATCHET
 *   With a baseline present, a NEW failure blocks and a FIXED-but-still-listed pair also
 *   blocks (regenerate). The list can therefore only shrink. Adopting this on an existing
 *   codebase does not require fixing everything on day one - it requires never getting worse.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { contrastRatio, floorTo, suggest } from './lib/color.mjs';
import { appPath } from './lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const REPORT = argv.includes('--report');
const WRITE = argv.includes('--write-baseline');
const ROOT = process.cwd();
const TOKENS = path.resolve(ROOT, arg('--tokens', appPath(ROOT, 'design/tokens.json')));
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/contrast-baseline.txt')));

const tokens = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
const policy = tokens.contrastPolicy;
if (!policy?.pairs?.length) {
  console.error('BLOCKED: tokens.json has no contrastPolicy.pairs. A theme with no asserted pairs is unverified.');
  process.exit(2);
}
const THEMES = ['light', 'dark'];
const resolve = (name, theme) => {
  const t = tokens.semantic[name];
  if (!t) throw new Error(`Unknown semantic token "${name}" in contrastPolicy.pairs`);
  const val = t[theme];
  if (!val) throw new Error(`Token "${name}" has no "${theme}" value`);
  return val;
};

/* --- evaluate --- */
const rows = [];
for (const theme of THEMES) {
  for (const pair of policy.pairs) {
    const min = policy.minima[pair.min];
    if (min === undefined) throw new Error(`Unknown minimum "${pair.min}" (pair ${pair.fg}/${pair.bg})`);
    const fgVal = resolve(pair.fg, theme);
    const bgVal = resolve(pair.bg, theme);
    const ratio = floorTo(contrastRatio(fgVal, bgVal));
    rows.push({
      sig: `${theme}|${pair.fg}|${pair.bg}`,
      theme, fg: pair.fg, bg: pair.bg, fgVal, bgVal, ratio, min,
      level: pair.min,
      pass: ratio >= min,
    });
  }
}

/* A detector that parsed nothing must say so rather than reporting success. */
if (rows.length === 0) {
  console.error('BLOCKED: evaluated 0 pairs. The policy parsed empty - that is a defect, not a pass.');
  process.exit(2);
}

const failures = rows.filter((r) => !r.pass);

if (REPORT) {
  const w = Math.max(...rows.map((r) => `${r.fg} on ${r.bg}`.length));
  for (const theme of THEMES) {
    console.log(`\n=== ${theme.toUpperCase()} ===`);
    for (const r of rows.filter((x) => x.theme === theme)) {
      const label = `${r.fg} on ${r.bg}`.padEnd(w);
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${label}  ${String(r.ratio).padStart(6)}:1  (min ${r.min} ${r.level})  ${r.fgVal} / ${r.bgVal}`);
    }
  }
  console.log(`\n${rows.length} pairs evaluated, ${failures.length} failing.`);
  process.exit(0);
}

if (WRITE) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  const header = [
    '# CONTRAST BASELINE - accepted, temporary contrast debt.',
    '# Signature: <theme>|<fg-token>|<bg-token>   (values deliberately excluded: a re-tuned',
    '# shade must re-enter the gate rather than inherit an old exemption.)',
    '# A NEW failure blocks. A fixed pair still listed here ALSO blocks, so this file can only shrink.',
    `# Regenerate: node scripts/check-contrast.mjs --write-baseline`,
    `# Generated: ${new Date().toISOString().slice(0, 10)} - ${failures.length} accepted failure(s)`,
    '',
  ].join('\n');
  fs.writeFileSync(BASELINE, header + failures.map((f) => f.sig).sort().join('\n') + (failures.length ? '\n' : ''), 'utf8');
  console.log(`wrote ${path.relative(ROOT, BASELINE)} (${failures.length} accepted failure(s))`);
  if (failures.length === 0) console.log('0 accepted failures - this is now a CLEAN GATE, not a ratchet.');
  process.exit(0);
}

/* --- ratchet --- */
const baseSet = fs.existsSync(BASELINE)
  ? new Set(fs.readFileSync(BASELINE, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))
  : new Set();

const nowSet = new Set(failures.map((f) => f.sig));
const introduced = failures.filter((f) => !baseSet.has(f.sig));
const fixedButListed = [...baseSet].filter((s) => !nowSet.has(s));

let exit = 0;

if (introduced.length) {
  exit = 2;
  console.error(`\nBLOCKED - ${introduced.length} contrast failure(s) introduced:\n`);
  for (const f of introduced) {
    const fix = suggest(f.fgVal, f.bgVal, f.min);
    console.error(`  [${f.theme}] ${f.fg} (${f.fgVal}) on ${f.bg} (${f.bgVal})`);
    console.error(`           ${f.ratio}:1  -  needs >= ${f.min}:1 (${f.level})`);
    console.error(fix
      ? `           Nearest passing shade for ${f.fg}.${f.theme}: ${fix}`
      : `           No shade of this hue passes here. Change the ROLE assignment, not the shade.`);
    console.error('');
  }
  console.error(`Fix in ${path.relative(ROOT, TOKENS).split(path.sep).join('/')}, then: npm run theme:build && npm run theme:contrast`);
}

if (fixedButListed.length) {
  exit = 2;
  console.error(`\nBLOCKED - ${fixedButListed.length} baselined pair(s) now PASS but are still listed:`);
  fixedButListed.forEach((s) => console.error(`  ${s}`));
  console.error('\nA ratchet must shrink when it is paid down, or a regression can hide inside it.');
  console.error('Fix: node scripts/check-contrast.mjs --write-baseline   and commit the baseline.');
}

if (exit === 0) {
  const accepted = baseSet.size;
  console.log(`OK  ${rows.length} pairs across ${THEMES.length} themes${accepted ? `, ${accepted} accepted as baselined debt` : ' - clean gate, no accepted debt'}.`);
}
process.exit(exit);
