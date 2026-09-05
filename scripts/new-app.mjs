#!/usr/bin/env node
/**
 * new-app - scaffold a new application from the starter, with its own identity.
 *
 * Deliberately small. A scaffolder that generates a thousand files produces a project nobody
 * understands and everybody is afraid to delete from. This copies the starter, renames it,
 * regenerates the theme, and prints the checklist. The rest is your first feature.
 *
 * USAGE  node scripts/new-app.mjs --name my-app [--dir ../my-app]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const NAME = arg('--name');
if (!NAME || !/^[a-z0-9][a-z0-9-]*$/.test(NAME)) {
  console.error('Usage: node scripts/new-app.mjs --name <kebab-case-name> [--dir <path>]');
  process.exit(1);
}
const ROOT = process.cwd();
const SRC = path.resolve(ROOT, 'starter');
const DEST = path.resolve(ROOT, arg('--dir', `../${NAME}`));

if (fs.existsSync(DEST) && fs.readdirSync(DEST).length) {
  console.error(`Refusing to scaffold into a non-empty directory: ${DEST}`);
  process.exit(1);
}

const SKIP = new Set(['node_modules', '.next', 'dist', 'test-results', 'playwright-report', '.gate-logs']);
function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    e.isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
}
copy(SRC, DEST);

// HALF A - THE PROCESS (EVOLUTION_PLAN.md decision 1).
//
// Workspace mode (default): the process is LINKED, never copied. One copy of the process
// exists, in the framework; every app sees improvements the moment they land, and no app can
// fork a workflow by editing its private copy - because it has none.
//
// --standalone (client apps): the old behaviour - everything is copied, so the client sees a
// clean, self-contained repo. The copy is recorded in lineage as version-pinned Half A, and
// upgrade.mjs replaces it WHOLESALE on upgrade (apps never edit process files, so there is
// nothing to merge).
const STANDALONE = argv.includes('--standalone');
const { HALF_A } = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/lineage.mjs')).href);

if (STANDALONE) {
  for (const dir of HALF_A) copy(path.resolve(ROOT, dir), path.join(DEST, dir));
} else {
  // Link, do not copy. A pointer file plus thin wrapper npm scripts keep every command working
  // from inside the app while the single source of truth stays in the framework.
  const relFw = path.relative(DEST, ROOT).replace(/\\/g, '/');
  fs.writeFileSync(path.join(DEST, '.framework-link.json'), JSON.stringify({
    comment: 'HALF A (process) is LINKED from the framework, not copied. Workflows, checklists, docs, scripts and .claude live there. Editing a process file per-app is forbidden by design - the urge to do so is the signal to run /promote.',
    framework: relFw,
    halfA: HALF_A,
  }, null, 2) + '\n', 'utf8');
  // .claude/ is the one Half-A piece that MUST physically exist in the app (Claude Code reads
  // it from the project root). Copy it, but mark it linked-managed in lineage: upgrades replace
  // it wholesale, and editing it per-app is as forbidden as any process file.
  copy(path.resolve(ROOT, '.claude'), path.join(DEST, '.claude'));
}

const pkgPath = path.join(DEST, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = NAME;
if (STANDALONE) {
  // Paths shift when the starter becomes the repository root.
  for (const k of Object.keys(pkg.scripts ?? {})) pkg.scripts[k] = pkg.scripts[k].replace(/\.\.\/scripts\//g, 'scripts/');
} else {
  // Workspace mode: every framework script is invoked FROM the framework. One copy, always current.
  const fw = path.relative(DEST, ROOT).replace(/\\/g, '/');
  for (const k of Object.keys(pkg.scripts ?? {})) {
    pkg.scripts[k] = pkg.scripts[k]
      .replace(/(?:\.\.\/)?scripts\//g, `${fw}/scripts/`)
      .replace(new RegExp(`${fw}/scripts/hooks/pre-commit-guard`, 'g'), `${fw}/scripts/hooks/pre-commit-guard`);
  }
  pkg.scripts['framework:status'] = `node ${fw}/scripts/lineage.mjs --status`;
  pkg.scripts['framework:upgrade'] = `node ${fw}/scripts/upgrade.mjs`;
}
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

fs.writeFileSync(path.join(DEST, 'design', 'tokens.json'),
  fs.readFileSync(path.join(SRC, 'design', 'tokens.json'), 'utf8').replace('"Default Framework Palette"', JSON.stringify(`${NAME} palette`)), 'utf8');

fs.writeFileSync(path.join(DEST, 'README.md'), `# ${NAME}

<!-- Three sentences: what this does, for whom, and what "working" means.
     If you cannot write them, the requirements are not ready. -->

## Run
\`\`\`bash
npm install
cp .env.example .env      # then fill it in
npm run dev
\`\`\`

## The gate
\`\`\`bash
npm run gate
\`\`\`

## Process
Start at \`docs/00-OVERVIEW.md\`. Binding rules for this application: \`AGENTS.md\`.
`, 'utf8');

// CLAUDE.md is what Claude Code reads before every task. AGENTS.md is the vendor-neutral name
// some other tools look for; ship both, with the second pointing at the first so they cannot
// drift into two different sets of rules.
const rulesTemplate = fs.readFileSync(path.join(ROOT, 'templates/docs/AGENTS.md'), 'utf8')
  .replace('# AGENTS.md — `<application name>`', `# CLAUDE.md — ${NAME}`);
fs.writeFileSync(path.join(DEST, 'CLAUDE.md'), rulesTemplate, 'utf8');
fs.writeFileSync(path.join(DEST, 'AGENTS.md'),
  `# AGENTS.md\n\nSee [CLAUDE.md](./CLAUDE.md) — the binding rules for ${NAME} live there.\n` +
  `\nThis file exists so tools looking for the vendor-neutral name find them too. It is a\n` +
  `pointer on purpose: two files of rules become two DIFFERENT sets of rules.\n`, 'utf8');
fs.writeFileSync(path.join(DEST, 'TEST_SUMMARY.md'),
  '# Test summary\n\n_Newest run first. Append-only: never overwrite a prior run._\n\n---\n\n', 'utf8');
fs.writeFileSync(path.join(DEST, 'CHANGELOG.md'), '# Changelog\n\n## Unreleased\n\n', 'utf8');

// The intake ledger arrives armed, like the registers: /request inside the app writes here,
// and a NEW-APP request file moves here as entry #1. The README is the folder contract.
fs.mkdirSync(path.join(DEST, 'requests'), { recursive: true });
const reqReadme = path.join(ROOT, 'requests', 'README.md');
if (fs.existsSync(reqReadme)) fs.copyFileSync(reqReadme, path.join(DEST, 'requests', 'README.md'));
fs.writeFileSync(path.join(DEST, '.gitignore'),
  ['node_modules/', '.next/', 'dist/', '.env', '.env.*', '!.env.example',
   'test-results/', 'playwright-report/', '.gate-logs/', '.DS_Store',
   '',
   '# Personal overrides only. Committed settings are what enforce anything.',
   '.claude/settings.local.json',
   '',
   '# NOT ignored, on purpose - these are the framework working:',
   '#   .claude/settings.json   wires the hook; a local-only copy enforces nothing on anyone else',
   '#   .baselines/             ratchet baselines are COMMITTED. That is what makes them ratchets.',
   '#   TEST_SUMMARY.md         the append-only gate log the commit guard greps.',
   ''].join('\n'), 'utf8');

try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/theme-build.mjs'), '--tokens', 'design/tokens.json', '--out', 'src/theme'],
    { cwd: DEST, stdio: 'inherit' });
} catch { console.warn('theme-build did not run; run it manually after install.'); }

// LINEAGE - the app's birth certificate (EVOLUTION_PLAN.md WS2). Records the framework version
// and the fingerprint of every seed file received, so upgrade.mjs can later tell "the app
// changed this" from "the framework changed this". Without it, every upgrade is a guess.
try {
  const { walkFiles, sha, isExpectedDivergent, writeLineage, frameworkVersion } =
    await import(pathToFileURL(path.join(ROOT, 'scripts/lib/lineage.mjs')).href);
  const files = {};
  for (const rel of walkFiles(path.join(ROOT, 'starter')).filter((r) => !r.startsWith('.baselines/'))) {
    const inApp = path.join(DEST, rel);
    if (!fs.existsSync(inApp)) continue;
    files[rel] = { hash: sha(inApp), status: isExpectedDivergent(rel) ? 'expected-divergent' : 'pristine' };
  }
  writeLineage(DEST, {
    frameworkVersion: frameworkVersion(ROOT),
    seededAt: new Date().toISOString().slice(0, 10),
    mode: STANDALONE ? 'standalone' : 'workspace',
    files,
  });
  fs.copyFileSync(path.join(ROOT, 'templates/docs/FRAMEWORK_ADOPTION.md'), path.join(DEST, 'FRAMEWORK_ADOPTION.md'));
  console.log(`lineage recorded: framework v${frameworkVersion(ROOT)}, ${Object.keys(files).length} seed file(s)`);
} catch (e) { console.warn(`lineage not recorded (${e.message}) - run lineage.mjs --init later.`); }

console.log(`
Scaffolded ${NAME} at ${DEST}

Next, in order (docs/02-PROJECT-INITIALIZATION.md):
  1. cd ${path.relative(ROOT, DEST)} && npm install
  2. Edit design/tokens.json  -> your brand colours
     npm run theme:build && npm run theme:contrast
  3. Add brand assets for BOTH themes in public/brand/, declare them in tokens.json
     npm run theme:assets
  4. cp .env.example .env and fill it in
  5. Fill in CLAUDE.md - the binding rules for THIS application (read before every task)
  6. Fill in docs/registers/ENVIRONMENTS.md
  7. git init && npm run guard:install && npm run guard:test
     (.claude/ came with the scaffold: /feature, /bug, /gate and the commit hook work already)
  8. Ship one trivial change through the FULL pipeline, while the stakes are zero.
     You will find three broken things. That is the point.
`);
