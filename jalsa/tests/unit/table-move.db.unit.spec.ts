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

/** A table by name - created for this file when the seed has none by that name (N11 and up). */
const tableId = async (name: string): Promise<string> => {
  const found = (await db.query<{ id: string }>(`select id from dining_table where name = $1 and restaurant_id = $2`, [name, restaurant])).rows[0];
  if (found) return found.id;
  return (await db.query<{ id: string }>(
    `insert into dining_table (restaurant_id, name, zone, seats) values ($1, $2, 'Non-AC', 4) returning id`,
    [restaurant, name]
  )).rows[0]!.id;
};

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

  // Every round goes to A2, the served one too. SUPERSEDED 12-Oct-2026 (code review, same day):
  // asserted the served round stayed at A1 - but separating a table from a group moves "the rounds
  // that table ate" by kot.table_id, so food left behind would have been billed to the wrong party.
  const kots = (await db.query<{ id: string; table_id: string; status: string }>(`select id, table_id, status from kot where bill_id = $1`, [bill])).rows;
  expect(kots.find((k) => k.id === cooking)).toMatchObject({ table_id: a2, status: 'preparing' });
  expect(kots.find((k) => k.id === served)).toMatchObject({ table_id: a2, status: 'served' });

  // The party's phone follows, remembering where it came from; the open request follows.
  expect((await db.query(`select table_id, moved_from_table_id from guest_session where bill_id = $1`, [bill])).rows).toEqual([
    { table_id: a2, moved_from_table_id: a1 },
  ]);
  expect((await db.query(`select table_id from table_request where bill_id = $1`, [bill])).rows).toEqual([{ table_id: a2 }]);

  // Same bill, same code and lines, status unchanged; host table is the new one.
  const b = (await db.query<{ code: string; status: string; host_table_id: string }>(`select code, status, host_table_id from bill where id = $1`, [bill])).rows[0]!;
  expect(b).toEqual({ code: 'B-MV1', status: 'open', host_table_id: a2 });
  expect((await db.query(`select ki.* from kot_item ki join kot k on k.id = ki.kot_id where k.bill_id = $1 order by ki.id`, [bill])).rows).toEqual(lines);

  // One audit row, in words. SUPERSEDED 12-Oct-2026 (copy review, same day): asserted action 'Table moved'
  // and the detail '... to A2 - 1 round still to come now go to A2'.
  const audit = (await db.query<{ action: string; detail: string; actor_label: string; table_id: string }>(
    `select action, detail, actor_label, table_id from audit_entry where bill_id = $1 and action = 'Order moved'`,
    [bill]
  )).rows;
  expect(audit).toEqual([
    { action: 'Order moved', detail: 'B-MV1 moved from A1 to A2 (1 round still to come now at A2)', actor_label: 'Ravi', table_id: a2 },
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

/* ── Review, 12-Oct-2026 (permission review) ────────────────────────────────────────────────────
   FAIL-FIRST (observed 12-Oct-2026 against the migration as first committed, fcf5b8e): "phones of
   another running order" moved ('moved', Expected 'taken'); "moved twice" left the marker on the
   middle table; "a captain the owner revoked it from" was granted it again; no audit line named the
   captains. NOT OBSERVED FAILING: the other-restaurant cases - the scoping held by reading and now
   holds by test. */

test("another restaurant's order or table is never reached: 'gone' and 'unavailable', nothing changes", async () => {
  const other = (await db.query<{ id: string }>(
    `insert into restaurant (slug, legal_name, display_name) values ('elsewhere', 'Elsewhere', 'Elsewhere') returning id`
  )).rows[0]!.id;
  const theirTable = (await db.query<{ id: string }>(
    `insert into dining_table (restaurant_id, name, zone, seats) values ($1, 'Z1', 'Hall', 4) returning id`,
    [other]
  )).rows[0]!.id;
  const theirBill = (await db.query<{ id: string }>(
    `insert into bill (restaurant_id, code, host_table_id, guests, tax_rate) values ($1, 'Z-1', $2, 2, 5) returning id`,
    [other, theirTable]
  )).rows[0]!.id;
  await db.query(`insert into bill_table (bill_id, table_id) values ($1, $2)`, [theirBill, theirTable]);

  const { bill, table } = await seatOrder('N5', 'B-MV8');
  const mine = await snapshot(bill);
  const theirs = await snapshot(theirBill);
  expect(await move(bill, table, theirTable)).toBe('unavailable');
  expect(await move(theirBill, theirTable, await tableId('N6'))).toBe('gone');
  expect(await snapshot(bill)).toBe(mine);
  expect(await snapshot(theirBill)).toBe(theirs);
});

test('onto a table where phones still belong to another running order: refused', async () => {
  const { bill, table } = await seatOrder('N7', 'B-MV9');
  const other = await seatOrder('N8', 'B-MV10');
  const n9 = await tableId('N9');
  // A table detached from a group leaves the group's phone behind on it, on the group's bill.
  await db.query(`insert into guest_session (restaurant_id, token, table_id, bill_id) values ($1, 'tok-left-behind', $2, $3)`, [
    restaurant,
    n9,
    other.bill,
  ]);
  const before = await snapshot(bill);
  expect(await move(bill, table, n9)).toBe('taken');
  expect(await snapshot(bill)).toBe(before);
});

test('moved twice before the phone opened the middle table: it still remembers the table it is showing', async () => {
  const { bill, table: first } = await seatOrder('N10', 'B-MV11');
  const middle = await tableId('A9');
  const last = await tableId('A10');
  expect(await move(bill, first, middle)).toBe('moved');
  await db.query(`update bill_table set cleared_at = now(), cleared_by = 'Ravi' where table_id = $1 and released_at is not null`, [first]);
  expect(await move(bill, middle, last)).toBe('moved');
  expect((await db.query(`select table_id, moved_from_table_id from guest_session where bill_id = $1`, [bill])).rows).toEqual([
    { table_id: last, moved_from_table_id: first },
  ]);
});

test('the captain grant: this restaurant only, never to a captain the owner revoked it from, and written to the audit log', async () => {
  const fresh = new PGlite({ extensions: { pgcrypto } });
  await fresh.exec(SUPABASE_PRELUDE);
  await fresh.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;`);
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000')).sort();
  /* SUPERSEDED 27-Oct-2026: took `files.pop()` and asserted it was the move migration — true only
     while it was the newest file. Later migrations exist (20261027*), so the rung finds it by name
     and applies everything before it, then it, exactly as before. */
  const at = files.indexOf('20261012090000_jalsa_move_order_to_table.sql');
  expect(at).toBeGreaterThan(-1);
  const last = files[at]!;
  files.splice(at);
  for (const f of files) await fresh.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));

  const home = (await fresh.query<{ id: string }>(`select id from restaurant where slug = 'jalsa-hosur'`)).rows[0]!.id;
  const captains = (await fresh.query<{ id: string; name: string }>(
    `select id, name from staff where restaurant_id = $1 and role = 'Captain' order by name`,
    [home]
  )).rows;
  expect(captains.length).toBeGreaterThan(1);
  const [revoked, ...kept] = captains;
  // The owner ticked it once and took it away again: no row, only the audit line Module access writes.
  await fresh.query(
    `insert into audit_entry (restaurant_id, action, detail, actor_label, confidential)
       values ($1, 'Permission', $2, 'Javeed', true)`,
    [home, `${revoked!.name} — revoked: tables.transfer`]
  );
  // A captain at another restaurant: not this restaurant's owner's choice.
  const other = (await fresh.query<{ id: string }>(`insert into restaurant (slug, legal_name, display_name) values ('elsewhere', 'Elsewhere', 'Elsewhere') returning id`)).rows[0]!.id;
  const outsider = (await fresh.query<{ id: string }>(
    `insert into staff (restaurant_id, name, role) values ($1, 'Outsider', 'Captain') returning id`,
    [other]
  )).rows[0]!.id;

  await fresh.exec(readFileSync(`${MIGRATIONS}/${last}`, 'utf8'));

  const holds = async (staff: string) =>
    (await fresh.query(`select 1 from staff_permission where staff_id = $1 and perm_key = 'tables.transfer' and granted`, [staff])).rows.length === 1;
  expect(await holds(revoked!.id)).toBe(false);
  for (const c of kept) expect(await holds(c.id), c.name).toBe(true);
  expect(await holds(outsider)).toBe(false);

  const audit = (await fresh.query<{ detail: string; confidential: boolean; actor_label: string }>(
    `select detail, confidential, actor_label from audit_entry where restaurant_id = $1 and action = 'Permission' and actor_label = 'setup'`,
    [home]
  )).rows;
  expect(audit).toHaveLength(1);
  expect(audit[0]!.confidential).toBe(true);
  expect(audit[0]!.detail).toBe(
    `Captains — granted: tables.transfer (move an order to another table, the owner's choice of 12-Oct-2026): ${kept.map((c) => c.name).join(', ')}`
  );
  await fresh.close();
});

/* ── Review, 12-Oct-2026 (code review) ──────────────────────────────────────────────────────────
   FAIL-FIRST (observed 12-Oct-2026 against the migration before this review): "a party phone with
   no order yet" stayed on the old table; "a cart left on a paid order" was refused 'taken' while the
   floor offered the table; "one key" found two foreign keys from guest_session to dining_table.
   NOT OBSERVED FAILING: "a paid or closed order" - 'gone' held for closed bills already. */

test('a party phone with no order yet comes along; a stale phone from long before stays', async () => {
  const { bill, table } = await seatOrder('N11', 'B-MV12');
  const pocket = (await db.query<{ id: string }>(
    `insert into guest_session (restaurant_id, token, table_id) values ($1, 'tok-pocket', $2) returning id`,
    [restaurant, table]
  )).rows[0]!.id;
  const stale = (await db.query<{ id: string }>(
    `insert into guest_session (restaurant_id, token, table_id, last_seen_at) values ($1, 'tok-last-week', $2, now() - interval '7 days') returning id`,
    [restaurant, table]
  )).rows[0]!.id;
  const to = await tableId('N12');
  expect(await move(bill, table, to)).toBe('moved');
  const row = async (id: string) =>
    (await db.query(`select table_id, bill_id, moved_from_table_id from guest_session where id = $1`, [id])).rows[0];
  expect(await row(pocket)).toEqual({ table_id: to, bill_id: bill, moved_from_table_id: table });
  expect(await row(stale)).toEqual({ table_id: table, bill_id: null, moved_from_table_id: null });
});

test("a cart left on a paid order does not hold a table - the floor's rule and the server's agree", async () => {
  const { bill, table } = await seatOrder('N13', 'B-MV13');
  const paid = await seatOrder('N14', 'B-MV14');
  await db.query(`update bill set status = 'closed', closed_at = now(), closed_by_staff_id = $2, payment_mode = 'Cash' where id = $1`, [paid.bill, staffId]);
  await db.query(`update bill_table set cleared_at = now(), cleared_by = 'Ravi' where bill_id = $1`, [paid.bill]);
  const phone = (await db.query<{ id: string }>(`select id from guest_session where bill_id = $1`, [paid.bill])).rows[0]!.id;
  const item = (await db.query<{ id: string }>(`select id from menu_item limit 1`)).rows[0]!.id;
  await db.query(`insert into guest_cart_line (session_id, menu_item_id, qty) values ($1, $2, 1)`, [phone, item]);
  expect(await move(bill, table, paid.table)).toBe('moved');
});

test('a paid order is refused too, and nothing changes', async () => {
  const { bill, table } = await seatOrder('N15', 'B-MV15');
  await db.query(`update bill set status = 'closed', closed_at = now(), closed_by_staff_id = $2, payment_mode = 'Cash' where id = $1`, [bill, staffId]);
  const before = await snapshot(bill);
  expect(await move(bill, table, await tableId('N16'))).toBe('gone');
  expect(await snapshot(bill)).toBe(before);
});

test('one key from a phone to its table: a second would make every unhinted PostgREST embed ambiguous', async () => {
  const keys = (await db.query<{ n: number }>(`
    select count(*)::int n from pg_constraint
     where contype = 'f' and conrelid = 'public.guest_session'::regclass and confrelid = 'public.dining_table'::regclass`)).rows[0]!.n;
  expect(keys).toBe(1);
});

