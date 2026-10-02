/**
 * Takeaway against a real Postgres (02-Oct-2026).
 *
 * Every migration in filename order on PGlite, over the seed's bills and rounds. The database is
 * where "no dummy table" and "no undecided tax" are enforced, so these cases try to break them.
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
const rows = async <T = Record<string, unknown>>(sql: string): Promise<T[]> => (await db.query<T>(sql)).rows;
const one = async <T = Record<string, unknown>>(sql: string): Promise<T> => {
  const r = (await rows<T>(sql))[0];
  if (!r) throw new Error(`no row: ${sql}`);
  return r;
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  /* A REALISTIC EXISTING DATABASE: everything before the takeaway migration, then a dine-in bill
     with its table, a round on it and a line - the shape every live bill has - and only then
     the migration under test, so its backfill and its new rules meet real rows. */
  const takeaway = '20261002100000_jalsa_takeaway.sql';
  for (const f of files.filter((f) => f < takeaway)) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  await db.exec(`
    insert into bill (restaurant_id, code, host_table_id, guests, tax_rate)
      select r.id, 'B-OLD', t.id, 2, 5 from restaurant r, dining_table t where t.name = 'A5' limit 1;
    insert into bill_table (bill_id, table_id) select b.id, b.host_table_id from bill b where b.code = 'B-OLD';
    insert into kot (restaurant_id, bill_id, table_id, code, source)
      select restaurant_id, id, host_table_id, 'KOT-OLD', 'captain' from bill where code = 'B-OLD';
    insert into kot_item (kot_id, name, unit_price, qty, food_type)
      select id, 'Paneer 65', 130, 1, 'veg' from kot where code = 'KOT-OLD';
  `);
  for (const f of files.filter((f) => f >= takeaway)) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
});

test('every existing bill is dine-in with no packaging charge, and every existing round keeps its table', async () => {
  const bills = await one<{ n: number; dine: number; zero: number }>(
    `select count(*)::int n, count(*) filter (where order_type = 'dine_in')::int dine,
            count(*) filter (where packaging_charge = 0 and packaging_taxable is null)::int zero from bill`
  );
  expect(bills.n).toBeGreaterThan(0);
  expect(bills.dine).toBe(bills.n);
  expect(bills.zero).toBe(bills.n);
  expect((await one<{ n: number }>(`select count(*)::int n from kot where table_id is null`)).n).toBe(0);
});

let takeawayId = '';

test('a takeaway bill has no table, and its round has no table', async () => {
  const b = await one<{ id: string }>(`
    insert into bill (restaurant_id, code, order_type, host_table_id, guests, tax_rate, packaging_charge, packaging_taxable)
      select id, 'TK-1', 'takeaway', null, 1, 5, 40, false from restaurant limit 1
    returning id`);
  takeawayId = b.id;
  await db.exec(`
    insert into kot (restaurant_id, bill_id, table_id, code, source)
      select restaurant_id, id, null, 'KOT-T1', 'owner' from bill where id = '${takeawayId}'`);
  expect((await one<{ n: number }>(`select count(*)::int n from kot where bill_id = '${takeawayId}' and table_id is null`)).n).toBe(1);
});

test('a takeaway cannot be given a table - not as its host, not by joining one', async () => {
  const [t] = await rows<{ id: string }>(`select id from dining_table limit 1`);
  await expect(db.exec(`update bill set host_table_id = '${t!.id}' where id = '${takeawayId}'`)).rejects.toThrow(
    /bill_takeaway_has_no_table/
  );
  await expect(db.exec(`insert into bill_table (bill_id, table_id) values ('${takeawayId}', '${t!.id}')`)).rejects.toThrow(
    /not at a table/
  );
  await expect(
    db.exec(`insert into kot (restaurant_id, bill_id, table_id, code, source)
               select restaurant_id, id, '${t!.id}', 'KOT-T2', 'owner' from bill where id = '${takeawayId}'`)
  ).rejects.toThrow(/not at a table/);
});

test('a dine-in round must still name its table', async () => {
  await expect(
    db.exec(`insert into kot (restaurant_id, bill_id, table_id, code, source)
               select restaurant_id, id, null, 'KOT-D1', 'captain' from bill where order_type = 'dine_in' limit 1`)
  ).rejects.toThrow(/must name its table/);
});

test('a bill never changes order type', async () => {
  await expect(db.exec(`update bill set order_type = 'dine_in' where id = '${takeawayId}'`)).rejects.toThrow(
    /order type cannot change/
  );
});

test('a packaging charge cannot be negative, nor stored with its GST treatment undecided', async () => {
  await expect(db.exec(`update bill set packaging_charge = -50 where id = '${takeawayId}'`)).rejects.toThrow(
    /bill_packaging_non_negative/
  );
  await expect(
    db.exec(`update bill set packaging_charge = 40, packaging_taxable = null where id = '${takeawayId}'`)
  ).rejects.toThrow(/bill_packaging_tax_decided/);
  // Zero needs no decision.
  await db.exec(`update bill set packaging_charge = 0, packaging_taxable = null where id = '${takeawayId}'`);
});

test('closing a takeaway works like any bill - there are no tables to release', async () => {
  const [s] = await rows<{ id: string }>(`select id from staff limit 1`);
  await db.exec(`update bill set status = 'closed', closed_at = now(), closed_by_staff_id = '${s!.id}', payment_mode = 'Cash'
                  where id = '${takeawayId}'`);
  expect((await one<{ status: string }>(`select status from bill where id = '${takeawayId}'`)).status).toBe('closed');
});
