#!/usr/bin/env node
/**
 * design-ingest - turn a folder of supplied design artifacts into a structured, checkable
 * inventory, so that implementing an approved design starts from EVIDENCE rather than from
 * whichever file the agent happened to open first.
 *
 * THE FAILURE THIS EXISTS TO PREVENT (RC-018)
 *   A complete, approved design corpus is handed over; the implementation comes back with a
 *   different navigation and a different brand. Nobody ignored the design. The agent read *some*
 *   of it, extracted no structure, and filled every gap with its own judgement - and because "I
 *   reviewed the design files" is unfalsifiable, the substitution was invisible.
 *
 * EVERY ARTIFACT GETS ONE OF EIGHT CLASSES, AND THE SUMMARY TELLS THE TRUTH
 *   A  parsed                 structure and content extracted (pages, stylesheets, md, json, csv,
 *                             txt, and DOCX where an extractor exists)
 *   B  partial                read, but the extractor got little from it (say so, not "parsed")
 *   C  unsupported            accessible, no extractor for this type
 *   D  needs extraction       a document format whose extractor is NOT available on this machine
 *   E  needs visual inspection an image or drawing that a design page actually REFERENCES -
 *                             textual parsing is not looking at it, and this tool will not pretend
 *   F  duplicate              byte-identical to another artifact (hash), listed once as itself
 *   G  unreferenced input     an image/document nothing in the design references - material fed
 *                             INTO the design tool, not design output
 *   H  generated / renderer   the design tool's own runtime, bundles, lint config, thumbnails
 *
 *   The first version put 63 of 77 real artifacts in one bucket, "inspect by hand". Eight were
 *   material; fifty-five were input material, a duplicate and a thumbnail. Undifferentiated
 *   honesty is the same as noise - nobody inspects 63 files by hand, so nobody inspected the 8.
 *
 * THE TRAP THIS TOOL WAS BUILT AROUND
 *   A generated corpus contains TWO design systems, and the wrong one is more discoverable:
 *   the MEDIUM (the document shell - a `_ds/` folder, `--color-*` tokens, a readme calling
 *   itself a design system) and the PRODUCT (literal values drawn on the screens). On a real
 *   corpus the medium's readme said "terracotta accent, never hard-code a hex" while one maroon
 *   literal appeared 219 times across every product screen. The two ledgers are reported
 *   SEPARATELY and this tool never chooses between them - see CONFLICTS.
 *
 * EXIT CODES - what the caller must do next
 *   0  fully processed, no conflicts            -> write the contract
 *   1  action required: a conflict to resolve, class-D artifacts, or class-E artifacts to look at
 *   3  the folder could not be read             -> report it, ask for it, do NOT infer
 *
 * USAGE
 *   node scripts/design-ingest.mjs <dir> [--json] [--detail <file>]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DIR = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--detail');

if (!DIR) {
  console.error('design-ingest: give it a directory.\n  node scripts/design-ingest.mjs <dir> [--json] [--detail <file>]');
  process.exit(2);
}
if (!fs.existsSync(DIR)) {
  console.error(`design-ingest: BLOCKED - cannot read "${DIR}".`);
  console.error('  Do NOT proceed from memory or inference. Report the inaccessible source and ask for it.');
  process.exit(3);
}

const EXT = {
  page: ['.html', '.htm'], stylesheet: ['.css'], script: ['.js', '.mjs', '.ts'],
  text: ['.md', '.markdown', '.txt', '.csv', '.json'], document: ['.docx'],
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'],
};
const kindOf = (f) => {
  const b = path.basename(f); const e = path.extname(f).toLowerCase();
  if (b === '.thumbnail') return 'image';
  for (const [k, exts] of Object.entries(EXT)) if (exts.includes(e)) return k;
  return 'other';
};
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const HEX = /#[0-9a-fA-F]{6}\b/g;
const VAR_DECL = /(--[\w-]+)\s*:\s*([^;}]+)/g;
const HEADING = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const LINKED = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const GENERATED = /GENERATED|@ds-bundle|@ds-adherence|do not edit/i;

/** DOCX is a zip; word/document.xml is the text. Stock tooling only, tried in order. */
function docxText(abs) {
  const tryRun = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return r.status === 0 && r.stdout ? r.stdout : null; };
  // The entry is `word/document.xml` in every DOCX Word writes, and `word\document.xml` in one a
  // .NET zip writer produced - so the lookup tolerates either separator rather than declaring
  // "no extractor" over a backslash.
  let xml = tryRun('unzip', ['-p', abs, 'word/document.xml']) || tryRun('unzip', ['-p', abs, 'word\\document.xml']);
  if (!xml && process.platform === 'win32') {
    const ps = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${abs.replace(/'/g, "''")}'); $e=$z.Entries | Where-Object { ($_.FullName -replace '\\\\','/') -eq 'word/document.xml' } | Select-Object -First 1; if($e){$r=New-Object System.IO.StreamReader($e.Open()); $r.ReadToEnd(); $r.Close()}; $z.Dispose()`;
    xml = tryRun('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  }
  if (!xml) return null;
  // Paragraph boundaries become newlines so headings survive as lines.
  return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').trim();
}

const files = walk(DIR);
const artifacts = [];
const productColour = new Map();
const mediumColour = new Map();
const tokenDecl = new Map();
const fontDecl = new Map();
const hashes = new Map();       // hash -> first artifact rel
const referenced = new Set();   // basenames referenced from any parsed page/stylesheet
let unreadable = 0;

// Pass 1: text-bearing artifacts, so that references are known before images are classified.
for (const abs of files) {
  const relp = path.relative(DIR, abs).replace(/\\/g, '/');
  const kind = kindOf(abs);
  const a = { file: relp, kind, bytes: fs.statSync(abs).size, cls: null, note: '' };
  artifacts.push(a);
  if (kind === 'image' || kind === 'other') continue;

  let src;
  try { src = fs.readFileSync(abs, 'utf8'); }
  catch { unreadable++; a.cls = 'C'; a.note = 'UNREADABLE - report it, do not infer its contents'; continue; }

  if (kind === 'page') {
    a.cls = 'A';
    a.title = (src.match(TITLE) ?? [])[1] ? strip((src.match(TITLE) ?? [])[1]) : null;
    const headings = [...src.matchAll(HEADING)].map((m) => ({ level: Number(m[1]), text: strip(m[2]) })).filter((h) => h.text);
    a.headings = headings.length; a.outline = headings.slice(0, 40);
    a.words = strip(src).split(' ').filter(Boolean).length;
    for (const [hex] of src.matchAll(HEX)) { const h = hex.toLowerCase(); productColour.set(h, (productColour.get(h) ?? 0) + 1); }
    a.literalColours = (src.match(HEX) ?? []).length;
    a.usesTokens = new Set([...src.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1])).size;
    a.links = [...new Set([...src.matchAll(LINKED)].map((m) => m[1]))].filter((h) => !/^(https?:|#|mailto:|data:)/.test(h));
    for (const l of a.links) referenced.add(path.basename(l.split('?')[0]));
    /* REPEATED LABEL GROUPS - one class carrying short text, several times: what a section list,
       a menu or a feature list looks like once a design tool has rendered it, whatever the class
       is called. Reported as CANDIDATES; the tool does not decide which one is the navigation. */
    const byClass = new Map();
    for (const m of src.matchAll(/<(\w+)[^>]*class="([^"]{1,40})"[^>]*>([^<]{2,44})</g)) {
      const text = strip(m[3]); if (!text || /^[\d\s.,:%+-]+$/.test(text)) continue;
      const cls = m[2].trim(); if (!byClass.has(cls)) byClass.set(cls, []); byClass.get(cls).push(text);
    }
    a.labelGroups = [...byClass.entries()].map(([cls, items]) => ({ cls, count: items.length, items: [...new Set(items)].slice(0, 20) }))
      .filter((g) => g.count >= 3 && g.items.length >= 3).sort((x, y) => y.count - x.count).slice(0, 8);
    if (a.headings === 0 && a.literalColours === 0 && a.labelGroups.length === 0) { a.cls = 'B'; a.note = 'no headings, colours or label groups extracted'; }
    continue;
  }
  if (kind === 'stylesheet') {
    a.cls = 'A';
    const decls = [...src.matchAll(VAR_DECL)]; a.tokens = decls.length;
    for (const [, name, raw] of decls) {
      const value = raw.trim();
      if (/^--color/.test(name)) { tokenDecl.set(name, value); for (const h of value.match(HEX) ?? []) mediumColour.set(h.toLowerCase(), (mediumColour.get(h.toLowerCase()) ?? 0) + 1); }
      if (/^--font/.test(name)) fontDecl.set(name, value);
    }
    for (const m of src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) referenced.add(path.basename(m[1].split('?')[0]));
    if (a.tokens === 0) { a.cls = 'B'; a.note = 'no custom properties found'; }
    continue;
  }
  if (kind === 'script') {
    a.cls = GENERATED.test(src.slice(0, 400)) || /(^|\/)_ds\//.test('/' + relp) ? 'H' : 'C';
    a.note = a.cls === 'H' ? 'generated runtime / bundle - the design tool, not the design' : 'script - accessible, no design extractor';
    continue;
  }
  if (kind === 'text') {
    const e = path.extname(abs).toLowerCase();
    if (/(^|\/)_[^/]*\.(json)$/.test(relp) && /lint|adherence/.test(relp)) { a.cls = 'H'; a.note = 'tool configuration'; continue; }
    a.cls = 'A';
    a.words = src.split(/\s+/).filter(Boolean).length;
    a.literalColours = (src.match(HEX) ?? []).length;
    if (e === '.json') {
      try { const j = JSON.parse(src); a.keys = Object.keys(j).slice(0, 20); a.namespace = j.namespace ?? j.name ?? null; }
      catch { a.cls = 'B'; a.note = 'JSON did not parse'; }
    } else if (e === '.csv') {
      const ls = src.split(/\r?\n/).filter(Boolean); a.header = ls[0]?.slice(0, 200); a.rows = Math.max(0, ls.length - 1);
    } else {
      a.headingsText = src.split(/\r?\n/).filter((l) => /^#{1,6}\s/.test(l)).map((l) => l.replace(/^#+\s*/, '')).slice(0, 30);
      a.lede = src.split(/\r?\n/).find((l) => l.trim() && !/^#/.test(l))?.slice(0, 240) ?? '';
      a.headings = a.headingsText.length;
    }
    continue;
  }
  if (kind === 'document') {
    const text = docxText(abs);
    if (text === null) { a.cls = 'D'; a.note = 'DOCX - no extractor available (needs unzip or PowerShell zip support)'; continue; }
    a.cls = 'A'; a.extractedVia = 'zip: word/document.xml';
    a.words = text.split(/\s+/).filter(Boolean).length;
    a.lede = text.split('\n').find((l) => l.trim())?.slice(0, 240) ?? '';
    a.headingsText = text.split('\n').filter((l) => /^\s*\d+(\.\d+)*\.?\s+[A-Z]/.test(l)).map((l) => l.trim().slice(0, 80)).slice(0, 30);
    if (a.words < 20) { a.cls = 'B'; a.note = `only ${a.words} word(s) extracted`; }
    continue;
  }
}

// Pass 2: images, now that references and hashes can be judged. Grouped by hash FIRST, because
// the survivor of a duplicate group must be the one the design REFERENCES - directory order
// once made the referenced logo "a duplicate of" an unreferenced upload, and the E class vanished.
for (const a of artifacts) {
  if (a.cls || a.kind !== 'image') continue;
  const base = path.basename(a.file);
  if (base.startsWith('.')) { a.cls = 'H'; a.note = 'preview thumbnail of the export'; continue; }
  try { a.hash = crypto.createHash('md5').update(fs.readFileSync(path.join(DIR, a.file))).digest('hex'); }
  catch { unreadable++; a.cls = 'C'; a.note = 'UNREADABLE'; continue; }
  if (!hashes.has(a.hash)) hashes.set(a.hash, []);
  hashes.get(a.hash).push(a);
}
for (const group of hashes.values()) {
  const canonical = group.find((a) => referenced.has(path.basename(a.file))) ?? group[0];
  for (const a of group) {
    if (a !== canonical) { a.cls = 'F'; a.note = `byte-identical to ${canonical.file}`; continue; }
    if (referenced.has(path.basename(a.file))) { a.cls = 'E'; a.note = 'referenced by the design - REQUIRES VISUAL INSPECTION; text parsing is not looking at it'; }
    else { a.cls = 'G'; a.note = 'referenced by no design page or stylesheet - input material, not design output'; }
  }
}
for (const a of artifacts) if (!a.cls) { a.cls = 'C'; a.note = 'unrecognised type'; }

/* ------------------------------------------------------------------ analysis */
const rank = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
const pages = artifacts.filter((a) => a.kind === 'page' && a.cls !== 'C');
const spread = new Map();
for (const a of pages) {
  const src = fs.readFileSync(path.join(DIR, a.file), 'utf8');
  for (const h of new Set((src.match(HEX) ?? []).map((x) => x.toLowerCase()))) spread.set(h, (spread.get(h) ?? 0) + 1);
}
const topProduct = rank(productColour).filter(([h]) => !mediumColour.has(h)).slice(0, 10);

const conflicts = [];
const declaredAccent = [...tokenDecl.entries()].find(([n]) => /^--color-accent$/.test(n));
const dominant = topProduct[0];
if (declaredAccent && dominant) {
  const declaredHex = (declaredAccent[1].match(HEX) ?? [])[0]?.toLowerCase();
  if (declaredHex && declaredHex !== dominant[0]) {
    // The medium's own description, if it has one, is evidence about SCOPE - reported, not decided on.
    const readme = artifacts.find((x) => /readme\.md$/i.test(x.file) && x.cls === 'A');
    const manifest = artifacts.find((x) => /manifest\.json$/i.test(x.file) && x.cls === 'A');
    conflicts.push({
      kind: 'BRAND COLOUR',
      medium: `${declaredAccent[0]}: ${declaredHex} (declared in a stylesheet${manifest?.namespace ? `, design system "${manifest.namespace}"` : ''})`,
      product: `${dominant[0]} (literal, ${dominant[1]} occurrences across ${spread.get(dominant[0]) ?? 0} of ${pages.length} page(s))`,
      scope: readme ? `the stylesheet's own readme describes itself: "${readme.lede.slice(0, 160)}"` : 'no readme describes the stylesheet\'s scope',
      why: 'A stylesheet token styles the DOCUMENT; a literal repeated across product screens is the PRODUCT brand. '
        + 'They are different systems and this tool will not choose between them.',
      resolve: 'Decide on scope + provenance, not frequency; record Precedence in the contract, section 9.',
    });
  }
}
if (unreadable > 0) conflicts.push({ kind: 'UNREADABLE SOURCE', medium: `${unreadable} file(s)`, product: '-', scope: '-', why: 'A source that could not be parsed is not a source that agrees with you.', resolve: 'Report the inaccessible artifact and ask for it. Never infer its contents.' });

const byClass = {};
for (const a of artifacts) byClass[a.cls] = (byClass[a.cls] ?? 0) + 1;
const needsExtraction = artifacts.filter((a) => a.cls === 'D');
const needsEyes = artifacts.filter((a) => a.cls === 'E');
const complete = needsExtraction.length === 0 && needsEyes.length === 0 && unreadable === 0;
const exitCode = (conflicts.length || !complete) ? 1 : 0;

const report = {
  root: DIR, counts: { artifacts: artifacts.length, byClass }, complete,
  needsExtraction: needsExtraction.map((a) => a.file), needsVisualInspection: needsEyes.map((a) => a.file),
  productPalette: topProduct.map(([hex, n]) => ({ hex, occurrences: n, pages: spread.get(hex) ?? 0 })),
  mediumTokens: Object.fromEntries([...tokenDecl].slice(0, 24)), fonts: Object.fromEntries(fontDecl),
  conflicts, artifacts,
};

const detail = arg('--detail', null);
if (detail) {
  const a = artifacts.find((x) => x.file === detail || x.file.endsWith(detail));
  if (!a) { console.error(`design-ingest: no artifact matching "${detail}"`); process.exit(2); }
  console.log(JSON.stringify(a, null, 2)); process.exit(0);
}
if (argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); process.exit(exitCode); }

/* ------------------------------------------------------------------ human report */
const pad = (s, n) => String(s).padEnd(n);
const CLS = { A: 'A parsed', B: 'B partial', C: 'C unsupported', D: 'D needs extraction', E: 'E needs visual inspection', F: 'F duplicate', G: 'G unreferenced input', H: 'H generated/renderer' };
console.log(`DESIGN ARTIFACT INVENTORY  -  ${DIR}\n`);
console.log(`${artifacts.length} artifact(s):  ` + Object.keys(CLS).map((k) => `${CLS[k]} ${byClass[k] ?? 0}`).join('  ·  '));
console.log(complete ? '\nINGESTION: COMPLETE - every artifact is parsed, classified as not design, or a duplicate.'
  : `\nINGESTION: INCOMPLETE - ${needsExtraction.length} need(s) extraction, ${needsEyes.length} need(s) visual inspection, ${unreadable} unreadable.`
    + '\n  Do not write "all design files reviewed". Close each one by name in the contract, section 2.');

console.log('\nPARSED  (what was actually extracted, not "reviewed")');
console.log(`  ${pad('file', 44)}${pad('cls', 5)}${pad('headings', 10)}${pad('literals', 10)}${pad('tokens', 8)}${pad('words', 8)}note`);
for (const a of artifacts.filter((x) => x.cls === 'A' || x.cls === 'B')) {
  console.log(`  ${pad(a.file.slice(0, 42), 44)}${pad(a.cls, 5)}${pad(a.headings ?? (a.headingsText?.length ?? '-'), 10)}${pad(a.literalColours ?? '-', 10)}${pad(a.tokens ?? a.usesTokens ?? '-', 8)}${pad(a.words ?? '-', 8)}${a.note || a.extractedVia || a.namespace || ''}`);
}
for (const a of artifacts.filter((x) => (x.cls === 'A' || x.cls === 'B') && x.lede)) console.log(`    ${a.file}: "${a.lede.slice(0, 150)}"`);

console.log('\nCANDIDATE INVENTORIES  (repeated label groups - navigation, sections, features)');
console.log('  The tool does NOT decide which group is the navigation. It names them and counts them.');
let anyGroups = false;
for (const a of pages) for (const g of (a.labelGroups ?? []).slice(0, 3)) { anyGroups = true; console.log(`\n  ${a.file}  .${g.cls}  x${g.count}\n    ${g.items.join(' | ').slice(0, 300)}`); }
if (!anyGroups) console.log('\n  NONE FOUND. That is a finding, not a clean result: navigation and screens must be inventoried BY HAND.');

console.log('\nPRODUCT PALETTE  (literal values on the screens - the brand as drawn)');
for (const c of report.productPalette) console.log(`  ${pad(c.hex, 10)}${pad(c.occurrences + 'x', 8)}across ${c.pages} of ${pages.length} page(s)`);
if (!report.productPalette.length) console.log('  (none found - the screens may be entirely token-driven)');
console.log('\nMEDIUM TOKENS  (the DOCUMENT shell\'s own design system - not necessarily the product)');
for (const [k, v] of Object.entries(report.mediumTokens)) console.log(`  ${pad(k, 28)}${v}`);
if (!Object.keys(report.mediumTokens).length) console.log('  (no --color-* declarations found)');
console.log('\nFONTS'); for (const [k, v] of Object.entries(report.fonts)) console.log(`  ${pad(k, 28)}${v}`);

for (const [k, title] of [['D', 'NEEDS EXTRACTION'], ['E', 'NEEDS VISUAL INSPECTION  (a person looks and writes what they saw in the contract)'], ['C', 'UNSUPPORTED'], ['F', 'DUPLICATES'], ['H', 'GENERATED / RENDERER  (the tool, not the design)']]) {
  const list = artifacts.filter((a) => a.cls === k); if (!list.length) continue;
  console.log(`\n${title}`); for (const a of list) console.log(`  ${pad(a.file.slice(0, 50), 52)}${a.note}`);
}
const g = artifacts.filter((a) => a.cls === 'G');
if (g.length) { console.log(`\nUNREFERENCED INPUT MATERIAL  (${g.length}) - referenced by no design page; not implemented FROM`); console.log('  ' + g.slice(0, 6).map((a) => a.file).join(', ') + (g.length > 6 ? `, … +${g.length - 6}` : '')); }

if (conflicts.length) {
  console.log('\nCONFLICTS  -  resolve or escalate; this tool will not choose');
  for (const c of conflicts) { console.log(`\n  [${c.kind}]`); for (const k of ['medium', 'product', 'scope', 'why', 'resolve']) console.log(`    ${pad(k, 8)}: ${c[k]}`); }
} else console.log('\nNo conflicts detected between the document shell and the product screens.');

console.log('\nNEXT: write the Design Contract (templates/docs/DESIGN_CONTRACT.md) from this, then `npm run audit:design`.');
process.exit(exitCode);
