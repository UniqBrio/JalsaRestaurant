/**
 * "How did you hear about us?" answers that survive, against a real Postgres (02-Oct-2026).
 *
 * Every migration before the attribution one runs on PGlite; then three guest sessions are
 * created the way the app creates them - two with answers - and only then the migration under
 * test, so its backfill meets real rows. The cases then do what used to destroy answers: Mark
 * free (deleting every session on a table), a phone moving tables (its session replaced), a bill
 * deleted, a table deleted.
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
const count = async (sql: string): Promise<number> => ((await db.query<{ n: number }>(sql)).rows[0]?.n ?? -1);

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  const under = '20261002110000_jalsa_guest_attribution.sql';
  for (const f of files.filter((f) => f < under)) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  // Sessions as they exist on a live database today: two answered, one not.
  await db.exec(`
    insert into guest_session (restaurant_id, token, table_id, heard_about)
      select r.id, 'phone-a', t.id, 'Google review' from restaurant r, dining_table t where t.name = 'A1';
    insert into guest_session (restaurant_id, token, table_id, heard_about)
      select r.id, 'phone-b', t.id, 'Friend recommended' from restaurant r, dining_table t where t.name = 'A2';
    insert into guest_session (restaurant_id, token, table_id, heard_about)
      select r.id, 'phone-c', t.id, '' from restaurant r, dining_table t where t.name = 'A2';
  `);
  for (const f of files.filter((f) => f >= under)) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
});

test('every answer already on a session is carried over - and an unanswered one is not', async () => {
  expect(await count(`select count(*)::int n from guest_attribution`)).toBe(2);
  const rows = (
    await db.query<{ source: string; session_token: string }>(`select source, session_token from guest_attribution order by source`)
  ).rows;
  expect(rows).toEqual([
    { source: 'Friend recommended', session_token: 'phone-b' },
    { source: 'Google review', session_token: 'phone-a' },
  ]);
});

test('re-running the migration does not copy an answer twice', async () => {
  await db.exec(readFileSync(`${MIGRATIONS}/20261002110000_jalsa_guest_attribution.sql`, 'utf8'));
  expect(await count(`select count(*)::int n from guest_attribution`)).toBe(2);
});

test('Mark free deletes the sessions on a table - and the answers stay', async () => {
  // What freeTable does: every session on the table, gone.
  await db.exec(`delete from guest_session where table_id = (select id from dining_table where name = 'A2')`);
  expect(await count(`select count(*)::int n from guest_session where token in ('phone-b', 'phone-c')`)).toBe(0);
  expect(await count(`select count(*)::int n from guest_attribution where session_token = 'phone-b'`)).toBe(1);
  expect(await count(`select count(*)::int n from guest_attribution where session_token = 'phone-b' and guest_session_id is null`)).toBe(1);
});

test('a phone moving tables (its session replaced) keeps its answer too', async () => {
  await db.exec(`delete from guest_session where token = 'phone-a'`);
  await db.exec(`
    insert into guest_session (restaurant_id, token, table_id)
      select r.id, 'phone-a', t.id from restaurant r, dining_table t where t.name = 'A3'`);
  expect(await count(`select count(*)::int n from guest_attribution where session_token = 'phone-a'`)).toBe(1);
});

test('deleting a bill or a table leaves the answer, with the link emptied', async () => {
  const [t] = (await db.query<{ id: string }>(`select id from dining_table where name = 'A10'`)).rows;
  await db.exec(`
    insert into bill (restaurant_id, code, host_table_id) select id, 'B-H', '${t!.id}' from restaurant limit 1;
    insert into guest_attribution (restaurant_id, session_token, table_id, bill_id, source)
      select restaurant_id, 'phone-d', host_table_id, id, 'Instagram' from bill where code = 'B-H';
    delete from bill where code = 'B-H';
    delete from dining_table where id = '${t!.id}';
  `);
  expect(
    await count(`select count(*)::int n from guest_attribution where session_token = 'phone-d' and bill_id is null and table_id is null`)
  ).toBe(1);
});

test('an empty or over-long answer cannot be stored, and the table is behind row-level security', async () => {
  await expect(
    db.exec(`insert into guest_attribution (restaurant_id, source) select id, '   ' from restaurant limit 1`)
  ).rejects.toThrow(/check/);
  await expect(
    db.exec(`insert into guest_attribution (restaurant_id, source) select id, repeat('x', 61) from restaurant limit 1`)
  ).rejects.toThrow(/check/);
  const rls = (await db.query<{ on: boolean }>(`select relrowsecurity as on from pg_class where relname = 'guest_attribution'`)).rows;
  expect(rls[0]?.on).toBe(true);
  expect(await count(`select count(*)::int n from pg_policies where tablename = 'guest_attribution'`)).toBe(0);
});

test('a dismissal is a column on the session', async () => {
  await db.exec(`update guest_session set heard_dismissed_at = now() where token = 'phone-a'`);
  expect(await count(`select count(*)::int n from guest_session where heard_dismissed_at is not null`)).toBe(1);
});
