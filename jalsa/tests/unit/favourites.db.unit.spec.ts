/**
 * The guest's heart, in the database (03-Oct-2026, 20261004090000_jalsa_guest_favourite).
 *
 * Every migration runs on PGlite, after Supabase's default privileges are emulated. The table must
 * keep one heart per dish per party, keep a dish's hearts (and its name) when the dish is deleted
 * from the menu, and answer nobody but the server: RLS on, the default grants revoked.
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

/** What Supabase provides before any migration runs (the same prelude as the other .db specs). */
const SUPABASE_PRELUDE = `
  create schema extensions; create extension pgcrypto with schema extensions;
  create schema auth; create table auth.users (id uuid primary key);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  set search_path = public, extensions;
`;

let db: PGlite;
let bill = '';
let other = '';
let dish = '';
let restaurant = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  /* What Supabase really does to a new public table: its default privileges grant it to the
     browser's roles. Without this the RLS case below would pass on a prelude that grants nothing,
     for a reason that does not hold on Supabase (permission review, 03-Oct-2026). */
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;`);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000')).sort()) {
    await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  }
  await db.exec(`
    insert into bill (restaurant_id, code, host_table_id, guests, tax_rate)
      select r.id, 'B-FAV', t.id, 2, 5 from restaurant r, dining_table t where t.name = 'A5' limit 1;
    insert into bill (restaurant_id, code, host_table_id, guests, tax_rate)
      select r.id, 'B-FAV2', t.id, 2, 5 from restaurant r, dining_table t where t.name = 'A6' limit 1;
  `);
  bill = (await db.query<{ id: string }>(`select id from bill where code = 'B-FAV'`)).rows[0]!.id;
  other = (await db.query<{ id: string }>(`select id from bill where code = 'B-FAV2'`)).rows[0]!.id;
  const m = (await db.query<{ id: string; restaurant_id: string }>(`select id, restaurant_id from menu_item order by name limit 1`)).rows[0]!;
  dish = m.id;
  restaurant = m.restaurant_id;
});

const heart = (billId: string, name = 'The dish') =>
  db.query(
    `insert into guest_favourite (restaurant_id, bill_id, menu_item_id, item_name) values ($1, $2, $3, $4)
       on conflict (bill_id, menu_item_id) do nothing`,
    [restaurant, billId, dish, name]
  );

test('a heart is kept, and a second heart on the same dish by the same party is not a second row', async () => {
  await heart(bill);
  await heart(bill);
  const n = (await db.query<{ n: number }>(`select count(*)::int n from guest_favourite where bill_id = $1`, [bill])).rows[0]!.n;
  expect(n).toBe(1);
  // Without the on-conflict clause the database itself refuses the duplicate.
  await expect(
    db.query(`insert into guest_favourite (restaurant_id, bill_id, menu_item_id, item_name) values ($1, $2, $3, 'x')`, [restaurant, bill, dish])
  ).rejects.toThrow(/guest_favourite_once_per_party/);
});

test('another party loving the same dish is its own heart - that is what the report counts', async () => {
  await heart(other);
  const n = (await db.query<{ n: number }>(`select count(distinct bill_id)::int n from guest_favourite where menu_item_id = $1`, [dish])).rows[0]!.n;
  expect(n).toBe(2);
});

test('un-hearting removes it', async () => {
  await db.query(`delete from guest_favourite where bill_id = $1 and menu_item_id = $2`, [other, dish]);
  expect((await db.query(`select 1 from guest_favourite where bill_id = $1`, [other])).rows).toHaveLength(0);
});

test('a dish deleted from the menu keeps its hearts, under its own name', async () => {
  // A dish is referenced elsewhere (kot_item, cart lines); clear only what would block the delete.
  await db.exec(`delete from guest_cart_line where menu_item_id = '${dish}'`);
  await db.query(`update guest_favourite set item_name = 'Chicken Biryani' where bill_id = $1`, [bill]);
  await db.query(`delete from menu_item where id = $1`, [dish]);
  const row = (await db.query<{ menu_item_id: string | null; item_name: string }>(`select menu_item_id, item_name from guest_favourite where bill_id = $1`, [bill])).rows;
  expect(row).toEqual([{ menu_item_id: null, item_name: 'Chicken Biryani' }]);
});

test('an empty name is refused, so the report never shows a blank dish', async () => {
  await expect(
    db.query(`insert into guest_favourite (restaurant_id, bill_id, item_name) values ($1, $2, '  ')`, [restaurant, other])
  ).rejects.toThrow(/check constraint/);
});

test('RLS is on, the default grants are revoked, and the browser roles can neither read nor write', async () => {
  // The grants Supabase's default privileges hand out are gone again for this table.
  const granted = (await db.query<{ n: number }>(
    `select count(*)::int n from information_schema.role_table_grants where table_name = 'guest_favourite' and grantee in ('anon', 'authenticated')`
  )).rows[0]!.n;
  expect(granted).toBe(0);
  const rls = (await db.query<{ rls: boolean }>(`select relrowsecurity rls from pg_class where relname = 'guest_favourite'`)).rows[0]!.rls;
  expect(rls).toBe(true);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query(`select * from public.guest_favourite`)).rejects.toThrow(/permission denied/);
      await expect(
        db.query(`insert into public.guest_favourite (restaurant_id, bill_id, item_name) values ($1, $2, 'x')`, [restaurant, bill])
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  }
});

test('a heart moves its bill\'s version - the counter every phone at the table polls', async () => {
  const v = async () => Number((await db.query<{ v: number }>(`select version::bigint v from bill where id = $1`, [other])).rows[0]!.v);
  const before = await v();
  await db.query(`insert into guest_favourite (restaurant_id, bill_id, item_name) values ($1, $2, 'Naan')`, [restaurant, other]);
  expect(await v()).toBeGreaterThan(before);
  await db.query(`delete from guest_favourite where bill_id = $1 and item_name = 'Naan'`, [other]);
  expect(await v(), 'un-hearting moves it too').toBeGreaterThan(before + 1);
});
