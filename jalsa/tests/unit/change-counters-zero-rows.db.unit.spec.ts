/**
 * change counters, zero rows — a statement that changed nothing moves no counter; one that
 * changed something moves exactly what it moved before (27-Oct-2026, P-4; migration
 * 20261027090000_jalsa_bump_only_when_rows_change.sql). Also SEC-16 (20261027090100).
 *
 * In a real Postgres (PGlite, in-process): every migration BEFORE the change is applied and the
 * trigger set recorded, then the change, then its documented rollback, then the change again.
 *
 * FAIL-FIRST: run with the two 27-Oct migrations absent, the zero-row rungs fail (every empty
 * UPDATE/DELETE moved 'floor', the empty menu update moved both scopes) and so do the
 * introspection and search_path rungs. Recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));
const CHANGE = '20261027090000_jalsa_bump_only_when_rows_change.sql';

const SUPABASE_PRELUDE = `
  create schema extensions; create extension pgcrypto with schema extensions;
  create schema auth; create table auth.users (id uuid primary key);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  set search_path = public, extensions;
`;

const TRIGGERS = `
  select c.relname || '|' || t.tgname || '|' || t.tgtype || '|' || encode(t.tgargs, 'escape') || '|' || p.proname as t
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
   where p.proname like 'bump_change_version%' and not t.tgisinternal order by 1`;

let db: PGlite;
let before: string[] = [];
let after: string[] = [];

const read = (f: string) => readFileSync(`${MIGRATIONS}/${f}`, 'utf8');
const triggers = async () => (await db.query<{ t: string }>(TRIGGERS)).rows.map((r) => r.t);
async function counters(): Promise<{ floor: number; catalog: number }> {
  const r = await db.query<{ scope: string; v: string }>(`select scope, version::text v from change_version`);
  const of = (s: string) => Number(r.rows.find((x) => x.scope === s)?.v);
  return { floor: of('floor'), catalog: of('catalog') };
}
/** How far each counter moved across `sql`. */
async function moved(sql: string): Promise<{ floor: number; catalog: number }> {
  const a = await counters();
  await db.exec(sql);
  const b = await counters();
  return { floor: b.floor - a.floor, catalog: b.catalog - a.catalog };
}
/** The rollback, exactly as the migration's header documents it. */
function rollbackSql(): string {
  const text = read(CHANGE);
  const block = text.slice(text.indexOf('-- ROLLBACK'), text.indexOf('-- RLS / privileges'));
  return block
    .split('\n')
    .slice(1)
    .filter((l) => l.startsWith('--   '))
    .map((l) => l.slice(5))
    .join('\n');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files.filter((x) => x < CHANGE)) await db.exec(read(f));
  before = await triggers();
  for (const f of files.filter((x) => x >= CHANGE)) await db.exec(read(f));
  after = await triggers();
  await db.exec(`
    insert into bill (restaurant_id, code, status, host_table_id, tax_rate)
      select r.id, 'JB-Z', 'open', t.id, 5 from restaurant r, dining_table t where t.name = 'A4';
    insert into bill_table (bill_id, table_id)
      select b.id, t.id from bill b, dining_table t where b.code = 'JB-Z' and t.name = 'A4';
  `);
});

test('no statement-level trigger moves a counter without asking whether rows changed', () => {
  expect(before.length, 'the pre-change set was read').toBeGreaterThan(20);
  const statementLevel = after.filter((t) => (Number(t.split('|')[2]) & 1) === 0);
  expect(statementLevel.length).toBe(76);
  for (const t of statementLevel) expect(t, t).toMatch(/\|bump_change_version_if_rows$/);
  // The row-level ones, behind WHEN clauses, are exactly as they were.
  const rows = (set: string[]) => set.filter((t) => (Number(t.split('|')[2]) & 1) === 1);
  expect(rows(after)).toEqual(rows(before));
});

test('every table and scope that moved a counter before still moves the same scopes', () => {
  const key = (t: string) => {
    const [table, , , args] = t.split('|');
    return `${table}|${args}`;
  };
  const statementLevel = (set: string[]) => set.filter((t) => (Number(t.split('|')[2]) & 1) === 0);
  expect([...new Set(statementLevel(after).map(key))].sort()).toEqual(
    [...new Set(statementLevel(before).map(key))].sort()
  );
});

test('a statement that matched nothing moves nothing', async () => {
  const none = "'00000000-0000-0000-0000-000000000000'";
  for (const sql of [
    `update print_job set status = 'failed' where id = ${none}`,
    `delete from table_request where id = ${none}`,
    `update bill set guests = 2 where id = ${none}`,
    `delete from guest_session where id = ${none}`,
    `delete from bridge_token where id = ${none}`,
    `update menu_item set price = price where false`,
    `update setting set value = value where false`,
  ]) {
    expect(await moved(sql), sql).toEqual({ floor: 0, catalog: 0 });
  }
});

test('a statement that changed rows moves exactly the scopes it always moved', async () => {
  expect(await moved(`update bill set guests = 3 where code = 'JB-Z'`)).toEqual({ floor: 1, catalog: 0 });
  expect(
    await moved(`update menu_item set sort = sort where id = (select id from menu_item order by id limit 1)`)
  ).toEqual({
    floor: 1,
    catalog: 1,
  });
  expect(
    await moved(
      `insert into table_request (restaurant_id, table_id, kind) select restaurant_id, id, 'water' from dining_table where name = 'A4'`
    )
  ).toEqual({ floor: 1, catalog: 0 });
  expect(await moved(`delete from table_request where kind = 'water'`)).toEqual({ floor: 1, catalog: 0 });
  // Many rows, one statement: one move, as before.
  expect(await moved(`update menu_item set sort = sort`)).toEqual({ floor: 1, catalog: 1 });
});

test('the four trigger functions resolve names through a fixed search_path (SEC-16)', async () => {
  const r = await db.query<{ proname: string; cfg: string | null }>(`
    select proname, array_to_string(proconfig, ',') cfg from pg_proc
     where pronamespace = 'public'::regnamespace and proname in
       ('touch_updated_at', 'release_tables_on_close', 'print_job_printer_is_immutable',
        'print_job_food_side_is_immutable', 'bump_change_version_if_rows') order by 1`);
  expect(r.rows.length).toBe(5);
  for (const row of r.rows) expect(row.cfg, row.proname).toBe('search_path=public');
});

test('the documented rollback restores the previous triggers exactly, and the change re-applies', async () => {
  await db.exec(rollbackSql());
  expect(await triggers()).toEqual(before);
  // And the old behaviour is back: an empty statement moves the floor again.
  expect(await moved(`delete from table_request where id = '00000000-0000-0000-0000-000000000000'`)).toEqual({
    floor: 1,
    catalog: 0,
  });
  await db.exec(read(CHANGE));
  expect(await triggers()).toEqual(after);
  await db.exec(read(CHANGE));
  expect(await triggers(), 'a second apply replaces, never fails or duplicates').toEqual(after);
});
