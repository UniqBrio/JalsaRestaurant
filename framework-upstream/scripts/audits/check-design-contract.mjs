#!/usr/bin/env node
/**
 * check-design-contract - when an approved design was supplied, is it still the design being
 * built? Gate step G13 (RC-018, CP-33).
 *
 * WHAT CHANGED IN v4.0.0, AND WHY IT HAD TO
 *   The first version read the contract and `design/tokens.json` and nothing else. So a row that
 *   said `implemented` was believed, and the validation proved it: a feature omitted from the code
 *   and marked `implemented` produced "complete and consistent". That converted silent drift into
 *   a false statement - better than silence, and not detection. This version reads the CODE.
 *
 * THE RULE
 *   `implemented` REQUIRES EVIDENCE, and the evidence is resolved against the application tree:
 *
 *     file:<path>        the file exists
 *     route:<path>       a page exists at src/app<path>/page.* OR something links href="<path>"
 *     testid:<id>        a data-testid carrying that id exists in src
 *     text:"<label>"     the exact string appears in src (a nav label, a heading)
 *     spec:<path>        the spec file exists and declares at least one test
 *     manual:<who> <date> a named person verified it by eye - accepted, counted, never hidden
 *
 *   Several refs may be joined with `;`. A ref that does not resolve makes the row MISSING -
 *   "falsely claimed" - and the audit BLOCKS. A ref of a kind it cannot evaluate, or an app tree
 *   it cannot read, makes the row UNKNOWN, and the audit BLOCKS: it does not know, so it does
 *   not pass.
 *
 * DRIFT IS CLASSIFIED PER ROW, AND EVERY CLASS IS PRODUCED BY A RULE YOU CAN READ HERE
 *     SAME                    implemented, evidence resolves, no variance declared
 *     IMPLEMENTATION DETAIL   evidence resolves; variance `~ <area>: <what>` where <area> is
 *                             named in the contract's Implementation-flexibility section
 *     MINOR VARIATION         evidence resolves; variance declared, area NOT ceded in flexibility
 *     MATERIAL DESIGN CHANGE  brand token differs; or status `changed` (authorised: a row in the
 *                             recorded-changes section; unauthorised: none -> BLOCK)
 *     MISSING                 evidence does not resolve (claimed, BLOCK); or status deferred /
 *                             blocked with an owner (accounted - visible, not blocking)
 *     UNKNOWN                 status unresolved or blank evidence on implemented, or evidence
 *                             that cannot be evaluated -> BLOCK
 *     CONFLICTING             a CONFLICT / ASSERTION row in section 9 not marked resolved -> BLOCK
 *
 * RECORDED IS NOT RESOLVED, AND A BASELINE IS NOT AN APPROVAL
 *   Findings are HARD or SOFT. Hard findings exit 2 whatever the baseline says: blank, unresolved,
 *   an unsupported or false `implemented`, a change with no authority, a conflict with no
 *   resolution, a brand mismatch. The previous version let eight unresolved rows be baselined into
 *   exit 0 - documenting uncertainty was being counted as resolving it. Soft findings (a minor
 *   variation, a verification still pending) are ratcheted: recorded, visible, allowed to shrink.
 *
 * NO CONTRACT IS REPORTED, NEVER SILENTLY GREEN
 *   Most applications are not built from a supplied design. Absent contract -> one loud line, exit 0.
 *
 * USAGE
 *   node scripts/audits/check-design-contract.mjs [--contract <md>] [--app <dir>] [--tokens <json>]
 *        [--report | --write-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateRatchet, writeBaseline, walk } from '../lib/ratchet.mjs';
import { appPath } from '../lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = process.cwd();
const APP = path.resolve(ROOT, arg('--app', appPath(ROOT, '.')));
const CONTRACT = path.resolve(ROOT, arg('--contract', path.join(APP, 'docs/DESIGN_CONTRACT.md')));
const TOKENS = path.resolve(ROOT, arg('--tokens', path.join(APP, 'design/tokens.json')));
const BASELINE = path.resolve(ROOT, arg('--baseline', path.join(APP, '.baselines/design-contract-baseline.txt')));
const CMD = 'node scripts/audits/check-design-contract.mjs --write-baseline';

const STATUSES = ['implemented', 'deferred', 'changed', 'blocked', 'unresolved'];
const EMPTY_CLAIMS = /^(reviewed|checked|read|looked at|seen|inspected|n\/?a|tbd|-|\.{3}|…)?$/i;
const PLACEHOLDER = /^_.*_$|^<.*>$/;

const hard = [];   // never baselined
const soft = [];   // ratcheted
const drift = [];  // one classification per MUST-PRESERVE row
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const cell = (line) => line.split('|').map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));
const isRow = (l) => l.trim().startsWith('|') && !/^\|[\s:-]+\|/.test(l.trim());
const clean = (s) => (s ?? '').replace(/`/g, '').trim();

/* ------------------------------------------------------------------ the application tree */
const SRC = fs.existsSync(path.join(APP, 'src')) ? path.join(APP, 'src') : APP;
const appReadable = fs.existsSync(APP) && fs.statSync(APP).isDirectory();
let srcFiles = [];
let srcIndex = null;   // lazily built: file -> contents, for text/testid/route(href) lookups
function sources() {
  if (srcIndex) return srcIndex;
  srcIndex = new Map();
  srcFiles = appReadable ? walk(SRC, { exts: ['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.json'] })
    .filter((f) => !/\.(test|spec)\./.test(f)) : [];
  for (const f of srcFiles) { try { srcIndex.set(f, fs.readFileSync(f, 'utf8')); } catch { /* unreadable: absent */ } }
  return srcIndex;
}
const anySource = (pred) => [...sources().values()].some(pred);

/**
 * Resolve one evidence reference against the tree. Returns { ok, why } - and `ok: null` means
 * "could not evaluate", which is UNKNOWN, never a pass.
 */
function resolveRef(ref) {
  const m = ref.match(/^(file|route|testid|text|spec|manual):\s*(.+)$/);
  if (!m) return { ok: null, why: `unrecognised evidence "${ref}" - use file: route: testid: text: spec: manual:` };
  const [, kind, raw] = m;
  const v = raw.trim().replace(/^"(.*)"$/, '$1');
  if (kind === 'manual') {
    return /\S+\s+\d{1,2}[-/][A-Za-z0-9]{2,3}[-/]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(v)
      ? { ok: true, why: `verified by eye: ${v}`, manual: true }
      : { ok: false, why: `manual: needs a NAME and a DATE, got "${v}"` };
  }
  if (!appReadable) return { ok: null, why: `application tree not readable at ${rel(APP)}` };
  if (kind === 'file') {
    const p = path.resolve(APP, v);
    return fs.existsSync(p) ? { ok: true, why: `file present: ${v}` } : { ok: false, why: `no file at ${v}` };
  }
  if (kind === 'spec') {
    const p = path.resolve(APP, v);
    if (!fs.existsSync(p)) return { ok: false, why: `no spec at ${v}` };
    const s = fs.readFileSync(p, 'utf8');
    return /\btest\s*\(|\bit\s*\(/.test(s) ? { ok: true, why: `spec declares tests: ${v}` } : { ok: false, why: `${v} declares no test()` };
  }
  if (kind === 'route') {
    const seg = v.replace(/^\//, '');
    const pageDir = path.join(APP, 'src', 'app', seg);
    const page = ['page.tsx', 'page.ts', 'page.jsx', 'page.js'].some((f) => fs.existsSync(path.join(pageDir, f)));
    if (page) return { ok: true, why: `page at src/app/${seg}` };
    const linked = anySource((s) => s.includes(`href="${v}"`) || s.includes(`href='${v}'`) || s.includes(`href={"${v}"}`));
    return linked ? { ok: true, why: `linked: href="${v}"` } : { ok: false, why: `no page at src/app/${seg} and nothing links ${v}` };
  }
  if (kind === 'testid') {
    const found = anySource((s) => s.split('\n').some((l) => l.includes('data-testid') && l.includes(v)));
    return found ? { ok: true, why: `data-testid ${v} present` } : { ok: false, why: `no data-testid carrying ${v}` };
  }
  if (kind === 'text') {
    const found = anySource((s) => s.includes(v));
    return found ? { ok: true, why: `text "${v}" present in src` } : { ok: false, why: `text "${v}" not found in src` };
  }
  return { ok: null, why: 'unreachable' };
}

/* ------------------------------------------------------------------ the contract */
const contractPresent = fs.existsSync(CONTRACT);
const rows = { preserve: 0, coverage: 0 };

if (contractPresent) {
  const src = fs.readFileSync(CONTRACT, 'utf8');
  const C = rel(CONTRACT);
  const lines = src.split('\n');
  const sectionAt = (n) => {
    const start = lines.findIndex((l) => new RegExp(`^##\\s*${n}\\.`).test(l));
    if (start < 0) return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => /^##\s/.test(l));
    return rest.slice(0, end < 0 ? rest.length : end);
  };
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) if (!sectionAt(n)) hard.push(`${C}|section-${n}|MISSING SECTION`);

  // 1. Source authority: at least one SPECIFICATION, or nothing here is the design.
  const auth = sectionAt(1) ?? [];
  if (auth.length && !auth.some((l) => /SPECIFICATION/.test(l) && !PLACEHOLDER.test(cell(l)[0] ?? ''))) {
    hard.push(`${C}|section-1|NO ARTIFACT DECLARED AUTHORITATIVE - stop and escalate, do not infer`);
  }

  // 2. Coverage: evidence of extraction, not a claim of review.
  for (const l of (sectionAt(2) ?? []).filter(isRow)) {
    const c = cell(l);
    if (c.length < 3 || /^artifact$/i.test(c[0]) || PLACEHOLDER.test(c[0])) continue;
    rows.coverage++;
    if (EMPTY_CLAIMS.test(c[2] ?? '')) hard.push(`${C}|coverage:${c[0]}|CLAIM WITHOUT EVIDENCE - say what was extracted`);
  }

  // 4. Brand, against the one file colour lives in.
  const visual = (sectionAt(4) ?? []).join('\n');
  const declared = (visual.match(/brand colou?r[^:\n]*:[^#\n]*(#[0-9a-fA-F]{6})/i) ?? [])[1];
  if (!declared) hard.push(`${C}|section-4|NO CANONICAL BRAND COLOUR DECLARED - the drift check cannot run`);
  else if (fs.existsSync(TOKENS)) {
    try {
      const t = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
      const primary = t?.semantic?.primary;
      const hex = String(typeof primary === 'string' ? primary : primary?.light ?? '').match(/#[0-9a-fA-F]{6}/)?.[0];
      if (hex && hex.toLowerCase() !== declared.toLowerCase()) {
        hard.push(`${C}|brand|MATERIAL DESIGN CHANGE: contract ${declared.toLowerCase()} vs tokens ${hex.toLowerCase()}`);
        drift.push({ row: 'brand', decision: 'Brand colour', cls: 'MATERIAL DESIGN CHANGE', why: `contract ${declared} vs tokens ${hex}` });
      } else if (hex) drift.push({ row: 'brand', decision: 'Brand colour', cls: 'SAME', why: `tokens.json primary = ${hex}` });
    } catch { hard.push(`${C}|brand|tokens.json unreadable - the drift check did not run`); }
  } else {
    drift.push({ row: 'brand', decision: 'Brand colour', cls: 'UNKNOWN', why: `no tokens file at ${rel(TOKENS)}` });
    hard.push(`${C}|brand|UNKNOWN - no tokens file to compare against`);
  }

  // 6. What the design ceded to the implementer - the areas that make a variance a DETAIL.
  const flexibility = (sectionAt(6) ?? []).join(' ').toLowerCase();
  // 8. Recorded changes - the authority behind any `changed`.
  const changeRows = (sectionAt(8) ?? []).filter(isRow).map((l) => cell(l)).filter((c) => c[0] && !/^decision changed$/i.test(c[0]));
  const authorised = (what) => changeRows.some((c) => c[0].toLowerCase().includes(what.toLowerCase().slice(0, 18)) && (c[3] ?? '').trim() && !PLACEHOLDER.test(c[3]));

  // 5. MUST PRESERVE - the evidence-backed rows. Columns: # | Decision | Source | Status | Evidence | Verified by
  for (const l of (sectionAt(5) ?? []).filter(isRow)) {
    const c = cell(l);
    if (c.length < 4 || /^#$/.test(c[0]) || PLACEHOLDER.test(c[1] ?? '')) continue;
    rows.preserve++;
    const id = c[0]; const decision = c[1];
    const status = clean(c[3]).toLowerCase();
    const evidenceCell = clean(c[4]);
    const verified = clean(c[5]);
    const tag = `${C}|preserve:${id}`;
    const D = (cls, why, kind = null) => { drift.push({ row: id, decision, cls, why }); if (kind === 'hard') hard.push(`${tag}|${cls}: ${why}`); if (kind === 'soft') soft.push(`${tag}|${cls}: ${why}`); };

    if (!STATUSES.includes(status)) { D('MISSING', 'no status - a designed decision may be accounted for, never absent', 'hard'); continue; }
    if (status === 'unresolved') { D('UNKNOWN', 'unresolved - recorded is not resolved; implementation cannot proceed on it', 'hard'); continue; }
    if (status === 'changed') {
      if (authorised(decision)) D('MATERIAL DESIGN CHANGE', 'authorised - recorded in section 8 with an authoriser');
      else D('MATERIAL DESIGN CHANGE', 'changed with NO RECORDED AUTHORITY - a change nobody authorised is a substitution', 'hard');
      continue;
    }
    if (status === 'deferred' || status === 'blocked') {
      const owned = /owner:|@\w+|authorised by|accepted by/i.test(evidenceCell);
      if (owned) D('MISSING', `${status}, accounted for: ${evidenceCell}`);
      else D('MISSING', `${status} with no owner or authority named in Evidence - who decided?`, 'hard');
      continue;
    }
    // implemented
    if (!evidenceCell) { D('UNKNOWN', 'implemented with NO EVIDENCE - a claim is not an implementation', 'hard'); continue; }
    const [refsPart, variance] = evidenceCell.split(/\s*~\s*/, 2);
    const refs = refsPart.split(';').map((r) => r.trim()).filter(Boolean);
    const results = refs.map((r) => ({ r, ...resolveRef(r) }));
    const unknown = results.find((x) => x.ok === null);
    const failed = results.find((x) => x.ok === false);
    if (unknown) { D('UNKNOWN', `evidence cannot be evaluated: ${unknown.why}`, 'hard'); continue; }
    if (failed) { D('MISSING', `claimed implemented but ${failed.why}`, 'hard'); continue; }
    const manual = results.some((x) => x.manual);
    if (variance) {
      const area = variance.includes(':') ? variance.split(':')[0].trim().toLowerCase() : null;
      if (area && flexibility.includes(area)) D('IMPLEMENTATION DETAIL', `variance in a ceded area (${area}): ${variance}`);
      else D('MINOR VARIATION', `variance declared, area not ceded in section 6: ${variance}`, 'soft');
    } else {
      D('SAME', results.map((x) => x.why).join('; ') + (manual ? ' [manual]' : ''));
    }
    if (!verified) hard.push(`${tag}|NO VERIFICATION - name the spec, gate step or person that checked it (or "pending")`);
    else if (/^pending$/i.test(verified)) soft.push(`${tag}|UNVERIFIED - verification pending`);
    else if (/^spec:/.test(verified)) { const r = resolveRef(verified); if (!r.ok) hard.push(`${tag}|VERIFICATION DOES NOT RESOLVE: ${r.why}`); }
  }

  // 9. Unknown / unresolved / conflicting. Columns: Item | Kind | Sources | Owner | Precedence | Status
  for (const l of (sectionAt(9) ?? []).filter(isRow)) {
    const c = cell(l);
    if (c.length < 5 || /^item$/i.test(c[0]) || PLACEHOLDER.test(c[0])) continue;
    const kind = clean(c[1]).toUpperCase();
    const owner = clean(c[3]); const precedence = c.length >= 6 ? clean(c[4]) : ''; const status = clean(c[c.length - 1]).toLowerCase();
    if (!owner || PLACEHOLDER.test(owner)) hard.push(`${C}|unresolved:${c[0]}|NO OWNER - name who decides`);
    const resolved = /^resolved\b/.test(status);
    if (/CONFLICT|ASSERTION/.test(kind)) {
      if (resolved && !precedence) hard.push(`${C}|conflict:${c[0]}|RESOLVED WITHOUT PRECEDENCE - say which source wins and why (authority, scope, freshness, provenance)`);
      else if (!resolved) { hard.push(`${C}|conflict:${c[0]}|CONFLICTING - ${kind.toLowerCase()} not resolved: ${clean(c[2])}`); drift.push({ row: c[0], decision: c[0], cls: 'CONFLICTING', why: `${kind}: ${clean(c[2])}` }); }
      else drift.push({ row: c[0], decision: c[0], cls: 'SAME', why: `${kind} resolved - precedence: ${precedence}` });
    } else if (!resolved) {
      soft.push(`${C}|open:${c[0]}|${kind || 'UNKNOWN'} still open - owner ${owner}`);
    }
  }
}

/* ------------------------------------------------------------------ output */
const counts = {};
for (const d of drift) counts[d.cls] = (counts[d.cls] ?? 0) + 1;
const summary = () => {
  const order = ['SAME', 'IMPLEMENTATION DETAIL', 'MINOR VARIATION', 'MATERIAL DESIGN CHANGE', 'MISSING', 'UNKNOWN', 'CONFLICTING'];
  return order.map((k) => `${k} ${counts[k] ?? 0}`).join(' · ');
};

if (argv.includes('--report')) {
  if (!contractPresent) {
    console.log(`No design contract at ${rel(CONTRACT)}.`);
    console.log('Not a failure: most applications are not built from a supplied design.');
    console.log('If one WAS supplied, this is the finding - run scripts/design-ingest.mjs and write the contract.');
    process.exit(0);
  }
  console.log(`DRIFT  (${rows.preserve} MUST-PRESERVE row(s), app: ${rel(APP) || '.'}, src: ${rel(SRC) || '.'})`);
  for (const d of drift) console.log(`  ${d.row.padEnd(6)} ${d.cls.padEnd(23)} ${d.decision.slice(0, 40).padEnd(42)} ${d.why}`);
  console.log(`\n  ${summary()}`);
  if (hard.length) { console.log('\nBLOCKING (never baselined):'); hard.forEach((s) => console.log('  ' + s)); }
  if (soft.length) { console.log('\nRECORDED (ratcheted, visible):'); soft.forEach((s) => console.log('  ' + s)); }
  console.log(`\nVERDICT: ${hard.length ? 'BLOCK' : `PASS (${soft.length} soft finding(s))`}`);
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, soft, {
    name: 'DESIGN CONTRACT',
    regenerateCmd: CMD,
    note: 'SOFT findings only (minor variation, pending verification, open unknowns). HARD findings are never baselined.',
  });
  console.log(`wrote ${rel(BASELINE)} (${n} soft finding(s)); ${hard.length} HARD finding(s) were NOT baselined - they block regardless`);
  process.exit(0);
}

if (!contractPresent) {
  console.error(`check-design-contract: no contract at ${rel(CONTRACT)} - nothing to audit in this tree.`);
  process.exit(0);
}

if (hard.length) {
  console.error(`BLOCK [DESIGN CONTRACT] ${hard.length} hard finding(s) - these are never baselined:`);
  hard.forEach((s) => console.error('  ' + s));
  console.error(`  ${summary()}`);
  console.error('  implemented needs evidence that RESOLVES (file: route: testid: text: spec: manual:); unresolved is not resolved;');
  console.error('  changed needs an authoriser in section 8; a CONFLICT/ASSERTION in section 9 needs precedence and resolved.');
  process.exit(2);
}

process.exit(
  evaluateRatchet({
    name: 'DESIGN CONTRACT',
    signatures: soft,
    baselineFile: BASELINE,
    regenerateCmd: CMD,
    parsedSomething: true,
    remediation:
      'Soft findings only: a MINOR VARIATION declared with "~", a verification marked pending, an open UNKNOWN in section 9.\n'
      + '  Resolve them or accept them knowingly with --write-baseline. Hard findings never reach this line.',
  })
);
