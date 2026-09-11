#!/usr/bin/env node
/**
 * check-theme-assets - every declared brand asset has a real file for every theme.
 *
 * WHY THIS EXISTS
 *   A logo is a colour decision that happens to be a file. A dark wordmark on a dark header
 *   is invisible in exactly the same way that #111827 text on #111111 is invisible - it just
 *   does not appear in any stylesheet, so no colour gate can see it. This gate can.
 *
 * CHECKS
 *   1. Each asset in tokens.json assets.items declares a light AND a dark path.
 *   2. Both files exist on disk (unless themeIndependent: true, which must be justified in `note`).
 *   3. If a single file is reused for both themes, it is flagged unless themeIndependent is set -
 *      "one logo works everywhere" is a claim that must be made deliberately, not by omission.
 *   4. For SVG assets, any hard-coded fill/stroke is reported so a mark that cannot adapt is visible.
 *
 * USAGE  node scripts/check-theme-assets.mjs [--tokens <p>] [--public <dir>] [--report]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { appPath } from './lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const REPORT = argv.includes('--report');
const ROOT = process.cwd();
const TOKENS = path.resolve(ROOT, arg('--tokens', appPath(ROOT, 'design/tokens.json')));
const PUBLIC = path.resolve(ROOT, arg('--public', appPath(ROOT, 'public')));

const tokens = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
const items = tokens.assets?.items ?? [];

if (!items.length) {
  console.error('BLOCKED: tokens.json declares no assets.items.');
  console.error('An application with no declared brand assets is possible; an UNDECLARED one is not verifiable.');
  console.error('Declare an empty array explicitly if that is genuinely the case.');
  process.exit(2);
}

const problems = [];
const notes = [];
const resolveAsset = (p) => path.join(PUBLIC, p.replace(/^\//, ''));

for (const a of items) {
  const id = a.id ?? '(unnamed)';
  if (!a.light || !a.dark) {
    problems.push(`${id}: missing ${!a.light ? 'light' : 'dark'} variant. Declare one per theme, or set themeIndependent: true with a reason.`);
    continue;
  }
  for (const theme of ['light', 'dark']) {
    const file = resolveAsset(a[theme]);
    if (!fs.existsSync(file)) {
      problems.push(`${id}.${theme}: declared "${a[theme]}" but ${path.relative(ROOT, file)} does not exist.`);
      continue;
    }
    if (file.endsWith('.svg')) {
      const svg = fs.readFileSync(file, 'utf8');
      const hard = [...svg.matchAll(/(?:fill|stroke)\s*[:=]\s*["']?(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g)].map((m) => m[1]);
      if (hard.length) notes.push(`${id}.${theme}: ${hard.length} hard-coded colour(s) in the SVG (${[...new Set(hard)].slice(0, 4).join(', ')}). Fine for a per-theme file; a defect if you intended one adaptive mark using currentColor.`);
    }
  }
  if (a.light === a.dark && !a.themeIndependent) {
    problems.push(`${id}: the same file is used for both themes without themeIndependent: true. If one mark is genuinely safe on every surface, say so explicitly and record the measured contrast in the note.`);
  }
  if (a.themeIndependent && !a.note) {
    problems.push(`${id}: themeIndependent is set with no note. An exemption without a stated reason is an untracked risk.`);
  }
}

if (REPORT || notes.length) notes.forEach((n) => console.log(`NOTE  ${n}`));

if (problems.length) {
  console.error(`\nBLOCKED - ${problems.length} theme-asset problem(s):\n`);
  problems.forEach((p) => console.error(`  - ${p}`));
  console.error('\nSee docs/14-LOGO-AND-IMAGE-ASSETS.md');
  process.exit(2);
}
console.log(`OK  ${items.length} declared asset(s), both theme variants present.`);
