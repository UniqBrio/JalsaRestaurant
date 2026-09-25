/**
 * round-rig — run a scenario against the REAL data-layer code with the database swapped for
 * `fake-supabase.ts`, and return what it printed.
 *
 * The data layer imports `server-only`, `next/headers` (through `@/lib/sessions`) and a live
 * Supabase client, so it cannot be imported by a unit spec. esbuild bundles the scenario with
 * exactly three substitutions — `server-only` → nothing, `@/lib/supabase/server` → the fake,
 * `@/lib/sessions` → the fake — and everything else is the application's own source. The bundle
 * runs in a child process so each scenario starts from fresh module state.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '../..');

const SWAPS: Record<string, string> = {
  '@/lib/supabase/server': join(HERE, 'fake-supabase.ts'),
  '@/lib/sessions': join(HERE, 'fake-sessions.ts'),
};

export async function runScenario<T>(scenarioFile: string): Promise<T> {
  // Inside the app, not the OS temp dir: the bundle keeps npm packages external, and Node resolves
  // them from the bundle's own location.
  const cache = join(APP, 'node_modules', '.cache', 'round-rig');
  mkdirSync(cache, { recursive: true });
  const outfile = join(mkdtempSync(join(cache, 'run-')), 'scenario.mjs');
  await build({
    entryPoints: [scenarioFile],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    tsconfig: join(APP, 'tsconfig.json'),
    packages: 'external',
    logLevel: 'silent',
    plugins: [
      {
        name: 'round-rig-swaps',
        setup(b) {
          b.onResolve({ filter: /^server-only$/ }, () => ({ path: 'server-only', namespace: 'empty' }));
          b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
          b.onResolve({ filter: /^@\/lib\/(supabase\/server|sessions)$/ }, (a) => ({
            path: SWAPS[a.path] ?? a.path,
          }));
        },
      },
    ],
  });
  const out = execFileSync(process.execPath, [outfile], {
    cwd: APP,
    encoding: 'utf8',
    env: {
      ...process.env,
      APP_ENV: 'test',
      PUBLIC_APP_URL: 'http://localhost:3000',
      PUBLIC_API_URL: 'http://localhost:3000/api',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'x',
      SUPABASE_SECRET_KEY: 'x',
      SESSION_SECRET: 'round-rig-only-0000000000000000000000000000',
      NEXT_PUBLIC_QR_ORIGIN: 'http://localhost:3000',
    },
  });
  return JSON.parse(out.trim().split('\n').at(-1) ?? 'null') as T;
}
