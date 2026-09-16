#!/usr/bin/env node
/**
 * check-pwa-baseline - is this application actually installable?
 *
 * THE FAILURE MODE THIS EXISTS FOR
 *   Every part of PWA support is individually easy and collectively easy to half-do, and every
 *   half-done version LOOKS finished. A manifest exists but nothing links it. A worker exists
 *   but nothing registers it. Icons are declared but the files were never added. An offline
 *   fallback is cached by name and the name is wrong. None of these break a build, none show
 *   up in a browser you are already looking at, and all of them mean the app cannot be
 *   installed - which nobody discovers until someone tries, months later, on a phone.
 *
 *   "Every generated application is installable" is therefore a claim that has to be executed,
 *   not asserted. This is what executes it.
 *
 * WHAT IT CHECKS - and each one is a way the promise has actually been broken
 *   1. The manifest exists, parses, and carries every member an install needs.
 *   2. Every icon it declares resolves to a real file, and at least one is maskable raster -
 *      Android crops a non-maskable icon badly, and iOS will not take an SVG at all.
 *   3. The service worker file exists.
 *   4. Something REGISTERS it. A worker nobody registers is a file, not a feature.
 *   5. Something LINKS the manifest. Same argument.
 *   6. The offline fallback the worker names exists, and the worker precaches that same path -
 *      a fallback cached under a name nothing requests is a fallback that never appears.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 *   Whether the app is installable IN A BROWSER. That needs a browser, and it belongs to the
 *   preview smoke stage. This is the static floor: everything decidable from the tree, decided
 *   before anything is deployed. It says so rather than implying more.
 *
 * RATCHETED, like every other audit here: a new gate arrives baselined, so an existing app
 * adopting this framework version is never turned green -> red by it. The starter's backlog is
 * zero, which makes it a clean gate there.
 *
 * USAGE  node scripts/audits/check-pwa-baseline.mjs [--app <dir>] [--report|--write-baseline]
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
const PUBLIC = path.resolve(APP, arg('--public', 'public'));
const SRC = path.resolve(APP, arg('--src', 'src'));
const BASELINE = path.resolve(ROOT, arg('--baseline', appPath(ROOT, '.baselines/pwa-baseline.txt')));
const CMD = 'node scripts/audits/check-pwa-baseline.mjs --write-baseline';

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const problems = [];
const add = (id, detail) => problems.push(`${id}|${detail}`);

/**
 * A detector that parsed nothing must report BLOCKED, never success: an application directory
 * that is not there looks exactly like a compliant one to every check below.
 */
let parsedSomething = false;

/* ---- 1. the manifest ---------------------------------------------------------------------- */
const manifestPath = path.join(PUBLIC, 'manifest.webmanifest');
let manifest = null;
if (!fs.existsSync(manifestPath)) {
  add('manifest.missing', `no ${rel(manifestPath)} - run \`npm run theme:build\`, which generates it from design/tokens.json`);
} else {
  parsedSomething = true;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    add('manifest.unparseable', `${rel(manifestPath)} is not valid JSON - ${e.message}`);
  }
}

if (manifest) {
  // `id` is what a browser uses to decide whether an install is this app or a new one; without
  // it start_url becomes the identity, so changing the landing route orphans every install.
  for (const key of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
    if (manifest[key] === undefined || manifest[key] === null || manifest[key] === '') {
      add('manifest.field', `manifest is missing "${key}" - an install needs it`);
    }
  }
  const DISPLAY = ['standalone', 'fullscreen', 'minimal-ui'];
  if (manifest.display && !DISPLAY.includes(manifest.display)) {
    add('manifest.display', `display "${manifest.display}" does not launch as a standalone application (want one of ${DISPLAY.join(', ')})`);
  }
  for (const key of ['theme_color', 'background_color']) {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(String(manifest[key] ?? ''))) {
      add('manifest.color', `"${key}" is not a colour value - it is generated from design/tokens.json and should never be edited here`);
    }
  }

  /* ---- 2. the icons ----------------------------------------------------------------------- */
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  if (!icons.length) add('icons.none', 'the manifest declares no icons, so no platform can install it');
  for (const icon of icons) {
    const file = path.join(PUBLIC, String(icon.src ?? '').replace(/^\//, ''));
    if (!icon.src) { add('icons.src', 'an icon entry has no "src"'); continue; }
    // Existence, not just declaration: a declared icon whose file is absent is the exact shape
    // of "it looked finished".
    if (!fs.existsSync(file)) add('icons.file', `declared icon ${icon.src} has no file at ${rel(file)}`);
  }
  const maskableRaster = icons.some((i) =>
    String(i.purpose ?? '').split(/\s+/).includes('maskable') && /\.png$/i.test(String(i.src ?? '')));
  if (icons.length && !maskableRaster) {
    add('icons.maskable', 'no maskable PNG icon - Android crops a non-maskable icon badly and iOS will not accept an SVG at all');
  }
}

/* ---- 3 & 6. the service worker and the offline fallback ------------------------------------ */
const swPath = path.join(PUBLIC, 'sw.js');
let sw = null;
if (!fs.existsSync(swPath)) {
  add('sw.missing', `no ${rel(swPath)} - without a service worker the app cannot be launched offline`);
} else {
  parsedSomething = true;
  sw = fs.readFileSync(swPath, 'utf8');
  if (!/addEventListener\(\s*['"]fetch['"]/.test(sw)) {
    add('sw.nofetch', 'the service worker handles no "fetch" event, so it can serve nothing when the network is gone');
  }
  if (!/addEventListener\(\s*['"]install['"]/.test(sw)) {
    add('sw.noinstall', 'the service worker has no "install" handler, so it precaches nothing');
  }
}

const offlineRel = '/offline.html';
const offlinePath = path.join(PUBLIC, offlineRel.replace(/^\//, ''));
if (!fs.existsSync(offlinePath)) {
  add('offline.missing', `no ${rel(offlinePath)} - the page shown when there is no network and no cached copy`);
} else if (sw && !sw.includes(offlineRel)) {
  // A fallback the worker never names is a file that is never served. This has happened by
  // renaming one of the two and not the other.
  add('offline.unreferenced', `${offlineRel} exists but sw.js never names it, so it will never be served`);
}

/* ---- 4 & 5. something registers the worker, and something links the manifest ---------------- */
/**
 * COMMENTS ARE STRIPPED BEFORE THIS SCAN, and that is not tidiness.
 *
 * The first version matched the bare string `manifest.webmanifest` anywhere in src/. The
 * generated `tokens.generated.ts` carries a comment EXPLAINING why the layout does not import
 * `public/manifest.webmanifest` - so the audit read that explanation as proof the manifest was
 * linked, and reported an app with its layout deleted as fully wired. Found by case 10 of
 * scripts/pwa-baseline.test.sh before it shipped.
 *
 * A detector must be able to tell code from prose about code. Anything less means the more
 * carefully a file documents itself, the more thoroughly it fools the checks.
 */
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:'"\`\\])\/\/[^\n]*/g, '$1')
  .replace(/<!--[\s\S]*?-->/g, ' ');

const sources = walk(SRC, { exts: ['.ts', '.tsx', '.js', '.jsx', '.html'] });
if (sources.length) parsedSomething = true;
const appSource = sources.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');

if (sw && !/serviceWorker\s*\.\s*register\s*\(/.test(appSource)) {
  add('sw.unregistered', 'nothing in src/ calls navigator.serviceWorker.register - the worker exists but never runs');
}
// A LINK, not a mention: `rel="manifest"` in markup, or Next's `manifest:` metadata field.
// Requiring the declaration rather than the filename is what keeps a passing reference - in a
// string, a variable name, a log line - from standing in for the wiring itself.
const LINKS_MANIFEST = [
  /rel\s*=\s*["'{\`]?\s*manifest/i,
  /\bmanifest\s*:\s*['"\`][^'"\`]*manifest\.webmanifest/,
];
if (manifest && !LINKS_MANIFEST.some((re) => re.test(appSource))) {
  add('manifest.unlinked', 'nothing in src/ DECLARES the manifest (<link rel="manifest"> or a `manifest:` metadata field) - '
    + 'the file exists but no page points a browser at it');
}

/* ---- verdict ------------------------------------------------------------------------------- */
if (argv.includes('--report')) {
  problems.length ? problems.forEach((p) => console.log(p))
    : console.log('No PWA baseline problems found.');
  console.log(`\napp: ${rel(APP)} - ${problems.length} problem(s), ${sources.length} source file(s) scanned.`);
  process.exit(0);
}
if (argv.includes('--write-baseline')) {
  const n = writeBaseline(BASELINE, problems, {
    name: 'PWA INSTALLABILITY',
    regenerateCmd: CMD,
    note: 'Each entry is a way this application is NOT installable. Add a reason beside any you keep.',
  });
  console.log(`wrote ${rel(BASELINE)} - ${n} entr${n === 1 ? 'y' : 'ies'}`);
  process.exit(0);
}

process.exit(evaluateRatchet({
  name: 'PWA INSTALLABILITY',
  signatures: problems,
  baselineFile: BASELINE,
  regenerateCmd: CMD,
  parsedSomething,
  remediation: 'PWA support ships with the framework: `npm run theme:build` generates the manifest, '
    + 'the offline page and the icons from design/tokens.json, and src/app/layout.tsx links the manifest '
    + 'and mounts <PwaProvider/>, which registers public/sw.js. If a piece is missing, restore it rather '
    + 'than baselining it - an app that cannot be installed is the one thing this gate exists to prevent.',
}));
