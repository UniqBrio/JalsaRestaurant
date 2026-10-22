/**
 * The KOT and invoice print switches against a real Postgres (22-Oct-2026).
 *
 * Every migration runs on PGlite; then each case replays the exact statement the server sends, so
 * the two duplicate guards are decided by Postgres here as they are in production:
 *   - a round KOT printing was off for is stored `print_status = 'cancelled'` (an existing enum
 *     label: no migration), and Print KOT's claim is ONE conditional update that only one caller
 *     can win;
 *   - a bill's first invoice is inserted under `firstInvoiceJobId`, so a second copy is refused by
 *     the primary key, whole, and nothing else about the row matters.
 *
 * PGlite has one connection, so two writers cannot be in flight at once; what it shows is both
 * orders of the two statements, which is what the conditional update and the key reduce a race to.
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { firstInvoiceJobId } from '../../src/lib/print-job-id';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

/** What Supabase provides before any migration runs (the same prelude as print-redirect.db). */
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
let printer = '';
let table = '';
let bill = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  restaurant = (await db.query<{ id: string }>(`select id from restaurant limit 1`)).rows[0]!.id;
  table = (await db.query<{ id: string }>(`select id from dining_table where restaurant_id = $1 limit 1`, [restaurant])).rows[0]!.id;
  // ONE physical printer for both kinds - the shared machine the switches print on.
  await db.exec(`
    insert into printer (restaurant_id, machine_id, name, purpose, roles, station, routes)
      values ('${restaurant}', 'T-ONE', 'Test Counter', 'KOT', '{KOT,Invoice}', 'Main Kitchen', '{}');
    insert into bill (restaurant_id, code) values ('${restaurant}', 'B-PS');
  `);
  printer = (await db.query<{ id: string }>(`select id from printer where machine_id = 'T-ONE'`)).rows[0]!.id;
  bill = (await db.query<{ id: string }>(`select id from bill where code = 'B-PS'`)).rows[0]!.id;
});

/** A round as `placeRound` inserts it, with KOT printing on or off. */
async function round(code: string, printStatus: 'queued' | 'cancelled'): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into kot (restaurant_id, bill_id, table_id, code, source, placed_by_label, status, print_status)
     values ($1, $2, $3, $4, 'captain', 'Ravi · Captain', 'new', $5::print_status) returning id`,
    [restaurant, bill, table, code, printStatus]
  );
  return rows[0]!.id;
}

/** `printKotOnce`'s claim, exactly: `update kot set print_status = 'queued' where ... and print_status = 'cancelled'`. */
const claim = async (kotId: string): Promise<number> =>
  (
    await db.query(`update kot set print_status = 'queued' where id = $1 and restaurant_id = $2 and print_status = 'cancelled' returning id`, [
      kotId,
      restaurant,
    ])
  ).rows.length;

/** A first invoice as `queuePrint` writes it, under the fixed id. */
const firstInvoice = (billId: string) =>
  db.query(
    `insert into print_job (id, restaurant_id, printer_id, printer_name, station, routing_rule, kind, bill_id, status, is_reprint)
     values ($1, $2, $3, 'Test Counter', 'Main Kitchen', 'routed', 'Invoice', $4, 'queued', false)`,
    [firstInvoiceJobId(billId), restaurant, printer, billId]
  );

const invoiceJobs = async (billId: string): Promise<number> =>
  (await db.query<{ n: number }>(`select count(*)::int n from print_job where bill_id = $1 and kind = 'Invoice'`, [billId])).rows[0]!.n;

test('a round placed with KOT printing off is stored as never printed - the label exists on kot.print_status', async () => {
  const id = await round('KOT-PS1', 'cancelled');
  const { rows } = await db.query<{ s: string }>(`select print_status::text s from kot where id = $1`, [id]);
  expect(rows[0]!.s).toBe('cancelled');
});

test('Print KOT: the first claim wins, the second takes nothing - in either order of two taps', async () => {
  const id = await round('KOT-PS2', 'cancelled');
  expect(await claim(id)).toBe(1);
  expect(await claim(id)).toBe(0);
});

test('a round that printed by itself can never be claimed for a "first" print', async () => {
  const id = await round('KOT-PS3', 'queued');
  expect(await claim(id)).toBe(0);
});

test('a claim reaches only this restaurant\'s rounds', async () => {
  const id = await round('KOT-PS4', 'cancelled');
  const other = (await db.query<{ n: number }>(
    `update kot set print_status = 'queued' where id = $1 and restaurant_id = gen_random_uuid() and print_status = 'cancelled' returning id`,
    [id]
  )).rows.length;
  expect(other).toBe(0);
  expect(await claim(id)).toBe(1);
});

test('the first invoice id is a uuid Postgres accepts', async () => {
  const { rows } = await db.query<{ ok: boolean }>(`select $1::uuid is not null ok`, [firstInvoiceJobId(bill)]);
  expect(rows[0]!.ok).toBe(true);
});

test('a second first invoice for one bill is refused by the primary key - one job, whatever the timing', async () => {
  await firstInvoice(bill);
  await expect(firstInvoice(bill)).rejects.toMatchObject({ code: '23505' });
  expect(await invoiceJobs(bill)).toBe(1);
});

test('a REPRINT of that bill is still its own job - the fixed id holds only the first invoice', async () => {
  await db.query(
    `insert into print_job (restaurant_id, printer_id, printer_name, station, routing_rule, kind, bill_id, status, is_reprint)
     values ($1, $2, 'Test Counter', 'Main Kitchen', 'routed', 'Invoice', $3, 'queued', true)`,
    [restaurant, printer, bill]
  );
  expect(await invoiceJobs(bill)).toBe(2);
});

test('another bill\'s first invoice is not blocked by this one', async () => {
  await db.exec(`insert into bill (restaurant_id, code) values ('${restaurant}', 'B-PS2')`);
  const other = (await db.query<{ id: string }>(`select id from bill where code = 'B-PS2'`)).rows[0]!.id;
  await firstInvoice(other);
  expect(await invoiceJobs(other)).toBe(1);
});
