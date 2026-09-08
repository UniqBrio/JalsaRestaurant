#!/usr/bin/env node
/**
 * close-out - write the release story ONCE; emit the four places it has to appear.
 *
 * THE WASTE THIS REMOVES
 *   Every framework change ends by telling the same story four times: the UPGRADES section an
 *   app reads, the CHANGELOG paragraph, the commit message, and the summary given to the
 *   owner. Measured on this repository, generation - not reading, not the gates - is the
 *   dominant cost of a run: the whole mechanical stack is ~41s against runs of 27 to 65
 *   minutes. So the fourfold restatement is not a rounding error, it is the largest single
 *   block of writing in a close-out, and three quarters of it is transcription.
 *
 * WHAT IT DOES *NOT* DO - and this is the point
 *   It does not write the prose. Templated release notes are worse release notes: generic
 *   where they should be specific, and specific is the only reason anyone reads them. The
 *   record carries REAL SENTENCES, written once, by whoever understands the change. This
 *   script owns the SCAFFOLDING and the DUPLICATION - the headings, the ordering, the bump
 *   grammar, the four renderings - and nothing else. Structure is mechanical; judgement is not.
 *
 * ONE SOURCE, SO THEY CANNOT DISAGREE
 *   Told four times by hand, the four accounts drift, and the drifted one is always the one
 *   someone finds first. Here a fact stated once appears identically everywhere or not at all.
 *
 * USAGE
 *   node scripts/close-out.mjs <record.json> [--upgrades|--changelog|--commit|--all] [--apply]
 *   --apply prepends to UPGRADES.md and CHANGELOG.md and writes .close-out-commit.txt.
 *           It NEVER rewrites an existing entry: both files are newest-first and append-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const has = (n) => argv.includes(n);
const recordPath = argv.find((a) => !a.startsWith('--'));
const ROOT = process.cwd();

if (!recordPath) {
  console.error('close-out: give it a record. node scripts/close-out.mjs <record.json> [--all] [--apply]');
  console.error('  Required fields: version, date, bump (PATCH|MINOR|MAJOR), title, why, appAction.');
  console.error('  Optional: added[], fixed[], debt[], verification, files[], cases, rootCause.');
  process.exit(2);
}
if (!fs.existsSync(recordPath)) { console.error(`close-out: no such record: ${recordPath}`); process.exit(2); }

let rec;
try { rec = JSON.parse(fs.readFileSync(recordPath, 'utf8')); }
catch (e) { console.error(`close-out: ${recordPath} is not valid JSON - ${e.message}`); process.exit(2); }

const REQUIRED = ['version', 'date', 'bump', 'title', 'why', 'appAction'];
const missing = REQUIRED.filter((k) => !String(rec[k] ?? '').trim());
if (missing.length) {
  console.error(`close-out: the record is missing: ${missing.join(', ')}`);
  console.error('  Every one of these is read by somebody. "appAction" in particular: an upgrading');
  console.error('  app needs to be told "nothing" explicitly - silence there reads as "unknown".');
  process.exit(2);
}
if (!['PATCH', 'MINOR', 'MAJOR'].includes(rec.bump)) {
  console.error(`close-out: bump must be PATCH | MINOR | MAJOR - got "${rec.bump}".`);
  process.exit(2);
}

const list = (xs) => (Array.isArray(xs) ? xs.filter((x) => String(x).trim()) : []);
const added = list(rec.added), fixed = list(rec.fixed), debt = list(rec.debt), files = list(rec.files);

/* ---- the four renderings, all from the one record ---- */

function upgrades() {
  const out = [`## ${rec.version} — ${rec.date} — ${rec.bump}`, '', `**${rec.title}**`, '', rec.why, ''];
  if (rec.rootCause) out.push(`Full analysis: \`docs/registers/ROOT_CAUSE_REGISTER.md\` **${rec.rootCause}**.`, '');
  if (added.length) { out.push('### Added'); for (const a of added) out.push(`- ${a}`); out.push(''); }
  if (fixed.length) { out.push('### Fixed'); for (const f of fixed) out.push(`- ${f}`); out.push(''); }
  if (debt.length) {
    out.push('### Stated as honest debt, not papered over');
    for (const d of debt) out.push(`- ${d}`);
    out.push('');
  }
  out.push('### App action required', rec.appAction, '', '---', '');
  return out.join('\n');
}

function changelog() {
  const out = [`## ${rec.version} — ${rec.title}`, '', rec.why, ''];
  if (added.length) out.push(`Added: ${added.map(stripMd).join(' · ')}`, '');
  if (rec.verification) out.push(rec.verification, '');
  return out.join('\n');
}

/** The changelog is read in a terminal by a person, so markdown emphasis is noise there. */
function stripMd(s) {
  return String(s).replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

function commit() {
  const out = [`v${rec.version}: ${rec.title}`, '', wrap(rec.why), ''];
  if (added.length) { out.push('Added:'); for (const a of added) out.push(wrap(stripMd(a), '  - ', '    ')); out.push(''); }
  if (fixed.length) { out.push('Fixed:'); for (const f of fixed) out.push(wrap(stripMd(f), '  - ', '    ')); out.push(''); }
  if (debt.length) {
    out.push('Honest debt, recorded rather than disguised as coverage:');
    for (const d of debt) out.push(wrap(stripMd(d), '  - ', '    '));
    out.push('');
  }
  if (rec.verification) out.push(wrap(stripMd(rec.verification)), '');
  out.push(`App action: ${stripMd(rec.appAction)}`, '');
  out.push('Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>');
  return out.join('\n');
}

/** git log is read at 72 columns; longer lines are truncated by half the tools that show it. */
function wrap(text, firstPrefix = '', restPrefix = '') {
  const width = 72;
  const words = stripMd(text).split(/\s+/);
  const lines = [];
  let cur = firstPrefix;
  let prefix = restPrefix || firstPrefix.replace(/\S/g, ' ');
  for (const w of words) {
    if (cur.trim() && (cur + ' ' + w).length > width) { lines.push(cur); cur = prefix + w; }
    else cur = cur.trim() ? cur + ' ' + w : cur + w;
  }
  if (cur.trim()) lines.push(cur);
  return lines.join('\n');
}

/* ---- output ---- */
const wantAll = has('--all') || (!has('--upgrades') && !has('--changelog') && !has('--commit'));

if (!has('--apply')) {
  if (has('--upgrades') || wantAll) { console.log('===== UPGRADES.md =====\n'); console.log(upgrades()); }
  if (has('--changelog') || wantAll) { console.log('===== CHANGELOG.md =====\n'); console.log(changelog()); }
  if (has('--commit') || wantAll) { console.log('===== commit message =====\n'); console.log(commit()); }
  process.exit(0);
}

/* --apply: prepend, never rewrite. Both files are newest-first and append-only. */
function prepend(file, block, afterHeaderMarker) {
  const p = path.resolve(ROOT, file);
  if (!fs.existsSync(p)) { console.error(`close-out: ${file} is missing - not creating it.`); process.exit(2); }
  const text = fs.readFileSync(p, 'utf8');
  if (text.includes(`## ${rec.version} `) || text.includes(`## ${rec.version}\n`)) {
    console.error(`close-out: ${file} already has a ${rec.version} section. Refusing to write a second one.`);
    console.error('  These files are append-only: bump the version, or edit the existing entry by hand.');
    process.exit(2);
  }
  const at = afterHeaderMarker ? text.indexOf(afterHeaderMarker) : -1;
  const cut = at >= 0 ? at + afterHeaderMarker.length : 0;
  fs.writeFileSync(p, text.slice(0, cut) + block + text.slice(cut), 'utf8');
  console.log(`close-out: prepended ${rec.version} to ${file}`);
}

prepend('UPGRADES.md', upgrades(), '---\n\n');
prepend('CHANGELOG.md', changelog(), '# Changelog\n\n');
fs.writeFileSync(path.resolve(ROOT, '.close-out-commit.txt'), commit() + '\n', 'utf8');
console.log('close-out: commit message written to .close-out-commit.txt');
console.log('  git commit -F .close-out-commit.txt');
