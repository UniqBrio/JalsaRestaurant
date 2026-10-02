/**
 * "Print elsewhere" against a real Postgres (02-Oct-2026): the redirect is one transaction, and
 * exactly one of the original and its replacement can ever print.
 *
 * Every migration runs on PGlite, then each case puts one job in a known state and calls
 * `redirect_print_job` the way `printElsewhere` does. The bridge's claim is replayed as the exact
 * statement `claimPrintJob` sends (`update ... set status = 'processing' where id = $1 and
 * status = 'queued'`), so "who wins" is decided by Postgres here as it is in production.
 *
 * WHAT A SINGLE-CONNECTION DATABASE CAN AND CANNOT SHOW. PGlite has one connection, so the two
 * writers cannot be in flight at the same instant. What it can show - and what the row lock
 * reduces the race to - is both ORDERS: redirect then claim (the claim finds nothing to take),
 * and claim then redirect (the redirect is refused). The lock makes every real interleaving one
 * of those two.
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
let restaurant = '';
let kitchen = '';
let tandoor = '';
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
  await db.exec(`
    insert into printer (restaurant_id, machine_id, name, purpose, station, routes)
      values ('${restaurant}', 'T-KIT', 'Test Kitchen', 'KOT', 'Main Kitchen', '{}'),
             ('${restaurant}', 'T-TAN', 'Test Tandoor', 'KOT', 'Tandoor', '{}');
    insert into bill (restaurant_id, code) values ('${restaurant}', 'B-RD');
  `);
  kitchen = (await db.query<{ id: string }>(`select id from printer where machine_id = 'T-KIT'`)).rows[0]!.id;
  tandoor = (await db.query<{ id: string }>(`select id from printer where machine_id = 'T-TAN'`)).rows[0]!.id;
  bill = (await db.query<{ id: string }>(`select id from bill where code = 'B-RD'`)).rows[0]!.id;
});

/** A job on the Tandoor in the given state, as `queuePrint` writes it. */
async function job(status: string, foodSide = 'non_veg'): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into print_job (restaurant_id, printer_id, printer_name, station, routing_rule, food_side, kind, bill_id, status)
     values ($1, $2, 'Test Tandoor', 'Tandoor', 'routed', $3, 'KOT', $4, $5::print_status) returning id`,
    [restaurant, tandoor, foodSide, bill, status]
  );
  return rows[0]!.id;
}

const redirect = async (id: string): Promise<string> =>
  (
    await db.query<{ id: string }>(
      `select redirect_print_job($1, $2, $3, 'Test Kitchen', 'Main Kitchen', 'Meena · Owner') as id`,
      [id, restaurant, kitchen]
    )
  ).rows[0]!.id;

/** `claimPrintJob`'s statement, exactly: the whole of the bridge's concurrency control. */
const claim = async (id: string): Promise<number> =>
  (await db.query(`update print_job set status = 'processing', claimed_by = 'PC', claimed_at = now() where id = $1 and status = 'queued'`, [id]))
    .affectedRows ?? -1;

const row = async (id: string) =>
  (
    await db.query<Record<string, unknown>>(
      `select status::text, printer_id, routing_rule, food_side, is_reprint, redirected_from_job_id, requested_by, last_error from print_job where id = $1`,
      [id]
    )
  ).rows[0]!;

test('a WAITING ticket: the original is cancelled and the replacement queued, together', async () => {
  const original = await job('queued');
  const replacement = await redirect(original);
  expect(await row(original)).toMatchObject({ status: 'cancelled', printer_id: tandoor, last_error: 'Sent to Test Kitchen instead - not printed here.' });
  expect(await row(replacement)).toMatchObject({
    status: 'queued',
    printer_id: kitchen,
    routing_rule: 'chosen',
    // The ORIGINAL's half, never the destination's (22-Sep-2026).
    food_side: 'non_veg',
    is_reprint: false,
    redirected_from_job_id: original,
    requested_by: 'Meena · Owner',
  });
});

test('RACE, redirect first: the bridge that then tries to claim the original takes nothing', async () => {
  const original = await job('queued');
  const replacement = await redirect(original);
  expect(await claim(original)).toBe(0);
  expect(await claim(replacement)).toBe(1);
  // Exactly one ticket of the two can print.
  const live = await db.query(`select 1 from print_job where id in ($1, $2) and status in ('queued', 'processing')`, [original, replacement]);
  expect(live.rows).toHaveLength(1);
});

test('RACE, claim first: a ticket a bridge is printing cannot be redirected, and nothing is written', async () => {
  const original = await job('queued');
  expect(await claim(original)).toBe(1);
  const before = (await db.query(`select count(*)::int n from print_job`)).rows[0];
  await expect(redirect(original)).rejects.toThrow(/being printed at Test Tandoor right now/);
  expect((await db.query(`select count(*)::int n from print_job`)).rows[0]).toEqual(before);
  expect((await row(original)).status).toBe('processing');
});

test('a ticket already sent elsewhere cannot be sent again - the second of two clicks is refused', async () => {
  const original = await job('queued');
  await redirect(original);
  await expect(redirect(original)).rejects.toThrow(/already sent to another machine/);
  expect((await db.query(`select count(*)::int n from print_job where redirected_from_job_id = $1`, [original])).rows[0]).toEqual({ n: 1 });
});

test('a PRINTED ticket is never cancelled - the replacement is marked a reprint', async () => {
  const original = await job('printed');
  const replacement = await redirect(original);
  expect((await row(original)).status).toBe('printed');
  expect(await row(replacement)).toMatchObject({ status: 'queued', is_reprint: true });
});

test('a FAILED ticket stays failed - it printed nothing - and the replacement is not a reprint', async () => {
  const original = await job('failed');
  const replacement = await redirect(original);
  expect((await row(original)).status).toBe('failed');
  expect(await row(replacement)).toMatchObject({ status: 'queued', is_reprint: false });
});

test('a job of another restaurant is not found, and nothing is written', async () => {
  const original = await job('queued');
  await expect(
    db.query(`select redirect_print_job($1, gen_random_uuid(), $2, 'X', 'Y', 'Z')`, [original, kitchen])
  ).rejects.toThrow(/no longer exists/);
  expect((await row(original)).status).toBe('queued');
});

test('only the server may call it: no execute grant to anon or authenticated', async () => {
  const grants = (
    await db.query<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges where routine_name = 'redirect_print_job' order by grantee`
    )
  ).rows.map((r) => r.grantee);
  // The read found the function's grants at all - an empty list would pass every line below.
  expect(grants).toContain('service_role');
  expect(grants).not.toContain('anon');
  expect(grants).not.toContain('authenticated');
  expect(grants).not.toContain('PUBLIC');
});
