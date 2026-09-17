#!/usr/bin/env node
/**
 * check-supabase-reads - every Supabase read in an application, classified by what happens when
 * the table grows. Gate step G14 (CP-34, docs/28).
 *
 * THE DEFECT THIS FINDS
 *   PostgREST answers an unbounded read with HTTP 200 and the first `max-rows` rows - 1,000 by
 *   default, project-wide, every table, view and set-returning RPC. No error reaches the client.
 *   A screen that did `.from('attendance').select('*')` and counted the rows was right for a
 *   year and then, on the day the table passed a thousand rows, told the owner that most of
 *   their members had stopped coming. Nothing in the code changed. It needs a gate because the
 *   code that breaks is code that already passed every test it will ever be given: the fixture
 *   never has a thousand rows.
 *
 * THE FOUR SANCTIONED SHAPES, and how each is recognised statically
 *   AGGREGATION   `{ count: 'exact', head: true }` · `.select('count')` / `count(` · `.single()`
 *                 · `.maybeSingle()` · an RPC whose name says it aggregates (count/total/sum/
 *                 summary/stats/exists/_agg)                                          -> SAFE
 *   BOUNDED       `.limit(n)` or `.range(a, b)` with the page BELOW the cap, and `.order(`
 *                 present                                                            -> SAFE
 *   KEYSET        the read is the `fetchPage` of `pageAllByKey(` / `readBounded(` (same
 *                 statement or the six lines above)                                 -> SAFE
 *   FILTER-BOUND  an explicit, AUTHORISED annotation on the line above:
 *                   // SUPABASE-BOUND: <constraint> | max <N> rows | <who> <date>
 *                 A filter alone is NOT a bound - `academy_id = X` is unbounded if one academy
 *                 can have 1,500 members. The annotation is the business constraint, written
 *                 down, with a name on it. N below the warn threshold -> SAFE-BY-FILTER; N at or
 *                 above it -> BREAKS SOON (recorded, ratcheted); N at or above the cap ->
 *                 BROKEN NOW (hard).
 *   Anything else is an UNBOUNDED read: max rows UNKNOWN, and UNKNOWN is a HARD finding. The
 *   tool cannot prove it safe, and the standard says never assume.
 *
 * PROHIBITED PATTERNS, each a hard finding
 *   - offset traversal: `.range(` or `.offset(` inside a loop, or driven by a page/offset variable
 *   - short-page termination: `.length < pageSize` / `< PAGE_SIZE` / `!== pageSize` as a loop exit
 *   - estimated count as completeness: `count: 'estimated'` or `count: 'planned'`
 *   - Content-Range `/*` read as truncation evidence
 *   - N+1: a read inside `for (... of` / `.map(async` / `Promise.all(` over rows
 *   - raising the cap: `db-max-rows` / `max-rows` / `max_rows` set anywhere in the tree
 *   - a `.from(`/`.rpc(` outside the data layer (configurable, see below)
 *
 * WHAT IT CANNOT SEE - a FLOOR, stated
 *   It is a regex over source, not a type checker. A query built across several statements, or
 *   through a wrapper the app wrote, is invisible. A bound applied by a helper it does not know
 *   the name of is reported UNBOUNDED - annotate it, or name the helper in .supabase-safety.json.
 *   Write paths (`.insert/.update/.delete/.upsert`) are not classified; the standard is about reads.
 *
 * CONFIGURATION  - .supabase-safety.json at the app root, all optional:
 *   { "cap": 1000, "warnAt": 0.7, "dataLayer": ["src/lib/data/**", "api/**", "supabase/functions/**"],
 *     "keysetHelpers": ["pageAllByKey", "readBounded"] }
 *   Or flags: --cap 1000 --warn-at 0.7 --data-layer "a/**,b/**"
 *
 * USAGE
 *   node scripts/audits/check-supabase-reads.mjs [--dir <app>] [--report | --write-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateRatchet, writeBaseline, walk } from '../lib/ratchet.mjs';
import { appPath } from '../lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = process.cwd();
const APP = path.resolve(ROOT, arg('--dir', appPath(ROOT, '.')));
const BASELINE = path.resolve(ROOT, arg('--baseline', path.join(APP, '.baselines/supabase-reads-baseline.txt')));
const CMD = 'node scripts/audits/check-supabase-reads.mjs --write-baseline';

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(APP, '.supabase-safety.json'), 'utf8')); } catch { /* defaults */ }
const CAP = Number(arg('--cap', cfg.cap ?? 1000));
const WARN_AT = Number(arg('--warn-at', cfg.warnAt ?? 0.7));
const DATA_LAYER = String(arg('--data-layer', (cfg.dataLayer ?? ['src/lib/data/**', 'api/**', 'supabase/functions/**']).join(','))).split(',').map((s) => s.trim()).filter(Boolean);
const HELPERS = cfg.keysetHelpers ?? ['pageAllByKey', 'readBounded'];

const rel = (p) => path.relative(APP, p).replace(/\\/g, '/');
const globToRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
const inDataLayer = (r) => DATA_LAYER.some((g) => globToRe(g).test(r) || globToRe(g.replace(/\/\*\*$/, '')).test(r.split('/').slice(0, -1).join('/')));

const NOT_A_QUERY_OBJECT = /^(Array|Buffer|Object|Promise|Uint8Array|Int8Array|Uint16Array|Int32Array|Float32Array|Float64Array|Set|Map|String|Date|BigInt|Number|Symbol|ArrayBuffer|Blob|File|Readable|Duplex|Writable|Observable|z|yup|Joi)$/;
const READ_RE = /(?:^|[^\w$])([\w$.]+)\.(from|rpc)\(\s*(['"`][^'"`]+['"`]|[\w$.]+)/g;
const AGG_RPC = /(count|total|sum|summary|stats|exists|_agg|aggregate)/i;

const files = walk(APP, { exts: ['.ts', '.tsx', '.js', '.jsx', '.mjs'] })
  .filter((f) => !/\.(test|spec)\./.test(f) && !/[\\/]supabase-safety\.ts$/.test(f) && !/[\\/]\.baselines[\\/]/.test(f));

const hard = [];
const soft = [];
const reads = [];
let capRaised = null;

// The prohibited fix is typed into config, not code: supabase/config.toml `max-rows`, an env
// file, a deploy manifest. Those are not in the source walk above, so they get their own.
for (const f of walk(APP, { exts: ['.toml', '.env', '.yaml', '.yml'] }).concat(walk(APP, { exts: ['.local', '.example', '.test', '.production'] }).filter((p) => /[\\/]\.env/.test(p)))) {
  let s = ''; try { s = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const m = s.match(/(db[-_]max[-_]rows|max[-_]rows)\s*[:=]\s*["']?(\d{3,})/i);
  if (m && Number(m[2]) > CAP) capRaised = { file: rel(f), line: s.slice(0, m.index).split('\n').length, value: m[2] };
}

/** The statement the match sits in: from the match to the terminating `;`, capped. */
function statementFrom(src, idx) {
  let depth = 0; let i = idx;
  for (; i < src.length && i - idx < 1200; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth <= 0) break;
    else if (c === '\n' && depth <= 0 && /^\s*(\n|const |let |var |return |if |for |while |export |}|\/\/)/.test(src.slice(i, i + 12))) break;
  }
  return src.slice(idx, i);
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const r = rel(file);
  const lines = src.split('\n');
  const lineOf = (i) => src.slice(0, i).split('\n').length;

  // Raising the cap is the prohibited fix, wherever it is typed.
  const raised = src.match(/(db[-_]max[-_]rows|max[-_]rows)\s*[:=]\s*["']?(\d{3,})/i);
  if (raised && Number(raised[2]) > CAP) capRaised = { file: r, line: lineOf(raised.index), value: raised[2] };

  for (const m of src.matchAll(READ_RE)) {
    const [, receiver, verb, target] = m;
    const objName = receiver.split('.').pop();
    if (NOT_A_QUERY_OBJECT.test(objName) || NOT_A_QUERY_OBJECT.test(receiver)) continue;
    const at = lineOf(m.index + 1);
    const stmt = statementFrom(src, m.index);
    const before = lines.slice(Math.max(0, at - 8), at - 1).join('\n');
    const above2 = lines.slice(Math.max(0, at - 3), at - 1).join('\n');
    // A `.from(` is a Supabase read only when the chain continues into a query verb. This is the
    // same shape rule the ESLint boundary uses: `status.from('active')` (a label lookup) and
    // `Array.from(xs)` have no `.select(` after them, and are not reads. `.rpc(` needs no verb.
    if (verb === 'from' && !/\.(select|insert|update|upsert|delete)\(/.test(stmt)) continue;
    const isWrite = /\.(insert|update|delete|upsert)\(/.test(stmt) && !/\.select\(/.test(stmt);
    if (isWrite) continue;

    const table = target.replace(/^['"`]|['"`]$/g, '');
    const filter = (stmt.match(/\.(eq|neq|in|gt|gte|lt|lte|like|ilike|is|contains|match|or|filter|textSearch)\(([^)]*)\)/g) ?? []).join(' ').slice(0, 80) || '-';
    const limitN = Number((stmt.match(/\.limit\(\s*(\d+)/) ?? [])[1]);
    const range = stmt.match(/\.range\(\s*(\d+)\s*,\s*(\d+)/);
    const rangeN = range ? Number(range[2]) - Number(range[1]) + 1 : NaN;
    const ordered = /\.order\(/.test(stmt);
    const inLoop = /\b(for|while|do)\b/.test(before) && /\.(range|offset)\(/.test(stmt);
    const offsetVar = /\.(range|offset)\(\s*[\w$]+\s*[*+]/.test(stmt) || /\.range\(\s*(offset|page|skip|start)\b/i.test(stmt);
    // `.length < pageSize`, or `.length < 100` where 100 is the literal page size - a literal
    // under 10 is an ordinary emptiness/small-set check and is left alone.
    const shortPage = /\.length\s*(<|!==|!=)\s*(pageSize|PAGE_SIZE|limit|LIMIT|size|batch|\d{2,})/i.test(stmt + '\n' + lines.slice(at, at + 12).join('\n'));
    const estimated = /count:\s*['"](estimated|planned)['"]/.test(stmt);
    const contentRange = /content-range/i.test(stmt + before) && /\/\\?\*/.test(stmt + before);
    const nPlusOne = /\b(for\s*\(\s*(const|let|var)\s+[\w$]+\s+of\b|\.map\(\s*async|Promise\.all\(|\.forEach\(\s*async)/.test(before) && verb === 'from' && !/\.limit\(|\.single\(|\.maybeSingle\(|head:\s*true/.test(stmt);
    // The helper call may sit on the same line, BEFORE the `.from(` - `pageAllByKey({ ..., fetchPage:
    // (a, n) => supabase.from(...)` - so the current line is included, not only the lines above.
    const keyset = HELPERS.some((h) => (stmt + '\n' + before + '\n' + (lines[at - 1] ?? '')).includes(h + '('));
    const aggregation = /head:\s*true|count:\s*['"]exact['"]|\.select\(\s*['"`]count|\bcount\(|\.single\(\)|\.maybeSingle\(\)/.test(stmt) || (verb === 'rpc' && AGG_RPC.test(table));
    const bounded = (limitN > 0 && limitN < CAP) || (rangeN > 0 && rangeN < CAP);
    const ann = above2.match(/SUPABASE-BOUND:\s*([^|]+)\|\s*max\s*(\d+)\s*rows?\s*\|\s*(.+)$/im);
    const annN = ann ? Number(ann[2]) : NaN;
    const outsideLayer = !inDataLayer(r);

    let shape, pagination, risk, remedy, maxRows = 'unknown', kind = null;
    if (aggregation) { shape = 'aggregation'; pagination = 'n/a'; risk = 'SAFE'; maxRows = '1'; remedy = '-'; }
    else if (keyset) { shape = 'keyset'; pagination = 'keyset-to-completion'; risk = 'SAFE'; maxRows = 'unbounded, paged'; remedy = '-'; }
    else if (bounded && ordered) { shape = 'bounded'; pagination = `page ${limitN || rangeN}`; risk = 'SAFE'; maxRows = String(limitN || rangeN); remedy = '-'; }
    else if (bounded && !ordered) { shape = 'bounded, NO ORDER'; pagination = `page ${limitN || rangeN}`; risk = 'UNKNOWN'; maxRows = String(limitN || rangeN); remedy = 'add a deterministic .order() - a page without an order is a different page each time'; kind = 'hard'; }
    else if (ann) {
      shape = 'filter-bound (annotated)'; pagination = 'none'; maxRows = String(annN);
      if (annN >= CAP) { risk = 'BROKEN NOW'; remedy = `declared max ${annN} rows reaches the cap of ${CAP}: aggregate, bound, or page by key`; kind = 'hard'; }
      else if (annN >= CAP * WARN_AT) { risk = 'BREAKS SOON'; remedy = `declared max ${annN} rows is at ${Math.round(100 * annN / CAP)}% of the cap - plan the bounded or keyset shape now`; kind = 'soft'; }
      else { risk = 'SAFE-BY-FILTER'; remedy = `authorised: ${ann[3].trim()}`; }
    }
    else { shape = 'unbounded'; pagination = 'none'; risk = 'UNKNOWN'; remedy = 'no bound, no aggregation, no keyset helper, no SUPABASE-BOUND annotation: the first ' + CAP + ' rows will be returned as if complete'; kind = 'hard'; }

    const flags = [];
    if (inLoop || offsetVar) flags.push('OFFSET TRAVERSAL');
    if (shortPage) flags.push('SHORT-PAGE TERMINATION');
    if (estimated) flags.push('ESTIMATED COUNT AS COMPLETENESS');
    if (contentRange) flags.push('CONTENT-RANGE READ AS TRUNCATION EVIDENCE');
    if (nPlusOne) flags.push('N+1 READ IN A LOOP');
    if (outsideLayer) flags.push('OUTSIDE DATA LAYER');
    if (flags.length) { kind = 'hard'; if (risk === 'SAFE' || risk === 'SAFE-BY-FILTER') risk = 'UNKNOWN'; remedy = flags.join('; ') + (remedy === '-' ? '' : ' - ' + remedy); }

    const rec = { file: r, line: at, verb, table, filter, maxRows, shape, pagination, aggregation: aggregation ? 'yes' : 'no', risk, remedy, flags };
    reads.push(rec);
    const sig = `${r}|${at}|${verb}:${table}|${risk}${flags.length ? '|' + flags.join('+') : ''}`;
    if (kind === 'hard') hard.push(sig); else if (kind === 'soft') soft.push(sig);
  }
}
if (capRaised) hard.push(`${capRaised.file}|${capRaised.line}|CAP RAISED to ${capRaised.value} - raising max-rows is the prohibited fix; it moves the cliff, it does not remove it`);

const counts = {};
for (const x of reads) counts[x.risk] = (counts[x.risk] ?? 0) + 1;
const summary = ['BROKEN NOW', 'BREAKS SOON', 'SAFE-BY-FILTER', 'SAFE', 'UNKNOWN'].map((k) => `${k} ${counts[k] ?? 0}`).join(' · ');

if (argv.includes('--report')) {
  console.log(`SUPABASE READS  (${reads.length} read(s) in ${files.length} file(s); cap ${CAP}, warn at ${Math.round(WARN_AT * 100)}%; data layer: ${DATA_LAYER.join(', ')})\n`);
  for (const x of reads) {
    console.log(`  ${x.risk.padEnd(15)} ${x.file}:${x.line}  ${x.verb}(${x.table})`);
    console.log(`                  filter: ${x.filter} · max rows: ${x.maxRows} · shape: ${x.shape} · pagination: ${x.pagination} · aggregation: ${x.aggregation}`);
    console.log(`                  -> ${x.remedy}`);
  }
  if (capRaised) console.log(`\n  CAP RAISED  ${capRaised.file}:${capRaised.line} sets max-rows to ${capRaised.value}`);
  console.log(`\n  ${summary}`);
  if (reads.length === 0) console.log('  NOTE: no Supabase reads were found - this run could not have failed. If the app reads through a wrapper, name it in .supabase-safety.json keysetHelpers.');
  if (hard.length) { console.log('\nBLOCKING (never baselined):'); hard.forEach((s) => console.log('  ' + s)); }
  if (soft.length) { console.log('\nRECORDED (early warning, ratcheted):'); soft.forEach((s) => console.log('  ' + s)); }
  console.log(`\nVERDICT: ${hard.length ? 'BLOCK' : `PASS (${soft.length} early warning(s))`}`);
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, soft, { name: 'SUPABASE READS', regenerateCmd: CMD, note: 'SOFT findings only (BREAKS SOON early warnings). HARD findings are never baselined: an unbounded read is unsafe today, not tolerated debt.' });
  console.log(`wrote ${path.relative(ROOT, BASELINE)} (${n} early warning(s)); ${hard.length} HARD finding(s) were NOT baselined`);
  process.exit(0);
}

if (reads.length === 0) console.error(`check-supabase-reads: no Supabase reads found in ${files.length} file(s) under ${rel(APP) || '.'} - nothing to classify.`);

if (hard.length) {
  console.error(`BLOCK [SUPABASE READS] ${hard.length} unsafe read(s) - these are never baselined:`);
  hard.forEach((s) => console.error('  ' + s));
  console.error(`  ${summary}`);
  console.error('  Aggregate in the database, bound the list below the cap with an order, or page by key with the');
  console.error('  approved helper (src/lib/supabase-safety.ts). A filter is a bound only when a SUPABASE-BOUND');
  console.error('  annotation states the constraint, the maximum rows, and who authorised it (CP-34, docs/28).');
  process.exit(2);
}

process.exit(evaluateRatchet({
  name: 'SUPABASE READS', signatures: soft, baselineFile: BASELINE, regenerateCmd: CMD,
  parsedSomething: files.length > 0,
  remediation: 'Early warnings only: reads whose declared maximum is within the warn threshold of the cap. Plan the bounded or keyset shape before the table gets there.',
}));
