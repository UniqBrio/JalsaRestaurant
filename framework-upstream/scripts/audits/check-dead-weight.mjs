#!/usr/bin/env node
/**
 * check-dead-weight - which one-off scripts is nothing referring to any more?
 *
 * WHY
 *   Every change leaves residue: the migration script that ran once, the module something
 *   superseded, the helper nothing imports. Left alone, the codebase grows a second copy of
 *   everything and the next reader cannot tell which one is live.
 *
 * TWO DISCIPLINES THAT MAKE IT HONEST
 *
 *   1. It EXCLUDES ITS OWN BASELINE from the reference index. The baseline lists every orphan
 *      by path, so once committed it makes all of them look referenced — and on the second run
 *      the audit cheerfully reports that the entire list is no longer orphaned.
 *      *A detector must never read its own output as evidence.*
 *
 *   2. REFERENCED is not the same as USED. Some scripts are run by hand and appear in no
 *      tracked file. So this produces a **review candidate list, never a delete list**, and
 *      each baseline entry carries a human reason.
 *
 * OUT OF SCOPE ON PURPOSE
 *   Application source. Dynamic imports and file-based routing would make a reference scan
 *   produce confident nonsense there, and a detector that is confidently wrong is worse than
 *   one that declines.
 *
 * USAGE  node scripts/audits/check-dead-weight.mjs [--dirs scripts] [--report|--write-baseline]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evaluateRatchet, writeBaseline, walk } from '../lib/ratchet.mjs';
import { appPath } from '../lib/layout.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = process.cwd();
const DIRS = arg('--dirs', 'scripts').split(',').map((d) => path.resolve(ROOT, d.trim()));
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/dead-weight-baseline.txt')));
const CMD = 'node scripts/audits/check-dead-weight.mjs --write-baseline';

const audited = DIRS.flatMap((d) => walk(d, { exts: ['.mjs', '.js', '.sh', '.py', '.ts'] }));

/* Build the reference index from everything OUTSIDE the audited directories - and outside the
 * baseline. See discipline 1 above. */
const indexRoots = ['docs', 'workflows', 'checklists', 'templates', 'ci',
  appPath(ROOT, 'src'), appPath(ROOT, 'tests'), appPath(ROOT, 'supabase'), appPath(ROOT, 'api')]
  .map((d) => path.resolve(ROOT, d))
  .filter((d) => fs.existsSync(d));

let index = '';
for (const rootDir of indexRoots) {
  for (const f of walk(rootDir, { exts: ['.md', '.ts', '.tsx', '.mjs', '.js', '.json', '.yml', '.sh'] })) {
    if (path.resolve(f) === path.resolve(BASELINE)) continue;
    index += fs.readFileSync(f, 'utf8');
  }
}
for (const f of ['package.json', 'README.md', 'FRAMEWORK_MANIFEST.md', appPath(ROOT, 'package.json')]) {
  const p = path.resolve(ROOT, f);
  if (fs.existsSync(p)) index += fs.readFileSync(p, 'utf8');
}
// A script referenced by another audited script is referenced. Include them, minus each file itself.
const auditedSources = new Map(audited.map((f) => [f, fs.readFileSync(f, 'utf8')]));

const signatures = [];
for (const file of audited) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const base = path.basename(file);
  const peers = [...auditedSources.entries()].filter(([f]) => f !== file).map(([, s]) => s).join('\n');
  if (!index.includes(base) && !peers.includes(base)) signatures.push(rel);
}

if (argv.includes('--report')) {
  signatures.length
    ? signatures.forEach((s) => console.log(`UNREFERENCED  ${s}`))
    : console.log('Every audited script is referenced somewhere.');
  console.log(`\n${audited.length} script(s) audited, ${signatures.length} unreferenced.`);
  console.log('REVIEW candidates, not a delete list: a hand-run script appears in no tracked file.');
  process.exit(0);
}

if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, signatures, {
    name: 'DEAD WEIGHT',
    regenerateCmd: CMD,
    note: 'REVIEW candidates, never a delete list. Add a reason beside any entry you keep deliberately.',
  });
  console.log(`wrote ${path.relative(ROOT, BASELINE)} (${n} unreferenced)`);
  process.exit(0);
}

process.exit(
  evaluateRatchet({
    name: 'DEAD WEIGHT',
    signatures,
    baselineFile: BASELINE,
    regenerateCmd: CMD,
    parsedSomething: audited.length > 0,
    remediation:
      'Either delete the script (a change deletes what it finished with), or reference it from\n' +
      '  package.json, CI, or the manifest so the next reader can tell it is live.',
  })
);
