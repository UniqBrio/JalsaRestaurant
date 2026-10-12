/**
 * Move a running order to another table - in the database (12-Oct-2026,
 * 20261012090000_jalsa_move_order_to_table).
 *
 * Every migration runs on PGlite, after Supabase's default privileges are emulated. The move must
 * happen together or not at all, only onto a FREE table, take with it everything still to come
 * (rounds not yet served, the party's phones, open requests), leave history where it happened,
 * leave the old table needing clearing, and write one audit row. Nothing is deleted.
 *
 * FAIL-FIRST: run against the tree before this migration, every case fails at the first call -
 * `function move_bill_to_table(...) does not exist` (observed 12-Oct-2026).
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

const SUPABASE_PRELUDE = `
  create schema extensions; create extension pgcrypto with schema extensions;
  create schema auth; create table auth.users (id uuid primary key);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  set search_path = public, extensions;
`;

let db: PGlite;
let restaurant = '';
let staffId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;`);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000')).sort()) {
    await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  }
  restaurant = (await db.query<{ id: string }>(`select id from restaurant limit 1`)).rows[0]!.id;
  staffId = (await db.query<{ id: string }>(`select id from staff where restaurant_id = $1 limit 1`, [restaurant])).rows[0]!.id;
});

const tableId = async (name: string) =>
  (await db.query<{ id: string }>(`select id from dining_table where name = $1 and restaurant_id = $2`, [name, restaurant])).rows[0]!.id;

/** An order on a table: two rounds (one cooking, one served), lines, tickets, a phone, a request. */
async function seatOrder(tableName: string, code: string): Promise<{ bill: string; table: string; cooking: string; served: string }> {
  const table = await tableId(tableName);
  const bill = (
    await db.query<{ id: string }>(
      `insert into bill (restaurant_id, code, host_table_id, guests, tax_rate) values ($1, $2, $3, 2, 5) returning id`,
      [restaurant, code, table]
    )
  ).rows[0]!.id;
  await db.query(`insert into bill_table (bill_id, table_id) values ($1, $2)`, [bill, table]);
  const kots: string[] = [];
  for (const [n, status] of [
    [1, 'preparing'],
    [2, 'served'],
  ] as const) {
    const kot = (
      await db.query<{ id: string }>(
        `insert into kot (restaurant_id, bill_id, table_id, code, status, source) values ($1, $2, $3, $4, $5, 'captain') returning id`,
        [restaurant, bill, table, `${code}-K${n}`, status]
      )
    ).rows[0]!.id;
    await db.query(`insert into kot_item (kot_id, name, unit_price, food_type, qty) values ($1, 'Chicken 65', 240, 'non_veg', 2)`, [kot]);
    await db.query(`insert into print_job (restaurant_id, kind, kot_id, bill_id, status) values ($1, 'KOT', $2, $3, $4)`, [
      restaurant,
      kot,
      bill,
      n === 1 ? 'queued' : 'printed',
    ]);
    kots.push(kot);
  }
  await db.query(`insert into guest_session (restaurant_id, token, table_id, bill_id) values ($1, $2, $3, $4)`, [
    restaurant,
    `tok-${code}`,
    table,
    bill,
  ]);
  await db.query(`insert into table_request (restaurant_id, table_id, bill_id, kind) values ($1, $2, $3, 'Water')`, [
    restaurant,
    table,
    bill,
  ]);
  return { bill, table, cooking: kots[0]!, served: kots[1]! };
}

const move = async (bill: string, from: string, to: string) =>
  (
    await db.query<{ r: string }>(`select move_bill_to_table($1, $2, $3, $4, $5, 'Ravi') as r`, [restaurant, bill, from, to, staffId])
  ).rows[0]!.r;

/** Everything a refused move must leave exactly as it was. */
const snapshot = async (bill: string) =>
  JSON.stringify([
    (await db.query(`select table_id, released_at, cleared_at from bill_table where bill_id = $1 order by table_id`, [bill])).rows,
    (await db.query(`select id, table_id, status from kot where bill_id = $1 order by id`, [bill])).rows,
    (await db.query(`select table_id, moved_from_table_id from guest_session where bill_id = $1`, [bill])).rows,
    (await db.query(`select table_id from table_request where bill_id = $1`, [bill])).rows,
    (await db.query(`select host_table_id, status from bill where id = $1`, [bill])).rows,
    (await db.query(`select count(*)::int n from audit_entry where bill_id = $1`, [bill])).rows,
  ]);

test('the order moves to the free table, with everything still to come - and history stays put', async () => {
  const { bill, table: a1, cooking, served } = await seatOrder('A1', 'B-MV1');
  const a2 = await tableId('A2');
  const lines = (await db.query(`select ki.* from kot_item ki join kot k on k.id = ki.kot_id where k.bill_id = $1 order by ki.id`, [bill])).rows;

  expect(await move(bill, a1, a2)).toBe('moved');

  // The bill is on A2 now; A1 is released and waits to be cleared of the plates left on it.
  const membership = (await db.query<{ table_id: string; released_at: string | null; cleared_at: string | null }>(
    `select table_id, released_at, cleared_at from bill_table where bill_id = $1`,
    [bill]
  )).rows;
  expect(membership.find((m) => m.table_id === a2)).toMatchObject({ released_at: null, cleared_at: null });
  expect(membership.find((m) => m.table_id === a1)?.released_at).not.toBeNull();
  expect(membership.find((m) => m.table_id === a1)?.cleared_at).toBeNull();

  // The round still cooking goes to A2; the served one stays history at A1.
  const kots = (await db.query<{ id: string; table_id: string }>(`select id, table_id from kot where bill_id = $1`, [bill])).rows;
  expect(kots.find((k) => k.id === cooking)?.table_id).toBe(a2);
  expect(kots.find((k) => k.id === served)?.table_id).toBe(a1);

  // The party's phone follows, remembering where it came from; the open request follows.
  expect((await db.query(`select table_id, moved_from_table_id from guest_session where bill_id = $1`, [bill])).rows).toEqual([
    { table_id: a2, moved_from_table_id: a1 },
  ]);
  expect((await db.query(`select table_id from table_request where bill_id = $1`, [bill])).rows).toEqual([{ table_id: a2 }]);

  // Same bill, same code and lines, status unchanged; host table is the new one.
  const b = (await db.query<{ code: string; status: string; host_table_id: string }>(`select code, status, host_table_id from bill where id = $1`, [bill])).rows[0]!;
  expect(b).toEqual({ code: 'B-MV1', status: 'open', host_table_id: a2 });
  expect((await db.query(`select ki.* from kot_item ki join kot k on k.id = ki.kot_id where k.bill_id = $1 order by ki.id`, [bill])).rows).toEqual(lines);

  // One audit row, in words.
  const audit = (await db.query<{ action: string; detail: string; actor_label: string; table_id: string }>(
    `select action, detail, actor_label, table_id from audit_entry where bill_id = $1 and action = 'Table moved'`,
    [bill]
  )).rows;
  expect(audit).toEqual([
    { action: 'Table moved', detail: 'B-MV1 moved from A1 to A2 - 1 round still to come now go to A2', actor_label: 'Ravi', table_id: a2 },
  ]);
});

test('onto a table with its own order: refused, and nothing changes', async () => {
  const { bill, table } = await seatOrder('A3', 'B-MV2');
  const other = await seatOrder('A4', 'B-MV3');
  const before = await snapshot(bill);
  expect(await move(bill, table, other.table)).toBe('taken');
  expect(await snapshot(bill)).toBe(before);
});

test('onto a table still waiting to be cleared: refused - clear it first', async () => {
  // A1 was left needing clearing by the first case.
  const { bill, table } = await seatOrder('A5', 'B-MV4');
  const before = await snapshot(bill);
  expect(await move(bill, table, await tableId('A1'))).toBe('needs_clearing');
  expect(await snapshot(bill)).toBe(before);
});

test("onto a table where a phone has an unsent order: refused - that phone would see this bill", async () => {
  const { bill, table } = await seatOrder('A6', 'B-MV5');
  const a7 = await tableId('A7');
  const session = (await db.query<{ id: string }>(
    `insert into guest_session (restaurant_id, token, table_id) values ($1, 'tok-stranger', $2) returning id`,
    [restaurant, a7]
  )).rows[0]!.id;
  const item = (await db.query<{ id: string }>(`select id from menu_item limit 1`)).rows[0]!.id;
  await db.query(`insert into guest_cart_line (session_id, menu_item_id, qty) values ($1, $2, 1)`, [session, item]);
  const before = await snapshot(bill);
  expect(await move(bill, table, a7)).toBe('taken');
  expect(await snapshot(bill)).toBe(before);
});

test('a table that no longer holds the order, a paid or cancelled order, the same table, a table off the floor: nothing changes', async () => {
  const { bill, table } = await seatOrder('A8', 'B-MV6');
  const free = await tableId('N1');
  const before = await snapshot(bill);
  expect(await move(bill, await tableId('N2'), free)).toBe('not_here');
  expect(await move(bill, table, table)).toBe('same');
  await db.query(`update dining_table set active = false where id = $1`, [free]);
  expect(await move(bill, table, free)).toBe('unavailable');
  await db.query(`update dining_table set active = true where id = $1`, [free]);
  expect(await snapshot(bill)).toBe(before);

  await db.query(`update bill set status = 'void', cancelled_at = now(), cancelled_by_label = 'Ravi', cancel_reason = 'Order mistake' where id = $1`, [bill]);
  const voided = await snapshot(bill);
  expect(await move(bill, table, free)).toBe('gone');
  expect(await snapshot(bill)).toBe(voided);
});

test('moved back to a table it was on before (once cleared): the old row is reused, never duplicated', async () => {
  const { bill, table: n3 } = await seatOrder('N3', 'B-MV7');
  const n4 = await tableId('N4');
  expect(await move(bill, n3, n4)).toBe('moved');
  await db.query(`update bill_table set cleared_at = now(), cleared_by = 'Ravi' where table_id = $1 and released_at is not null`, [n3]);
  expect(await move(bill, n4, n3)).toBe('moved');
  const rows = (await db.query<{ table_id: string; released_at: string | null }>(
    `select table_id, released_at from bill_table where bill_id = $1 order by joined_at`,
    [bill]
  )).rows;
  expect(rows).toHaveLength(2);
  expect(rows.find((r) => r.table_id === n3)?.released_at).toBeNull();
  expect(rows.find((r) => r.table_id === n4)?.released_at).not.toBeNull();
});

test('only the server can call it: EXECUTE for service_role, never anon or authenticated', async () => {
  const r = (await db.query<{ anon: boolean; auth: boolean; service: boolean }>(`
    select has_function_privilege('anon', p.oid, 'execute') anon,
           has_function_privilege('authenticated', p.oid, 'execute') auth,
           has_function_privilege('service_role', p.oid, 'execute') service
      from pg_proc p where p.proname = 'move_bill_to_table'`)).rows;
  expect(r).toEqual([{ anon: false, auth: false, service: true }]);
});

test('every captain may move a party, and every owner already could', async () => {
  const missing = (await db.query(`
    select st.name, st.role from staff st
     where st.role in ('Captain', 'Owner / Admin')
       and not exists (select 1 from staff_permission p where p.staff_id = st.id and p.perm_key = 'tables.transfer' and p.granted)`)).rows;
  expect(missing).toEqual([]);
  expect(Number((await db.query<{ n: string }>(`select count(*) n from staff where role = 'Captain'`)).rows[0]!.n)).toBeGreaterThan(0);
});
