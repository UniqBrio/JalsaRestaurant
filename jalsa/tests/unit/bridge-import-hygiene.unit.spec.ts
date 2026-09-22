/**
 * Bridge import-hygiene spec — the bridge's dependency closure, walked and pinned.
 *
 * WHY THIS IS A TEST AND NOT A NOTE IN A README
 *   The bridge and the application share one repository, one tsconfig, one `node_modules` and one
 *   `@/*` alias. Everything the app can import is one keystroke away from the bridge, and an
 *   editor will offer it. The day `import { supabase } from '@/lib/db/...'` appears in a transport,
 *   nothing breaks: it type-checks, it bundles on this machine, and it ships a service-role key
 *   and a whole Next.js runtime onto a PC in a restaurant, where it also becomes the second place
 *   that can decide which printer a job goes to. That is the defect Phase 1 was spent removing.
 *
 *   The separation is therefore not a convention. It is this walk.
 *
 * WHAT IT ACTUALLY DOES
 *   Starts at every file under `bridge/src`, follows relative imports to a fixed point, and
 *   collects every specifier that leaves the closure. `node:*` is the ONLY permitted outside — not
 *   a starting deny-list, because a deny-list only ever forbids the dependencies somebody already
 *   thought of, and the next one will not be on it.
 *
 * SUPERSEDED 21-Sep-2026 (Gate 4), under the contract-change exception in jalsa/CLAUDE.md.
 *   As written for Gate 3 this spec asserted that the closure contained ONLY files under
 *   `bridge/src`. Gate 4 gives the bridge its encoder, and the encoder is `src/lib/escpos.ts` -
 *   the one proven in Gate 2, byte by byte. Duplicating it on the bridge side would be a second
 *   answer to "what does this ticket look like" with the golden-byte tests guarding only one of
 *   them, so the bridge imports it, and `escpos.ts` brings `print-template.ts` and `status.ts`
 *   with it. All three are pure: no npm, no Node, no React, no database, no clock.
 *
 *   The assertion that changed is therefore "closure = bridge files" -> "closure = bridge files
 *   PLUS these three NAMED files and nothing else". Everything else this spec asserted is kept
 *   verbatim, including the node-only external allow-list, which is what makes the new
 *   membership safe rather than a widening.
 *
 * FAIL-FIRST EVIDENCE (21-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ENTRY_DIR = 'bridge/src';

/**
 * The ONLY application files the bridge may reach, named one at a time.
 *
 * Not a directory and not a prefix, deliberately. `src/lib/**` would let the next import in
 * without anyone deciding; a list of three paths makes adding a fourth an edit somebody has to
 * write down. Each of these was checked to be pure at the moment it was added here: no npm
 * dependency, no Node builtin, no React, no `server-only`, no database client, no clock.
 */
const APP_FILES_THE_BRIDGE_MAY_REACH = [
  'src/lib/escpos.ts',
  'src/lib/print-template.ts',
  'src/lib/status.ts',
];

/**
 * Source with comments removed.
 *
 * Same reason as `bridge-contract.unit.spec.ts`: these files explain at length what they must not
 * import, and a rung that goes red on a file's own explanation teaches people to stop explaining.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '');
}

/** Every `.ts` file beneath a directory. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourcesUnder(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * Every module specifier a file names — static imports, re-exports, dynamic `import()` and
 * `require()` alike.
 *
 * `import type` is included DELIBERATELY. A type-only import is erased at build time, so it costs
 * nothing at runtime, but it still couples the bridge to the app's module graph and it is how the
 * first honest-looking `@/lib/db` reference gets in.
 */
function specifiersIn(source: string): string[] {
  const text = code(source);
  const patterns = [
    /\bimport\s+[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) if (match[1]) found.add(match[1]);
  }
  return [...found];
}

/** A relative specifier as a path on disk, or null if it does not resolve to one. */
function resolveRelative(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [`${base}.ts`, base, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

interface Closure {
  files: string[];
  external: string[];
  unresolved: string[];
}

function walk(entries: string[]): Closure {
  const seen = new Set<string>();
  const external = new Set<string>();
  const unresolved: string[] = [];
  const queue = entries.map((e) => resolve(e));

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    for (const specifier of specifiersIn(readFileSync(file, 'utf8'))) {
      if (specifier.startsWith('.')) {
        const target = resolveRelative(file, specifier);
        // A relative import that resolves to nothing means this walk did NOT see what the
        // compiler sees, and a closure with a hole in it proves nothing. Binding rule 5.
        if (target === null) unresolved.push(`${relative(process.cwd(), file)} → ${specifier}`);
        else queue.push(target);
      } else {
        external.add(specifier);
      }
    }
  }

  return {
    files: [...seen].map((f) => relative(process.cwd(), f)).sort(),
    external: [...external].sort(),
    unresolved,
  };
}

const CLOSURE = walk(sourcesUnder(ENTRY_DIR));

/* ── The parse guard ───────────────────────────────────────────────────── */

test('the walk actually parsed the bridge, and knows an import when it sees one', () => {
  // A scan matching zero files looks exactly like a clean codebase. Binding rule 5.
  expect(CLOSURE.files, 'files in the closure').toContain('bridge/src/transport/types.ts');
  expect(CLOSURE.files).toContain('bridge/src/transport/file.ts');
  expect(CLOSURE.files).toContain('bridge/src/transport/null.ts');
  // Gate 4: the walk must be following the encoder import, or the rungs below are asserting
  // something about a closure that stops at the bridge's own door.
  expect(CLOSURE.files, 'the encoder must be IN the closure').toContain('src/lib/escpos.ts');
  expect(CLOSURE.files, 'and what the encoder imports').toContain('src/lib/print-template.ts');
  expect(CLOSURE.unresolved, 'relative imports the walk could not follow').toEqual([]);

  // And the extractor is not simply returning nothing for everything.
  const sample = specifiersIn(readFileSync('bridge/src/transport/file.ts', 'utf8'));
  expect(sample).toContain('node:fs/promises');
  expect(sample).toContain('node:path');
  expect(sample).toContain('./types');

  // Every form it claims to catch, caught.
  expect(specifiersIn("import x from 'a';")).toEqual(['a']);
  expect(specifiersIn("import type { X } from 'b';")).toEqual(['b']);
  expect(specifiersIn("import 'c';")).toEqual(['c']);
  expect(specifiersIn("export { x } from 'd';")).toEqual(['d']);
  expect(specifiersIn("const m = await import('e');")).toEqual(['e']);
  expect(specifiersIn("const m = require('f');")).toEqual(['f']);
  // And a negative control, so "found nothing" is distinguishable from "cannot see".
  expect(specifiersIn('const x = 1;')).toEqual([]);
  // Including the case that first made these rungs necessary: a comment is not an import.
  expect(specifiersIn("// import { db } from '@/lib/db';\nconst x = 1;")).toEqual([]);
});

/* ── The closure ───────────────────────────────────────────────────────── */

test('the closure contains bridge files and three NAMED pure modules, and nothing else', () => {
  // Gate 4 replaced "only bridge files" with this. The list is closed: a fourth application file
  // appearing here is a decision, and this rung is where it has to be made rather than noticed.
  const strangers = CLOSURE.files.filter(
    (f) => !f.startsWith('bridge/src/') && !APP_FILES_THE_BRIDGE_MAY_REACH.includes(f)
  );
  expect(strangers, 'application files the bridge reached without being allowed to').toEqual([]);
});

test('nothing outside the bridge is imported except Node builtins', () => {
  // An allow-list, not a deny-list. A deny-list forbids only the dependencies somebody already
  // thought of, and the one that eventually gets in is by definition the one nobody listed.
  const strangers = CLOSURE.external.filter((s) => !s.startsWith('node:'));
  expect(strangers, `the bridge closure must import nothing but node: builtins`).toEqual([]);
});

test('Node builtins ARE allowed, and the bridge does use them', () => {
  // The rung above passes trivially on a closure that imports nothing at all. This one records
  // that the allowance is real and exercised, so nobody later "fixes" it by removing it.
  expect(CLOSURE.external.filter((s) => s.startsWith('node:')).length).toBeGreaterThan(0);
});

for (const forbidden of [
  'next',
  'react',
  'react-dom',
  'server-only',
  '@supabase/supabase-js',
  '@supabase/ssr',
  '@/lib/db',
  'zod',
]) {
  test(`the bridge closure does not reach ${forbidden}`, () => {
    // Redundant against the allow-list above, and kept on purpose: this is the rung whose NAME
    // appears in a failure report, and "the bridge imports next" is a more useful sentence than
    // "an unexpected specifier was found".
    const hits = CLOSURE.external.filter((s) => s === forbidden || s.startsWith(`${forbidden}/`));
    expect(hits).toEqual([]);
  });
}

test('the app alias is unreachable from the bridge', () => {
  // `@/*` resolves into `src/`, which is the whole application — route handlers, the Supabase
  // client, the secret key. One alias import is the entire separation gone.
  expect(CLOSURE.external.filter((s) => s.startsWith('@/'))).toEqual([]);
});

/* ── Browser-only APIs ─────────────────────────────────────────────────── */

const BROWSER_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'XMLHttpRequest',
  'WebSocket',
  'alert',
];

test('no browser-only global is referenced anywhere in the closure', () => {
  // The bridge is a Windows service. A `window` reference does not fail to compile here — the
  // tsconfig's lib includes DOM for the app's sake — it fails at three in the morning on a PC
  // behind the counter.
  const offences: string[] = [];
  for (const file of CLOSURE.files) {
    const text = code(readFileSync(file, 'utf8'));
    for (const global of BROWSER_GLOBALS) {
      if (new RegExp(`\\b${global}\\b`).test(text)) offences.push(`${file}: ${global}`);
    }
  }
  expect(offences).toEqual([]);
});

test('that sweep can actually see an offence', () => {
  // The same detector, pointed at a string that definitely contains one. Without this, a typo in
  // the regex produces a permanently green rung that has never matched anything.
  const detect = (text: string): string[] =>
    BROWSER_GLOBALS.filter((g) => new RegExp(`\\b${g}\\b`).test(code(text)));

  expect(detect('const el = document.getElementById("x");')).toContain('document');
  expect(detect('window.setTimeout(() => {}, 0);')).toContain('window');
  // And it does not fire on a word that merely contains one.
  expect(detect('const documented = 1; const windowless = 2;')).toEqual([]);
  // Nor on a comment explaining what the file must not do.
  expect(detect('// never touch window or document here\nconst x = 1;')).toEqual([]);
});
