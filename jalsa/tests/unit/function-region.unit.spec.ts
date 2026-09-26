/**
 * function-region unit spec — the server functions run next to the database.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md): with no `vercel.json` the functions
 * ran in Vercel's default iad1 (Washington DC) while Supabase is ap-southeast-2 (Sydney). Every
 * database call crossed that distance: 229 ms minimum, 375 ms median, over 39,357 calls in 24 h,
 * against ~1 ms of Postgres time. A guest screen makes 8 sequential calls, so ≈2.9 s per load.
 *
 * FAIL-FIRST: run against the pre-fix tree (no jalsa/vercel.json) — "ENOENT: no such file or
 * directory, open '.../jalsa/vercel.json'". Recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP = join(dirname(fileURLToPath(import.meta.url)), '../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Supabase region → the Vercel function region in the same city. Extend when a project moves. */
const VERCEL_REGION_FOR_SUPABASE: Record<string, string> = {
  'ap-southeast-2': 'syd1', // Sydney
  'ap-south-1': 'bom1', // Mumbai
  'ap-southeast-1': 'sin1', // Singapore
};

/** Both Supabase projects (development and test) — docs/registers/ENVIRONMENTS.md. */
const SUPABASE_REGION = 'ap-southeast-2';

test('vercel.json pins the functions to the database region, and only that region', () => {
  const config = JSON.parse(readFileSync(join(APP, 'vercel.json'), 'utf8')) as {
    regions?: unknown;
  };
  expect(config.regions).toEqual([VERCEL_REGION_FOR_SUPABASE[SUPABASE_REGION]]);
});

test('no route overrides the pinned region', () => {
  // A `preferredRegion` export in any route would quietly send that route back across the world.
  const files = sourceFiles(join(APP, 'src'));
  expect(files.length).toBeGreaterThan(50); // the scan read the source tree, not an empty directory
  expect(files.filter((f) => readFileSync(f, 'utf8').includes('preferredRegion'))).toEqual([]);
});
