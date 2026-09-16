#!/usr/bin/env node
/**
 * theme-build - generate every theme artifact from design/tokens.json.
 *
 * WHY THIS EXISTS
 *   A colour that lives in two places has two values. Application code never sees a hex
 *   literal; it sees a CSS custom property or a typed token whose value was generated here.
 *   Re-branding an application is then an edit to ONE file plus a rebuild.
 *
 * OUTPUTS (generated - never hand-edit, they are overwritten)
 *   <out>/tokens.generated.css   CSS custom properties for :root, [data-theme] and
 *                                prefers-color-scheme, plus non-colour scales.
 *   <out>/tokens.generated.ts    Typed token names + a runtime map, for code that needs a
 *                                value in JS (canvas, charts, meta theme-color, native).
 *
 * USAGE  node scripts/theme-build.mjs [--tokens <path>] [--out <dir>] [--check]
 *        --check  regenerate in memory and exit 2 if the committed files differ, so a
 *                 hand-edited generated file cannot ship.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { appPath } from './lib/layout.mjs';
import { maskableIconPng } from './lib/png.mjs';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const CHECK = argv.includes('--check');
const ROOT = process.cwd();
const TOKENS = path.resolve(ROOT, arg('--tokens', appPath(ROOT, 'design/tokens.json')));
const OUT = path.resolve(ROOT, arg('--out', appPath(ROOT, 'src/theme')));
/**
 * The manifest, the offline page and the launcher icons are SERVED, so they belong beside the
 * other served files, not beside the compiled theme. Separate flag, separate default.
 *
 * The default follows the TOKENS, not the working directory. `design/tokens.json` sits in an
 * application root, so its sibling `public/` is that same application's - which means pointing
 * the builder at another tree's tokens moves every output there together.
 *
 * Anchoring it on cwd instead was wrong in a way that only showed up under test: a suite
 * building a scratch app with `--tokens <scratch>/design/tokens.json --out <scratch>/src/theme`
 * got its CSS in the scratch tree and its manifest written over the REAL starter's, stamped
 * with a source path pointing into a temp directory that no longer exists. One flag defaulting
 * to a different app than the other two is a footgun with no safe way to hold it.
 */
const tokensAppRoot = path.resolve(path.dirname(TOKENS), '..');
const PUBLIC = path.resolve(ROOT, arg('--public',
  fs.existsSync(path.join(tokensAppRoot, 'public')) || path.basename(path.dirname(TOKENS)) === 'design'
    ? path.join(tokensAppRoot, 'public')
    : appPath(ROOT, 'public')));

/** Generated files are committed and checked byte-for-byte, so any path baked into them
 *  must read the same on every platform - never Windows backslashes. */
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/**
 * The token source AS NAMED INSIDE A GENERATED FILE - relative to that file, never to the
 * current working directory.
 *
 * `rel()` above is anchored on cwd, which is correct for a MESSAGE (it names the file the way
 * the person who just typed the command would) and wrong for CONTENT. Baking a cwd-relative
 * path into a committed artifact makes the builder a function of where it was invoked:
 * building `starter/src/theme` from the framework root wrote `starter/design/tokens.json`,
 * and building the same tokens to the same directory from `starter/` wrote
 * `design/tokens.json`. Two byte streams, one input.
 *
 * Everything downstream then disagreed. `--check` compares bytes, so it reported DRIFT -
 * "stale or hand-edited" - on files nothing had edited, and gate G1 and commit guard G4
 * blamed the tree for the checker's own cwd. `starter/package.json` runs both `theme:build`
 * and `gate` from the application directory, so using the starter's own scripts broke the
 * framework root's gate and vice versa. And `new-app.mjs` copies the starter and then
 * REBUILDS the theme inside the new app, so every scaffolded app was born differing from its
 * own recorded seed - which `upgrade.mjs` reads as "pristine, and the framework changed it"
 * and auto-overwrites on EVERY upgrade, re-breaking the app's G1 even when no token moved.
 *
 * Anchoring on OUT removes the variable rather than papering over it: both paths are already
 * absolute, so the result cannot depend on cwd. It is also the same string in both layouts -
 * `starter/src/theme` -> `starter/design/tokens.json` and `src/theme` -> `design/tokens.json`
 * both yield `../../design/tokens.json` - so the artifact the framework ships and the one a
 * scaffolded app rebuilds are byte-identical, and the upgrade churn has nothing left to
 * report. And unlike a cwd-relative path, it is followable: resolved from the generated file's
 * own directory it lands on the real tokens file.
 * Each generated file gets its OWN ref, resolved from the directory that file lands in - not
 * one shared string. The offline page lives in `public/` while the token files live in
 * `src/theme/`, so a single ref would be correct for one of them and wrong for the other,
 * which is the same class of defect one level down. Caught by case 2 of the suite below when
 * exactly that was tried.
 * rung: scripts/theme-build.test.sh
 */
const sourceRefFrom = (dir) => path.relative(dir, TOKENS).split(path.sep).join('/');
const SOURCE_REF = sourceRefFrom(OUT);
const PUBLIC_SOURCE_REF = sourceRefFrom(PUBLIC);

const tokens = JSON.parse(fs.readFileSync(TOKENS, 'utf8'));
const THEMES = ['light', 'dark'];
const kebab = (s) => s.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const cssVar = (key) => '--' + kebab(key);

const semantic = Object.entries(tokens.semantic).filter(([k]) => !k.startsWith('_'));
const elevation = Object.entries(tokens.elevation ?? {});
const flatScales = {
  radius: tokens.radius ?? {},
  spacing: tokens.spacing ?? {},
  'font-size': tokens.typography?.size ?? {},
  'line-height': tokens.typography?.lineHeight ?? {},
  'font-weight': tokens.typography?.weight ?? {},
  duration: tokens.motion?.duration ?? {},
  easing: tokens.motion?.easing ?? {},
  layout: tokens.layout ?? {},
};

const themeBlock = (theme, indent = '  ') =>
  [
    ...semantic.map(([k, val]) => `${indent}${cssVar(k)}: ${val[theme]};`),
    ...elevation.map(([k, val]) => `${indent}${cssVar('shadow.' + k)}: ${val[theme]};`),
  ].join('\n');

const staticBlock = () =>
  Object.entries(flatScales)
    .flatMap(([group, map]) =>
      Object.entries(map)
        .filter(([, val]) => typeof val === 'string')
        .map(([k, val]) => `  --${group}-${kebab(k)}: ${val};`)
    )
    .join('\n');

/* Three-state theming, and the ORDER is the contract:
 *   :root                        LIGHT is always fully defined. A token defined only inside a
 *                                media query has no value when that query is false.
 *   @media dark + :not([data-theme='light'])   system preference wins when no explicit choice.
 *   :root[data-theme='dark'|'light']           an explicit choice beats the system, both ways.
 */
/**
 * THE WEB APP MANIFEST IS A GENERATED THEME ARTIFACT, not a hand-written config file.
 *
 * `theme_color` and `background_color` are colour decisions - the OS chrome around an
 * installed window, and the canvas its splash screen paints. Hand-written, they are two more
 * colour literals living outside the token file, and they drift the moment anybody rebrands:
 * the app changes colour and the window around it does not. Generating it means a rebrand is
 * still one edit to `design/tokens.json`, and a hand-edited manifest is caught by gate G1
 * exactly like a hand-edited stylesheet.
 *
 * The manifest carries ONE colour because the format has one field. It is the light value;
 * the document additionally ships a per-scheme `<meta name="theme-color">`, and ThemeProvider
 * keeps that in step at runtime. So the installed chrome is right in both themes, and the
 * splash - which the OS paints before any script runs, and which therefore cannot follow a
 * runtime preference - is right in the default one.
 *
 * `icons[].note` is documentation for whoever maintains the token file. It is stripped here:
 * the manifest is read by browsers, and an unknown member in an icon entry is at best ignored
 * and at worst treated as a malformed entry.
 * rung: scripts/audits/check-pwa-baseline.mjs
 */
const appCfg = tokens.app ?? {};
const semanticValue = (tokenName, theme) => {
  const t = tokens.semantic?.[tokenName];
  if (!t) throw new Error(
    `tokens.app names semantic token "${tokenName}", which does not exist in tokens.semantic. `
    + 'The manifest may only reference declared tokens - naming a value directly is the literal this file exists to prevent.');
  return t[theme];
};

const manifest = JSON.stringify({
  // `id` is what the browser uses to decide whether an install is THIS app or a new one.
  // Omitting it makes start_url the identity, so changing the landing route later orphans
  // every existing installation.
  id: appCfg.id ?? '/',
  name: appCfg.name,
  short_name: appCfg.shortName,
  description: appCfg.description,
  lang: appCfg.lang ?? 'en',
  dir: appCfg.dir ?? 'ltr',
  start_url: appCfg.startUrl ?? '/',
  scope: appCfg.scope ?? '/',
  display: appCfg.display ?? 'standalone',
  display_override: appCfg.displayOverride ?? undefined,
  orientation: appCfg.orientation ?? 'any',
  categories: appCfg.categories ?? undefined,
  theme_color: semanticValue(appCfg.themeColorToken ?? 'background', 'light'),
  background_color: semanticValue(appCfg.backgroundColorToken ?? 'background', 'light'),
  icons: (appCfg.icons ?? []).map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })),
}, null, 2) + '\n';

const css = `/* GENERATED by scripts/theme-build.mjs from ${SOURCE_REF} - DO NOT EDIT. */
/* Rebuild: npm run theme:build    Verify: npm run theme:contrast */

:root {
  color-scheme: light dark;

${staticBlock()}

  /* --- LIGHT (default, always fully defined) --- */
${themeBlock('light')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${themeBlock('dark', '    ')}
  }
}

:root[data-theme='dark'] {
${themeBlock('dark')}
}

:root[data-theme='light'] {
${themeBlock('light')}
}

html, body {
  background: var(--background);
  color: var(--text-body);
  font-family: ${tokens.typography.fontFamilyBase};
}

/* Focus is never removed - only restyled. */
:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* Motion collapses to its END STATE; it is never cancelled mid-transition. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}

/* Theme-aware assets: one markup block, correct artwork per theme, no JS, no flash. */
[data-asset-theme='dark']  { display: none; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) [data-asset-theme='light'] { display: none; }
  :root:not([data-theme='light']) [data-asset-theme='dark']  { display: initial; }
}
:root[data-theme='dark']  [data-asset-theme='light'] { display: none; }
:root[data-theme='dark']  [data-asset-theme='dark']  { display: initial; }
:root[data-theme='light'] [data-asset-theme='light'] { display: initial; }
:root[data-theme='light'] [data-asset-theme='dark']  { display: none; }
`;

const ts = `/* GENERATED by scripts/theme-build.mjs from ${SOURCE_REF} - DO NOT EDIT. */
/* Rebuild: npm run theme:build */

/** Every semantic colour role in the design system. */
export const semanticTokens = [
${semantic.map(([k]) => `  '${k}',`).join('\n')}
] as const;
export type SemanticToken = (typeof semanticTokens)[number];

/** CSS custom-property name for a token. */
export const cssVarFor = (t: SemanticToken): string =>
  '--' + t.replace(/\\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** \`var(--x)\` reference, for style props and CSS-in-JS. Prefer this in the DOM. */
export const v = (t: SemanticToken): string => \`var(\${cssVarFor(t)})\`;

/** Resolved values per theme. Use ONLY where a real value is required (canvas, charts,
 *  \`<meta name="theme-color">\`, native platforms). */
export const themeValues = {
${THEMES.map(
  (t) => `  ${t}: {
${semantic.map(([k, val]) => `    '${k}': '${val[t]}',`).join('\n')}
  },`
).join('\n')}
} as const;

export type ThemeName = keyof typeof themeValues;

export const scales = {
  radius: ${JSON.stringify(tokens.radius)},
  spacing: ${JSON.stringify(tokens.spacing)},
  typography: ${JSON.stringify(tokens.typography)},
  motion: ${JSON.stringify(tokens.motion)},
  layout: ${JSON.stringify(tokens.layout)},
} as const;

/**
 * The app's installable identity, from the same generation as the manifest itself.
 *
 * The root layout needs the name, the description, the icons and the two colours. It could
 * import public/manifest.webmanifest directly - but that asks the bundler to resolve an extension it
 * does not handle by default, and the failure is a build error in every scaffolded app. It
 * could restate them, which is two sources for the app's name and therefore two names. So the
 * builder emits them here as well: one generation, two renderings, and they cannot disagree
 * because neither is written by hand.
 */
export const appManifest = ${manifest.trimEnd()} as const;

/** Declared theme-aware assets, rendered by <ThemedImage />. */
export const themedAssets = ${JSON.stringify(
  Object.fromEntries(
    (tokens.assets?.items ?? []).map((a) => [a.id, { light: a.light, dark: a.dark, alt: a.description }])
  ),
  null,
  2
)} as const;
`;

/**
 * The offline fallback is generated for the same reason, and one more: it is the ONE document
 * that must render with no network at all, so it can link no stylesheet and import no font.
 * Everything it needs is inlined - which would make it a page full of colour literals if a
 * person wrote it. Written by the builder, the literals come from the tokens like every other
 * generated file, and both themes are covered by a media query rather than by script, because
 * script is exactly what may not be available here.
 */
const offlineColors = ['light', 'dark'].map((theme) => ({
  theme,
  bg: semanticValue('background', theme),
  surface: semanticValue('surface', theme),
  heading: semanticValue('text.heading', theme),
  body: semanticValue('text.body', theme),
  muted: semanticValue('text.muted', theme),
  border: semanticValue('border', theme),
}));
const offlineVars = (c) => `    --bg: ${c.bg};
    --surface: ${c.surface};
    --heading: ${c.heading};
    --body: ${c.body};
    --muted: ${c.muted};
    --border: ${c.border};`;
const offline = `<!doctype html>
<!-- GENERATED by scripts/theme-build.mjs from ${PUBLIC_SOURCE_REF} - DO NOT EDIT. -->
<!-- Rebuild: npm run theme:build -->
<html lang="${appCfg.lang ?? 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline - ${appCfg.shortName ?? appCfg.name ?? 'App'}</title>
<style>
  :root {
    color-scheme: light dark;
${offlineVars(offlineColors[0])}
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
${offlineVars(offlineColors[1])}
    }
  }
  :root[data-theme='dark'] {
${offlineVars(offlineColors[1])}
  }
  html, body { margin: 0; height: 100%; }
  body {
    background: var(--bg);
    color: var(--body);
    font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    display: grid; place-items: center; padding: 24px;
  }
  main {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 32px; max-width: 32rem; text-align: center;
  }
  h1 { color: var(--heading); font-size: 1.375rem; margin: 0 0 0.5rem; }
  p { margin: 0 0 1rem; }
  .muted { color: var(--muted); font-size: 0.875rem; margin: 0; }
  button {
    font: inherit; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--border); background: var(--bg); color: var(--body);
  }
  button:focus-visible { outline: 2px solid var(--heading); outline-offset: 2px; }
</style>
</head>
<body>
<main data-testid="offline-fallback">
  <h1>You are offline</h1>
  <p>This page could not be loaded because the device has no connection.</p>
  <button type="button" data-testid="offline-retry" onclick="location.reload()">Try again</button>
  <p class="muted">Anything you already opened is still available. Work you have not sent will
  be waiting when the connection returns.</p>
</main>
</body>
</html>
`;

/**
 * The raster launcher icons, generated from the same two tokens as everything else.
 *
 * They could have been committed as binaries. That would have made the launcher icon the one
 * brand asset that does not follow the token file: rebrand the app, and the icon on the home
 * screen stays the colour of the framework that scaffolded it - which is both wrong and
 * invisible until somebody installs it. Generated, a rebrand carries them like the stylesheet.
 *
 * Any declared icon whose file the app has REPLACED with real artwork is left alone. That is
 * the point of a placeholder: it makes the app installable on day one and then gets out of the
 * way. Only the icons this builder itself generated are regenerated, identified by the
 * `generated: true` flag in the declaration - an icon the app owns is never overwritten by a
 * theme build, and never reported as drift.
 */
const iconTargets = (appCfg.icons ?? [])
  .filter((i) => i.generated && /\.png$/i.test(i.src ?? ''))
  .map((i) => {
    const size = Number(String(i.sizes ?? '').split('x')[0]);
    if (!Number.isFinite(size) || size <= 0) throw new Error(
      `tokens.app.icons: "${i.src}" is marked generated but its sizes ("${i.sizes}") is not <n>x<n>. `
      + 'A generated raster needs a pixel size; "any" is only meaningful for a vector.');
    return [path.resolve(PUBLIC, i.src.replace(/^\//, '')),
      maskableIconPng(size, semanticValue(appCfg.iconFieldToken ?? 'primary', 'light'),
        semanticValue(appCfg.iconMarkToken ?? 'onPrimary', 'light'))];
  });

const targets = [
  [path.join(OUT, 'tokens.generated.css'), css],
  [path.join(OUT, 'tokens.generated.ts'), ts],
  [path.resolve(PUBLIC, 'manifest.webmanifest'), manifest],
  [path.resolve(PUBLIC, (appCfg.offlineFallback ?? '/offline.html').replace(/^\//, '')), offline],
  ...iconTargets,
];

let drift = 0;
for (const [file, content] of targets) {
  // Buffers compare as bytes, text as text. Reading a PNG with 'utf8' mangles it, so a binary
  // target would report drift on every run no matter what was on disk.
  const binary = Buffer.isBuffer(content);
  if (CHECK) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, binary ? null : 'utf8') : null;
    const same = binary ? Buffer.isBuffer(current) && current.equals(content) : current === content;
    if (!same) {
      drift++;
      console.error(`DRIFT  ${rel(file)} does not match design/tokens.json.`);
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, binary ? undefined : 'utf8');
    console.log(`wrote  ${rel(file)}`);
  }
}

if (CHECK && drift) {
  console.error(`\nBLOCKED: ${drift} generated file(s) are stale or hand-edited.`);
  console.error('Fix: npm run theme:build   then commit the result.');
  process.exit(2);
}
if (CHECK) console.log('OK  theme artifacts are in sync with design/tokens.json');
