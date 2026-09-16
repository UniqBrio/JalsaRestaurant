#!/usr/bin/env node
/**
 * check-typography — the ratchet that keeps the type system named.
 *
 * WHY THIS EXISTS
 *   The screens carried 298 hand-written `text-[Npx]` values in 22 distinct sizes (Phase 2B
 *   audit). A migration that is not ratcheted is a migration that is undone one component at a
 *   time, because the next person writing a card has no way to know that `text-[12.5px]` is the
 *   thing this file exists to stop. Colour has `check-hardcoded-colors.mjs`; type had nothing.
 *
 * WHY IT LIVES HERE AND NOT IN scripts/audits/
 *   `scripts/audits/` is framework-owned and protected. This is an application rule about an
 *   application's components, so it ships with the application and is wired into the
 *   application's own `audit:all`.
 *
 * WHY IT IS A RATCHET AND NOT A CLEAN GATE
 *   Zero is the wrong target. A handful of literals are correct — a glyph sized to its circle, a
 *   badge bounded by its pill — and a gate that demands zero gets an exception list bolted on
 *   within a week, or gets switched off. So: the count may only ever fall. Framework binding
 *   rule 2 — no new violations, and fixed-but-still-listed violations also blocked, so the list
 *   can only shrink.
 *
 * WHY A PARSE OF NOTHING IS BLOCKED, NOT CLEAN
 *   A scan that matched no files looks exactly like a perfectly migrated codebase. If the glob
 *   returns nothing, this exits 3 (BLOCKED) rather than 0. Framework binding rule 3.
 *
 * EXIT CODES
 *   0  PASS     count <= baseline, classes present, tokens correct
 *   1  FAIL     count > baseline, or a required class/token is missing or wrong
 *   3  BLOCKED  parsed nothing, or the baseline file is unreadable
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const SRC = path.join(APP, 'src');
const BASELINE = path.join(HERE, 'typography-baseline.json');

const rel = (p) => path.relative(APP, p);
const die = (code, ...lines) => {
  for (const l of lines) console.error(l);
  process.exit(code);
};

/* ── 1. Count the literals ──────────────────────────────────────────────── */

const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
};

if (!fs.existsSync(SRC)) die(3, `BLOCKED [TYPOGRAPHY] no ${rel(SRC)} to scan.`);
const files = walk(SRC);
if (files.length === 0) {
  die(3, 'BLOCKED [TYPOGRAPHY] the sweep read 0 component files.',
      '  A scan that matched nothing is indistinguishable from a migrated codebase.');
}

const LITERAL = /text-\[[0-9.]+px\]/g;
const found = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(LITERAL)) found.push({ file: rel(f), line: i + 1, text: m[0] });
  });
}

/* ── 2. The required classes exist and are token-driven ─────────────────── */

const CLASSES = [
  'type-h1', 'type-h2', 'type-h3', 'type-body', 'type-caption',
  'type-button', 'type-eyebrow', 'type-metric', 'type-badge',
];
const cssPath = path.join(SRC, 'app', 'globals.css');
if (!fs.existsSync(cssPath)) die(3, `BLOCKED [TYPOGRAPHY] ${rel(cssPath)} is missing; nothing to verify.`);
const css = fs.readFileSync(cssPath, 'utf8');

const missingClass = CLASSES.filter((c) => !new RegExp(`\\.${c}\\s*\\{`).test(css));
// A class that hard-codes a size is the very literal this file exists to prevent, one level down.
const literalInClass = [];
for (const c of CLASSES) {
  const block = new RegExp(`\\.${c}\\s*\\{([^}]*)\\}`).exec(css);
  if (block && /font-size:\s*[0-9.]+(px|rem)/.test(block[1])) literalInClass.push(c);
}

/* ── 3. The token values are the approved scale ─────────────────────────── */

const tokens = JSON.parse(fs.readFileSync(path.join(APP, 'design', 'tokens.json'), 'utf8'));
const size = tokens.typography?.size ?? {};
const lh = tokens.typography?.lineHeight ?? {};
const APPROVED = {
  h1: ['32px', '40px'], h2: ['24px', '32px'], h3: ['18px', '26px'],
  body: ['14px', '20px'], caption: ['12px', '16px'], button: ['16px', '24px'],
  bodyDense: ['13px', '19px'], captionDense: ['11.5px', '16px'],
};
const wrongToken = Object.entries(APPROVED)
  .filter(([k, [s, l]]) => size[k] !== s || lh[k] !== l)
  .map(([k, [s, l]]) => `${k}: expected ${s}/${l}, found ${size[k] ?? '-'}/${lh[k] ?? '-'}`);

/* ── 4. The ratchet ─────────────────────────────────────────────────────── */

if (!fs.existsSync(BASELINE)) {
  die(3, `BLOCKED [TYPOGRAPHY] no baseline at ${rel(BASELINE)}.`,
      '  The check did not run. A missing baseline is BLOCKED, never a pass.',
      `  Seed it with: node scripts/check-typography.mjs --write-baseline`);
}
let baseline;
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
} catch (e) {
  die(3, `BLOCKED [TYPOGRAPHY] ${rel(BASELINE)} is unreadable: ${e.message}`);
}

if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({ ...baseline, count: found.length }, null, 2) + '\n');
  console.log(`WROTE [TYPOGRAPHY] baseline count = ${found.length}`);
  process.exit(0);
}

const problems = [];
if (missingClass.length) problems.push(`  missing semantic class(es): ${missingClass.join(', ')}`);
if (literalInClass.length) problems.push(`  class(es) hard-coding a size instead of a token: ${literalInClass.join(', ')}`);
for (const w of wrongToken) problems.push(`  token off the approved scale — ${w}`);

if (found.length > baseline.count) {
  problems.push(`  ${found.length} literal(s), baseline ${baseline.count} — ${found.length - baseline.count} NEW.`);
  const known = new Set((baseline.knownFiles ?? []));
  const fresh = found.filter((f) => !known.has(f.file));
  for (const f of fresh.slice(0, 15)) problems.push(`    + ${f.file}:${f.line}  ${f.text}`);
}

if (problems.length) {
  die(1, `BLOCKED [TYPOGRAPHY] ${found.length} literal(s) scanned across ${files.length} file(s):`,
      ...problems, '',
      '  Use a semantic class — .type-h1 .type-h2 .type-h3 .type-body .type-caption .type-button',
      '  or, for a role that is deliberately off the scale, .type-eyebrow .type-metric .type-badge.',
      '  Every one reads design/tokens.json. A new size belongs in the token file, not in a component.');
}

const moved = baseline.count - found.length;
console.log(
  `OK [TYPOGRAPHY] ${found.length} literal(s) across ${files.length} component file(s); ` +
  `baseline ${baseline.count}${moved > 0 ? ` (${moved} migrated)` : ''}. ` +
  `All ${CLASSES.length} semantic classes present and token-driven; scale matches the approved values.`
);
