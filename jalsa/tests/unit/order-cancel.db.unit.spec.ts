/**
 * Cancel an order already with the kitchen, and free its table - in the database (07-Oct-2026,
 * 20261007090000_jalsa_order_cancel_and_takeaway_photo).
 *
 * Every migration runs on PGlite, after Supabase's default privileges are emulated. The function
 * must change the order and the table TOGETHER or not at all, refuse a completed, cancelled,
 * changed or moved order without touching anything, keep every line of the order, stop the
 * kitchen's work and waiting tickets, and leave exactly one audit row. Nothing is deleted.
 *
 * FAIL-FIRST: run against the tree before this migration, every case fails at the first call -
 * `function cancel_bill_and_free(unknown, ...) does not exist` (observed 07-Oct-2026).
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

/** An order on a table: a bill, two rounds (one cooking, one served), lines, tickets, a phone, a notice. */
async function seatOrder(tableName: string, code: string): Promise<{ bill: string; table: string }> {
  const table = await tableId(tableName);
  const bill = (
    await db.query<{ id: string }>(
      `insert into bill (restaurant_id, code, host_table_id, guests, tax_rate, discount_pct)
         values ($1, $2, $3, 2, 5, 10) returning id`,
      [restaurant, code, table]
    )
  ).rows[0]!.id;
  await db.query(`insert into bill_table (bill_id, table_id) values ($1, $2)`, [bill, table]);
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
    await db.query(
      `insert into kot_item (kot_id, name, unit_price, food_type, qty) values ($1, 'Chicken 65', 240, 'non_veg', 2), ($1, 'Lime soda', 80, 'veg', 1)`,
      [kot]
    );
    await db.query(
      `insert into print_job (restaurant_id, kind, kot_id, bill_id, status) values ($1, 'KOT', $2, $3, $4)`,
      [restaurant, kot, bill, n === 1 ? 'queued' : 'printed']
    );
  }
  await db.query(`insert into guest_session (restaurant_id, token, table_id, bill_id) values ($1, $2, $3, $4)`, [
    restaurant,
    `tok-${code}`,
    table,
    bill,
  ]);
  await db.query(`insert into table_request (restaurant_id, table_id, bill_id, kind) values ($1, $2, $3, 'Bill requested')`, [
    restaurant,
    table,
    bill,
  ]);
  return { bill, table };
}

const version = async (bill: string) =>
  Number((await db.query<{ version: string }>(`select version from bill where id = $1`, [bill])).rows[0]!.version);

/* SUPERSEDED 07-Oct-2026 (code review, same day): the function gained `p_expected_rounds` - the
   rounds the person saw when the dialog opened. This helper previously called the 9-argument
   form; it now passes null (no screen count) unless a case names one. */
const cancel = async (bill: string, table: string, v?: number, reason = 'Customer emergency', rounds: number | null = null) =>
  (
    await db.query<{ r: string }>(`select cancel_bill_and_free($1, $2, $3, $4, $5, 'Ravi', $6, '', 1234.50, $7) as r`, [
      restaurant,
      bill,
      table,
      v ?? (await version(bill)),
      staffId,
      reason,
      rounds,
    ])
  ).rows[0]!.r;

test('the order becomes cancelled and its table free, together - and nothing is deleted', async () => {
  const { bill, table } = await seatOrder('A5', 'B-CX1');
  const linesBefore = (await db.query(`select ki.* from kot_item ki join kot k on k.id = ki.kot_id where k.bill_id = $1 order by ki.id`, [bill])).rows;

  expect(await cancel(bill, table)).toBe('cancelled');

  const b = (await db.query<Record<string, unknown>>(`select * from bill where id = $1`, [bill])).rows[0]!;
  expect(b.status).toBe('void');
  expect(b.cancelled_at).not.toBeNull();
  expect(b.cancelled_by_staff_id).toBe(staffId);
  expect(b.cancelled_by_label).toBe('Ravi');
  expect(b.cancel_reason).toBe('Customer emergency');
  expect(b.cancelled_from_status).toBe('open');
  expect(Number(b.cancelled_total)).toBe(1234.5);
  // Not paid, so never "closed" - and the discount and tax rate are as they were.
  expect(b.closed_at).toBeNull();
  expect(b.payment_mode).toBeNull();
  expect(Number(b.discount_pct)).toBe(10);
  expect(Number(b.tax_rate)).toBe(5);

  // Every line kept, unchanged.
  const linesAfter = (await db.query(`select ki.* from kot_item ki join kot k on k.id = ki.kot_id where k.bill_id = $1 order by ki.id`, [bill])).rows;
  expect(linesAfter).toEqual(linesBefore);
  expect(linesAfter.length).toBe(4);

  // The table: released AND cleared, so it is free at once - not "needs clearing".
  const bt = (await db.query<{ released_at: unknown; cleared_at: unknown; cleared_by: string }>(`select * from bill_table where bill_id = $1`, [bill])).rows[0]!;
  expect(bt.released_at).not.toBeNull();
  expect(bt.cleared_at).not.toBeNull();
  expect(bt.cleared_by).toBe('Ravi');
  const held = (await db.query<{ n: number }>(`select count(*)::int n from bill_table where table_id = $1 and released_at is null`, [table])).rows[0]!.n;
  expect(held).toBe(0);
});

test('the kitchen stops: rounds still cooking are cancelled, served ones stay history, a waiting ticket will not print', async () => {
  const bill = (await db.query<{ id: string }>(`select id from bill where code = 'B-CX1'`)).rows[0]!.id;
  const kots = (await db.query<{ code: string; status: string; cancel_reason: string; cancelled_at: unknown }>(`select * from kot where bill_id = $1 order by code`, [bill])).rows;
  expect(kots.map((k) => [k.code, k.status])).toEqual([
    ['B-CX1-K1', 'cancelled'],
    ['B-CX1-K2', 'served'],
  ]);
  expect(kots[0]!.cancel_reason).toBe('Order cancelled: Customer emergency');
  expect(kots[0]!.cancelled_at).not.toBeNull();
  const jobs = (await db.query<{ status: string }>(`select status::text status from print_job where bill_id = $1 order by status`, [bill])).rows;
  // The printed ticket is evidence and stays printed; the waiting one can never be claimed.
  expect(jobs.map((j) => j.status)).toEqual(['cancelled', 'printed']);
  // And none can be queued again - not a retry, not a reprint, not "print elsewhere".
  const kot = (await db.query<{ id: string }>(`select id from kot where bill_id = $1 limit 1`, [bill])).rows[0]!.id;
  await expect(db.query(`update print_job set status = 'queued' where bill_id = $1`, [bill])).rejects.toThrow(/its tickets are not printed/);
  await expect(
    db.query(`insert into print_job (restaurant_id, kind, kot_id, bill_id, status, is_reprint) values ($1, 'KOT', $2, $3, 'queued', true)`, [restaurant, kot, bill])
  ).rejects.toThrow(/its tickets are not printed/);
});

test('the phone at the table is let go, the bill request is done, and one audit row says who, what, where and why', async () => {
  const { bill, table } = { bill: (await db.query<{ id: string }>(`select id from bill where code = 'B-CX1'`)).rows[0]!.id, table: await tableId('A5') };
  expect((await db.query<{ n: number }>(`select count(*)::int n from guest_session where table_id = $1`, [table])).rows[0]!.n).toBe(0);
  expect((await db.query<{ n: number }>(`select count(*)::int n from table_request where bill_id = $1 and done_at is null`, [bill])).rows[0]!.n).toBe(0);
  const audit = (await db.query<{ action: string; detail: string; table_id: string; actor_staff_id: string; actor_label: string }>(`select * from audit_entry where bill_id = $1`, [bill])).rows;
  expect(audit.length).toBe(1);
  expect(audit[0]!.action).toBe('Order cancelled');
  expect(audit[0]!.table_id).toBe(table);
  expect(audit[0]!.actor_staff_id).toBe(staffId);
  expect(audit[0]!.actor_label).toBe('Ravi');
  expect(audit[0]!.detail).toContain('B-CX1 cancelled while open');
  expect(audit[0]!.detail).toContain('open -> void');
  expect(audit[0]!.detail).toContain('A5 occupied -> free');
  expect(audit[0]!.detail).toContain('Reason: Customer emergency');
});

test('B: the second press, after the first succeeded, changes nothing and is told the order is gone', async () => {
  const bill = (await db.query<{ id: string }>(`select id from bill where code = 'B-CX1'`)).rows[0]!.id;
  const table = await tableId('A5');
  const snapshot = async () =>
    JSON.stringify([
      (await db.query(`select * from bill where id = $1`, [bill])).rows,
      (await db.query(`select * from audit_entry where bill_id = $1`, [bill])).rows,
    ]);
  const before = await snapshot();
  expect(await cancel(bill, table)).toBe('gone');
  expect(await snapshot()).toBe(before);
});

test('A: an order another person has just completed (closed) is refused, and stays closed', async () => {
  const { bill, table } = await seatOrder('A6', 'B-CX2');
  await db.query(`update bill set status = 'closed', closed_at = now(), closed_by_staff_id = $2, payment_mode = 'Cash' where id = $1`, [bill, staffId]);
  expect(await cancel(bill, table)).toBe('gone');
  const b = (await db.query<{ status: string; cancelled_at: unknown }>(`select status, cancelled_at from bill where id = $1`, [bill])).rows[0]!;
  expect(b.status).toBe('closed');
  expect(b.cancelled_at).toBeNull();
});

/* SUPERSEDED 07-Oct-2026 (code review, same day): this was named "a round added after the screen
   read the order is refused". The version it checks is the one the SERVER read a moment before
   the call - it guards the amount recorded, not what the person saw. What the person saw is the
   round count, proven in "a round the person never saw" below. Assertions unchanged. */
test('a change between the server reading the order and cancelling it is refused - the amount recorded is the order cancelled', async () => {
  const { bill, table } = await seatOrder('A7', 'B-CX3');
  const seen = await version(bill);
  const kot = (await db.query<{ id: string }>(`select id from kot where bill_id = $1 limit 1`, [bill])).rows[0]!.id;
  await db.query(`insert into kot_item (kot_id, name, unit_price, food_type, qty) values ($1, 'Biryani', 300, 'non_veg', 1)`, [kot]);
  expect(await cancel(bill, table, seen)).toBe('changed');
  expect((await db.query<{ status: string }>(`select status from bill where id = $1`, [bill])).rows[0]!.status).toBe('open');
  // Read again, it goes through - from "payment requested" too.
  await db.query(`update bill set status = 'payment_requested', payment_requested_at = now() where id = $1`, [bill]);
  expect(await cancel(bill, table)).toBe('cancelled');
  expect((await db.query<{ f: string }>(`select cancelled_from_status f from bill where id = $1`, [bill])).rows[0]!.f).toBe('payment_requested');
});

test('C: a new party\'s order on the same table is never the one released', async () => {
  // A5's old order was cancelled above; a new party sits down there.
  const fresh = await seatOrder('A5', 'B-CX4');
  const oldBill = (await db.query<{ id: string }>(`select id from bill where code = 'B-CX1'`)).rows[0]!.id;
  // A stale screen still pointing at the old order, on the same table.
  expect(await cancel(oldBill, fresh.table)).toBe('gone');
  // A wrong table for a live order: refused too.
  const other = await tableId('A6');
  expect(await cancel(fresh.bill, other)).toBe('not_here');
  const bt = (await db.query<{ released_at: unknown }>(`select released_at from bill_table where bill_id = $1`, [fresh.bill])).rows[0]!;
  expect(bt.released_at).toBeNull();
  expect((await db.query<{ status: string }>(`select status from bill where id = $1`, [fresh.bill])).rows[0]!.status).toBe('open');
});

/* SUPERSEDED 07-Oct-2026 (permission review, same day): this passed a random uuid as the
   restaurant. It now names a REAL second restaurant, with this restaurant's bill on this
   restaurant's table, and passes the 10-argument form. */
test('another restaurant\'s order cannot be reached through this one', async () => {
  const fresh = (await db.query<{ id: string }>(`select id from bill where code = 'B-CX4'`)).rows[0]!.id;
  const table = await tableId('A5');
  const other = (
    await db.query<{ id: string }>(`insert into restaurant (slug, legal_name, display_name) values ('other-place', 'Other Place', 'Other') returning id`)
  ).rows[0]!.id;
  const r = (
    await db.query<{ r: string }>(`select cancel_bill_and_free($4, $1, $2, $3, null, 'X', 'Other', '', 0, null) r`, [fresh, table, await version(fresh), other])
  ).rows[0]!.r;
  expect(r).toBe('gone');
  expect((await db.query<{ status: string }>(`select status from bill where id = $1`, [fresh])).rows[0]!.status).toBe('open');
});

test('the database refuses a cancellation stamp without a void status or a person, and a photo on a dine-in bill', async () => {
  const fresh = (await db.query<{ id: string }>(`select id from bill where code = 'B-CX4'`)).rows[0]!.id;
  await expect(db.query(`update bill set cancelled_at = now(), cancelled_by_label = 'Ravi', cancel_reason = 'x' where id = $1`, [fresh])).rejects.toThrow(/bill_cancel_is_attributed/);
  await expect(db.query(`update bill set status = 'void', cancelled_at = now(), cancel_reason = 'x' where id = $1`, [fresh])).rejects.toThrow(/bill_cancel_is_attributed/);
  await expect(db.query(`update bill set photo_url = '/api/media/takeaway/x/y.jpg' where id = $1`, [fresh])).rejects.toThrow(/bill_photo_is_takeaway/);
});

test('only the server may call it: the browser roles have no EXECUTE', async () => {
  const sig = 'public.cancel_bill_and_free(uuid, uuid, uuid, bigint, uuid, text, text, text, numeric, int)';
  for (const role of ['anon', 'authenticated']) {
    const r = (await db.query<{ ok: boolean }>(`select has_function_privilege($1, $2, 'execute') ok`, [role, sig])).rows[0]!.ok;
    expect(r, role).toBe(false);
  }
  expect((await db.query<{ ok: boolean }>(`select has_function_privilege('service_role', $1, 'execute') ok`, [sig])).rows[0]!.ok).toBe(true);
});

/* ── Code review, 07-Oct-2026 ──────────────────────────────────────────────────────────────────
   FAIL-FIRST: against the migration as first committed (678c0d9) this file fails at its first
   call - the 10-argument function does not exist there (observed 07-Oct-2026). NOT OBSERVED
   FAILING on their own: the cases below, because the serial file stops before reaching them. By
   reading that migration: no round count, the tip untouched, failed tickets left failed, the raw
   "payment_requested" in the audit, and no trigger on kot / bill_table / print_job. */

test('a round the person never saw makes it "changed"; the rounds they saw let it through', async () => {
  const { bill, table } = await seatOrder('N1', 'B-CX5');
  expect(await cancel(bill, table, undefined, 'Order mistake', 1)).toBe('changed');
  expect((await db.query<{ status: string }>(`select status from bill where id = $1`, [bill])).rows[0]!.status).toBe('open');
  expect(await cancel(bill, table, undefined, 'Order mistake', 2)).toBe('cancelled');
});

test('an uncollected tip leaves the tips ledger, its amount kept in the audit line; a failed ticket is cancelled too', async () => {
  const { bill, table } = await seatOrder('N2', 'B-CX6');
  await db.query(`insert into tip (restaurant_id, bill_id, amount, staff_id) values ($1, $2, 100, $3)`, [restaurant, bill, staffId]);
  await db.query(`update print_job set status = 'failed', last_error = 'Paper out' where bill_id = $1 and status = 'queued'`, [bill]);
  await db.query(`update bill set status = 'payment_requested', payment_requested_at = now() where id = $1`, [bill]);
  expect(await cancel(bill, table)).toBe('cancelled');
  expect((await db.query<{ n: number }>(`select count(*)::int n from tip where bill_id = $1`, [bill])).rows[0]!.n).toBe(0);
  const jobs = (await db.query<{ status: string; last_error: string }>(`select status::text status, last_error from print_job where bill_id = $1 order by status`, [bill])).rows;
  expect(jobs.map((j) => j.status)).toEqual(['cancelled', 'printed']);
  expect(jobs[0]!.last_error).toContain('Before that: Paper out');
  const detail = (await db.query<{ detail: string }>(`select detail from audit_entry where bill_id = $1`, [bill])).rows[0]!.detail;
  expect(detail).toContain('Bill payment requested -> void');
  expect(detail).toContain('A tip of Rs 100.00 was not collected');
});

test('nothing new reaches a cancelled order: no round, no joined table - and a live bill still takes both', async () => {
  const dead = (await db.query<{ id: string }>(`select id from bill where code = 'B-CX6'`)).rows[0]!.id;
  const t = await tableId('N2');
  await expect(
    db.query(`insert into kot (restaurant_id, bill_id, table_id, code, status, source) values ($1, $2, $3, 'LATE-1', 'new', 'guest')`, [restaurant, dead, t])
  ).rejects.toThrow(/no longer open \(void\)/);
  await expect(db.query(`insert into bill_table (bill_id, table_id) values ($1, $2)`, [dead, await tableId('N3')])).rejects.toThrow(/no longer open/);
  // A closed bill is refused the same way; an open one is not.
  const live = await seatOrder('N4', 'B-CX7');
  await db.query(`insert into kot (restaurant_id, bill_id, table_id, code, status, source) values ($1, $2, $3, 'OK-1', 'new', 'guest')`, [restaurant, live.bill, live.table]);
  // Printing a SETTLED bill's invoice again is still allowed - only a void bill's tickets are refused.
  await db.query(`update bill set status = 'closed', closed_at = now(), closed_by_staff_id = $2, payment_mode = 'Cash' where id = $1`, [live.bill, staffId]);
  await db.query(`insert into print_job (restaurant_id, kind, bill_id, status, is_reprint) values ($1, 'Invoice', $2, 'queued', true)`, [restaurant, live.bill]);
});
