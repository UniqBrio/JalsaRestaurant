/**
 * print-trail-columns db spec — every column the Printers screen reads from the print trail
 * exists in the database the migrations build.
 *
 * WHY (26-Sep-2026, found re-measuring after the merge with main): "Last printed" read
 * `print_job.printed_at`. Only `kot` has that column, so every owner console load and poll
 * answered 500 on a real database. The fake database the other specs use accepts any column
 * name, which is how it passed them.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));
const QUERIES = fileURLToPath(new URL('../../src/lib/db/queries.ts', import.meta.url));

test('every latestPerKey(key, at) names two real print_job columns', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create schema extensions; create extension pgcrypto with schema extensions;
    create schema auth; create table auth.users (id uuid primary key);
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    set search_path = public, extensions;`);
  for (const f of readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith('.sql') && !n.startsWith('00000000000000'))
    .sort())
    await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));

  const columns = new Set(
    (
      await db.query<{ c: string }>(
        `select column_name c from information_schema.columns where table_schema = 'public' and table_name = 'print_job'`
      )
    ).rows.map((r) => r.c)
  );
  expect(columns.size, 'the migrations built print_job').toBeGreaterThan(10);

  const calls = [...readFileSync(QUERIES, 'utf8').matchAll(/latestPerKey\('([a-z_]+)', '([a-z_]+)'/g)];
  expect(calls.length, 'the scan found the Printers reads').toBeGreaterThanOrEqual(2);
  const missing = calls.flatMap((m) => [m[1] ?? '', m[2] ?? '']).filter((c) => !columns.has(c));
  expect(missing).toEqual([]);
});
