/**
 * A switched-off network printer with no address, against a real Postgres (30-Sep-2026).
 *
 * tests/unit/printer-switch-off.unit.spec.ts pins the rule in the form and in upsertPrinter: an
 * address is required only of a machine in use. That rule is only safe because the database
 * agrees - `printer_address_when_networked` is `connection = 'USB' or address <> '' or
 * online = false`. These cases run every migration in filename order on PGlite and hold the
 * database to it, so a later migration that ties `enabled` into the check, or seeds a printer
 * online, fails here rather than as a raw constraint error behind Save changes.
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

/** What Supabase provides before any migration runs (the same prelude as food-type-master.db). */
const SUPABASE_PRELUDE = `
  create schema extensions; create extension pgcrypto with schema extensions;
  create schema auth; create table auth.users (id uuid primary key);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  set search_path = public, extensions;
`;

let db: PGlite;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
});

test('the seed leaves network printers with no address, and none of them online', async () => {
  const seeded = (
    await db.query<{ n: number }>(
      `select count(*)::int n from printer where connection <> 'USB' and btrim(address) = ''`
    )
  ).rows[0];
  expect(seeded?.n).toBeGreaterThan(0);
  const online = (await db.query<{ n: number }>(`select count(*)::int n from printer where online`)).rows[0];
  expect(online?.n).toBe(0);
});

test('switching one off with no address is accepted - the write upsertPrinter now sends', async () => {
  const updated = await db.query<{ enabled: boolean }>(`
    update printer set enabled = false, address = '', port = 9100
     where id = (select id from printer where connection <> 'USB' and btrim(address) = '' order by name limit 1)
    returning enabled`);
  expect(updated.rows).toEqual([{ enabled: false }]);
});

test('an unaddressed network printer marked online is still refused - the check is not loosened', async () => {
  await expect(
    db.exec(`update printer set online = true where connection <> 'USB' and btrim(address) = ''`)
  ).rejects.toThrow(/printer_address_when_networked/);
});
