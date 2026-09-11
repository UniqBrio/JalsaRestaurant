#!/usr/bin/env node
/**
 * upgrade - move an app to a newer framework version. PLAN FIRST, always.
 *
 * USAGE (run from the APP root)
 *   node <framework>/scripts/upgrade.mjs                    show the plan (default: dry run)
 *   node <framework>/scripts/upgrade.mjs --apply            apply it
 *   node <framework>/scripts/upgrade.mjs --framework <path>
 *
 * THE THREE-WAY RULE (the whole contract, from EVOLUTION_PLAN.md WS3)
 *   pristine            -> auto-update. The app never touched it; the framework owns it.
 *   modified            -> NEVER overwrite. A .framework/incoming/<file> copy is written beside
 *                          the app's version, listed for human review. The human merges and
 *                          then re-records the file (lineage refresh) - or discards the incoming.
 *   expected-divergent  -> skipped silently. Mentioning it is noise, and noise is how upgrade
 *                          reports stop being read.
 *
 * SAFETY
 *   --apply refuses a dirty git tree: an upgrade must be ONE clean, revertable commit.
 *   Every apply appends to FRAMEWORK_ADOPTION.md - version, date, applied, deferred and why.
 *   New gates arrive BASELINED at the app's current state (demand no-worse, not clean), via
 *   each audit's own --write-baseline. The build stays green on day one.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { readLineage, writeLineage, statusOf, sha, walkFiles, isExpectedDivergent, frameworkVersion, HALF_A } from './lib/lineage.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APPLY = argv.includes('--apply');
const APP = process.cwd();
const FRAMEWORK = path.resolve(arg('--framework', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
const SEED = path.join(FRAMEWORK, 'starter');

const lineage = readLineage(APP);
if (!lineage) {
  console.error('No .framework/lineage.json here. Run lineage.mjs --init first (from the app root).');
  process.exit(2);
}
const fromV = lineage.frameworkVersion;
const toV = frameworkVersion(FRAMEWORK);

/* ---- build the plan ---- */
const live = new Map(statusOf(APP, lineage).map((r) => [r.rel, r.status]));
const seedFiles = walkFiles(SEED).filter((rel) => !rel.startsWith('.baselines/'));

/**
 * An app ADOPTED through `lineage --init` never received the seed. Its layout - often its whole
 * stack - differs, so every seed file it lacks reads as "new", and auto-applying them empties the
 * starter into a project that cannot use it: 31 TypeScript files into a JavaScript app, and a
 * playwright.config.ts landing beside a working playwright.config.js, breaking the test harness.
 *
 * A SCAFFOLDED app is the opposite case - it asked for the seed, so a genuinely new file is a
 * gift, not a collision, and auto-applying is right.
 *
 * So an adopted app gets the same rule a modified file already gets: offer it, let a human
 * decide, never overwrite. Reported separately from `review` because the reason differs, and a
 * report that says "you modified this" about a file the app has never had is simply untrue.
 */
const ADOPTED = lineage.initMode === 'adopted-existing-app';

const plan = { auto: [], review: [], skipped: [], newFiles: [], offered: [], unchanged: [], deletedInApp: [] };
for (const rel of seedFiles) {
  const seedHash = sha(path.join(SEED, rel));
  const rec = lineage.files[rel];
  if (!rec) {
    // New in this framework version. An expected-divergent path is seeded only at scaffold -
    // pushing a new tokens.json into an existing app would be vandalism.
    if (isExpectedDivergent(rel)) { plan.skipped.push(rel); continue; }
    (ADOPTED ? plan.offered : plan.newFiles).push(rel);
    continue;
  }
  const status = live.get(rel);
  if (status === 'expected-divergent') { plan.skipped.push(rel); continue; }
  if (status === 'declined') { plan.skipped.push(rel); continue; } // offered once, refused; never again
  if (status === 'deleted') { plan.deletedInApp.push(rel); continue; } // the app's right; respect it
  if (seedHash === rec.hash) { plan.unchanged.push(rel); continue; }   // framework did not change it
  if (status === 'pristine') plan.auto.push(rel);
  else plan.review.push(rel);
}

/* ---- HALF A: the process half ----
 * The scaffolder promises that a standalone app's copied process half is "replaced WHOLESALE on
 * upgrade" - and that code did not exist. Half A is not in the lineage (only the seed is), and
 * nothing here ever looked at it, so a standalone app could never receive a fixed guard, a new
 * gate or an improved workflow: exactly the "framework improvements must be adoptable by old
 * apps" requirement, silently unmet.
 *
 * Wholesale means OVERWRITE, never DELETE. An app's registers and module docs sit under Half A
 * paths (docs/registers/, docs/modules/) but belong to the app - clearing the directory would
 * erase the decisions those registers exist to preserve. Expected-divergent paths are skipped
 * for exactly that reason.
 */
const halfAMode = lineage.mode
  ?? (fs.existsSync(path.join(APP, '.framework-link.json')) ? 'workspace'
    : fs.existsSync(path.join(APP, 'scripts', 'audits')) ? 'standalone' : 'workspace');
// A workspace app LINKS the process half, so only .claude/ moves - it must physically exist for
// Claude Code to read it from the project root.
const halfADirs = halfAMode === 'standalone' ? HALF_A : ['.claude'];
const halfA = [];
for (const dir of halfADirs) {
  const from = path.join(FRAMEWORK, dir);
  if (!fs.existsSync(from)) continue;
  for (const rel of walkFiles(from)) {
    const appRel = `${dir}/${rel}`;
    if (isExpectedDivergent(appRel)) continue;
    const src = path.join(from, rel);
    const dest = path.join(APP, appRel);
    if (!fs.existsSync(dest) || sha(dest) !== sha(src)) halfA.push({ appRel, src, dest });
  }
}

/* ---- read UPGRADES.md between the two versions ---- */
function upgradeNotes() {
  const f = path.join(FRAMEWORK, 'UPGRADES.md');
  if (!fs.existsSync(f)) return '(no UPGRADES.md found)';
  const text = fs.readFileSync(f, 'utf8');
  const sections = text.split(/^## /m).slice(1);
  const relevant = [];
  let reached = false;
  for (const s of sections) {
    const ver = s.split(/\s/)[0];
    if (ver === fromV) { reached = true; break; }
    relevant.push('## ' + s.trim());
  }
  if (!reached && relevant.length === sections.length) {
    relevant.push(`(warning: version ${fromV} not found in UPGRADES.md - showing all entries)`);
  }
  return relevant.join('\n\n') || '(already current)';
}

/* ---- print the plan ---- */
console.log(`\nUPGRADE PLAN  ${path.basename(APP)} : ${fromV} -> ${toV}\n`);
if (fromV === toV && plan.auto.length === 0 && plan.newFiles.length === 0 && plan.review.length === 0
  && plan.offered.length === 0 && halfA.length === 0) {
  console.log('Already current. Nothing to do.');
  process.exit(0);
}
const list = (label, arr, mark) => {
  if (!arr.length) return;
  console.log(`${label} (${arr.length})`);
  arr.slice(0, 30).forEach((r) => console.log(`  ${mark} ${r}`));
  if (arr.length > 30) console.log(`  ... and ${arr.length - 30} more`);
  console.log('');
};
list('Auto-apply - pristine, framework changed them', plan.auto, '+');
list('New files from the framework', plan.newFiles, '+');
list('REVIEW REQUIRED - you modified these AND the framework changed them', plan.review, '!');
if (plan.review.length) {
  console.log('  For each: the incoming version lands at .framework/incoming/<path>; your file is');
  console.log('  untouched. Merge by hand, then: node <framework>/scripts/lineage.mjs --refresh <path>\n');
}
list('OFFERED - your app does not have these; nothing is copied into an adopted app', plan.offered, '?');
if (plan.offered.length) {
  console.log('  This app was ADOPTED, not scaffolded, so a seed file it lacks is an offer, not an');
  console.log('  update. Copies land in .framework/incoming/<path> for you to take what fits.');
  console.log('  Take one:     cp .framework/incoming/<path> <path>   then lineage.mjs --refresh <path>');
  console.log('  Refuse one:   node <framework>/scripts/lineage.mjs --decline <path>\n');
}
list('Deleted in this app - respected, not re-added', plan.deletedInApp, '-');
console.log(halfAMode === 'standalone'
  ? `Half A (process, copied): ${halfA.length} file(s) to refresh wholesale - apps never edit these.`
  : `Half A (process): linked - already current. ${halfA.length} .claude file(s) to refresh.`);
console.log('');
console.log(`Skipped (divergent by design): ${plan.skipped.length}    Unchanged: ${plan.unchanged.length}\n`);
console.log('From UPGRADES.md since your version:');
console.log(upgradeNotes().split('\n').map((l) => '  ' + l).join('\n'));

if (!APPLY) {
  console.log('\nNothing has been changed. Re-run with --apply to proceed.');
  process.exit(0);
}

/* ---- apply ---- */
try {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: APP, encoding: 'utf8' }).trim();
  if (dirty) {
    console.error('\nBLOCKED: the git tree is dirty. An upgrade must be ONE clean, revertable commit.');
    console.error('Commit or stash your work first.');
    process.exit(2);
  }
} catch {
  console.error('\nBLOCKED: not a git repository (or git unavailable). An unrevertable upgrade is a gamble, not an upgrade.');
  process.exit(2);
}

const copy = (rel) => {
  const dest = path.join(APP, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(SEED, rel), dest);
  lineage.files[rel] = { hash: sha(dest), status: isExpectedDivergent(rel) ? 'expected-divergent' : 'pristine' };
};
for (const rel of [...plan.auto, ...plan.newFiles]) copy(rel);

for (const { appRel, src, dest } of halfA) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const rel of [...plan.review, ...plan.offered]) {
  const incoming = path.join(APP, '.framework', 'incoming', rel);
  fs.mkdirSync(path.dirname(incoming), { recursive: true });
  fs.copyFileSync(path.join(SEED, rel), incoming);
  // The recorded hash is NOT refreshed: until the human merges, the file stays "modified"
  // against the OLD seed, which is the truth. An OFFERED file is not recorded at all - it is
  // not part of the app until someone takes it or declines it.
}

lineage.frameworkVersion = toV;
writeLineage(APP, lineage);

/* Baseline any NEW gates at the app's current state - green on day one, no worse from here. */
// A workspace app has no scripts/ of its own - the process half is linked - so the audits that
// need baselining live in the FRAMEWORK. Looking only inside the app meant the DEFAULT scaffold
// mode baselined nothing at all, and WS3.3's promise ("a new gate arrives baselined, the build
// stays green on day one") quietly did not apply to it. The audits run with the APP as cwd
// either way, which is what makes them measure the app.
const auditsDir = fs.existsSync(path.join(APP, 'scripts', 'audits'))
  ? path.join(APP, 'scripts', 'audits')
  : path.join(FRAMEWORK, 'scripts', 'audits');
// check-backward-compat validates the FRAMEWORK against its fixtures, not the app. Probing it
// here would run the whole conformance suite on every upgrade and baseline nothing.
const NOT_APP_RATCHETS = new Set(['check-backward-compat.mjs']);
const baselined = [];
if (fs.existsSync(auditsDir)) {
  for (const f of fs.readdirSync(auditsDir).filter((x) => x.endsWith('.mjs') && !NOT_APP_RATCHETS.has(x))) {
    const probe = spawnSync(process.execPath, [path.join(auditsDir, f)], { cwd: APP, encoding: 'utf8' });
    if (/no baseline at/i.test(`${probe.stdout}${probe.stderr}`)) {
      const w = spawnSync(process.execPath, [path.join(auditsDir, f), '--write-baseline'], { cwd: APP, encoding: 'utf8' });
      if (w.status === 0) baselined.push(f);
    }
  }
}

/* Append the adoption log - version, date, applied, deferred AND WHY. */
const adoption = path.join(APP, 'FRAMEWORK_ADOPTION.md');
const entry = [
  `## ${toV} — adopted ${new Date().toISOString().slice(0, 10)} (from ${fromV})`,
  '',
  `- Auto-applied: ${plan.auto.length + plan.newFiles.length} seed file(s)`,
  `- Half A (process, ${halfAMode}): ${halfA.length} file(s) refreshed`,
  plan.review.length
    ? `- **Deferred pending merge (${plan.review.length})** — incoming copies in \`.framework/incoming/\`:\n${plan.review.map((r) => `  - \`${r}\``).join('\n')}`
    : '- Deferred: none',
  plan.offered.length
    ? `- **Offered, not applied (${plan.offered.length})** — this app was adopted, not scaffolded; take or \`--decline\` each one.`
    : '- Offered: none',
  baselined.length ? `- New gates baselined at current state: ${baselined.join(', ')}` : '- New gates: none',
  '- Post-upgrade gate: run `npm run gate` — the upgrade is done when the gate gives a verdict, not when files land.',
  '', '---', '',
].join('\n');
fs.writeFileSync(adoption, (fs.existsSync(adoption) ? fs.readFileSync(adoption, 'utf8') : '# Framework Adoption Log\n\n_Newest first. The "deferred and why" column is the whole point: an app stuck on an old version with nobody remembering why is the failure this file prevents._\n\n---\n\n')
  .replace(/---\n\n/, `---\n\n${entry}`), 'utf8');

console.log(`\nApplied. ${plan.auto.length + plan.newFiles.length} seed file(s) updated, ${halfA.length} process file(s) refreshed, ${plan.review.length + plan.offered.length} awaiting your decision.`);
console.log('Adoption log updated. Now run the gate: npm run gate');
console.log('Commit everything as one revertable commit.');
process.exit(0);
