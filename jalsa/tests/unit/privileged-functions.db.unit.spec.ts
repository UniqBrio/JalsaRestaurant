/**
 * The four privileged database functions answer the application's server and nobody else
 * (03-Oct-2026, 20261003090000_jalsa_lock_privileged_functions).
 *
 * Every migration runs on PGlite. Each case then calls the functions AS the role a caller would
 * have: `anon` (the publishable key in the browser), `authenticated`, and `service_role` (the
 * secret key the server uses). The first two must be refused outright; the server's flows - issue
 * a PIN, choose your own, sign in, draw a bill number - must work exactly as before, and no PIN is
 * ever stored or returned in plain text.
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
let restaurant = '';
let staffA = '';
let staffB = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  restaurant = (await db.query<{ id: string }>(`select id from restaurant limit 1`)).rows[0]!.id;
  const staff = (await db.query<{ id: string }>(`select id from staff where restaurant_id = $1 and active and removed_at is null order by id limit 2`, [restaurant])).rows;
  staffA = staff[0]!.id;
  staffB = staff[1]!.id;
});

/** Runs one statement as `role`, exactly as PostgREST does for a request made with that role. */
async function as<T = Record<string, unknown>>(role: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`set role ${role}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

const CALLS: Array<[string, string, (r: string, s: string) => unknown[]]> = [
  ['set_staff_pin', `select public.set_staff_pin($1, $2, true)`, (_r, s) => [s, '5826']],
  ['set_own_pin', `select public.set_own_pin($1, $2, $3)`, (_r, s) => [s, '0000', '5827']],
  ['verify_staff_pin', `select * from public.verify_staff_pin($1, $2)`, (r) => [r, '5826']],
  ['next_number', `select public.next_number($1, 'bill')`, (r) => [r]],
];

/* ── Unauthorized: the browser's key and a signed-in end user ──────────────────────────────── */

for (const role of ['anon', 'authenticated']) {
  for (const [name, sql, args] of CALLS) {
    test(`${role} cannot execute ${name}`, async () => {
      await expect(as(role, sql, args(restaurant, staffB))).rejects.toThrow(/permission denied for function/);
    });
  }
}

test('no privileged function is executable by PUBLIC, anon or authenticated - and the server keeps it', async () => {
  const rows = (
    await db.query<{ proname: string; anon: boolean; auth: boolean; service: boolean; public_acl: boolean; definer: boolean }>(`
      select p.proname,
             has_function_privilege('anon', p.oid, 'execute') anon,
             has_function_privilege('authenticated', p.oid, 'execute') auth,
             has_function_privilege('service_role', p.oid, 'execute') service,
             exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0) public_acl,
             p.prosecdef definer
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('set_staff_pin', 'set_own_pin', 'verify_staff_pin', 'next_number', 'redirect_print_job')
       order by 1`)
  ).rows;
  // The parse found all five - a scan of nothing would pass every line below.
  expect(rows.map((r) => r.proname)).toEqual(['next_number', 'redirect_print_job', 'set_own_pin', 'set_staff_pin', 'verify_staff_pin']);
  for (const r of rows) {
    expect(r, r.proname).toMatchObject({ anon: false, auth: false, service: true, public_acl: false });
  }
  // The four keep working the way they always have: as definer, with a fixed search_path.
  const config = (
    await db.query<{ proname: string; definer: boolean; config: string[] | null }>(`
      select proname, prosecdef definer, proconfig config from pg_proc
       where proname in ('set_staff_pin', 'set_own_pin', 'verify_staff_pin', 'next_number') order by 1`)
  ).rows;
  for (const c of config) {
    expect(c.definer, c.proname).toBe(true);
    expect((c.config ?? []).some((s) => s.startsWith('search_path=')), c.proname).toBe(true);
  }
});

/* ── Authorized: the server's flows, as service_role ───────────────────────────────────────── */

test('the server issues a PIN: it is stored hashed and provisional, never as the digits', async () => {
  await as('service_role', `select public.set_staff_pin($1, $2, true)`, [staffA, '5826']);
  const [row] = (await db.query<{ pin_hash: string; pin_provisional: boolean }>(`select pin_hash, pin_provisional from staff where id = $1`, [staffA])).rows;
  expect(row!.pin_hash).toMatch(/^\$2[aby]\$10\$/);
  expect(row!.pin_hash).not.toContain('5826');
  expect(row!.pin_provisional).toBe(true);
  // No column anywhere on staff holds a PIN in the clear.
  const cols = (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'staff' and column_name like '%pin%' order by 1`)).rows.map((c) => c.column_name);
  expect(cols).toEqual(['pin_hash', 'pin_provisional', 'pin_set_at']);
});

test('the server signs a person in: the right PIN finds them, a wrong one finds nobody, nothing secret comes back', async () => {
  const ok = await as<Record<string, unknown>>('service_role', `select * from public.verify_staff_pin($1, $2)`, [restaurant, '5826']);
  expect(ok).toHaveLength(1);
  expect(ok[0]!.id).toBe(staffA);
  expect(Object.keys(ok[0]!).sort()).toEqual(['id', 'initials', 'name', 'provisional', 'role']);
  expect(JSON.stringify(ok)).not.toContain('5826');
  expect(JSON.stringify(ok)).not.toContain('$2');
  expect(await as('service_role', `select * from public.verify_staff_pin($1, $2)`, [restaurant, '9173'])).toEqual([]);
  // Another restaurant's id finds nobody, even with the right digits.
  expect(await as('service_role', `select * from public.verify_staff_pin(gen_random_uuid(), $1)`, ['5826'])).toEqual([]);
});

test('choosing your own PIN needs the current one: a wrong current PIN changes nothing', async () => {
  const before = (await db.query<{ pin_hash: string }>(`select pin_hash from staff where id = $1`, [staffA])).rows[0]!.pin_hash;
  const [wrong] = await as<{ ok: boolean }>('service_role', `select public.set_own_pin($1, $2, $3) ok`, [staffA, '0000', '6390']);
  expect(wrong!.ok).toBe(false);
  expect((await db.query<{ pin_hash: string }>(`select pin_hash from staff where id = $1`, [staffA])).rows[0]!.pin_hash).toBe(before);
  // The setup code and trivial PINs are refused as the new one.
  await expect(as('service_role', `select public.set_own_pin($1, $2, $3)`, [staffA, '5826', '1234'])).rejects.toThrow(/not a sequence or a repeat/);
  // The right current PIN changes it, and clears the provisional flag.
  const [right] = await as<{ ok: boolean }>('service_role', `select public.set_own_pin($1, $2, $3) ok`, [staffA, '5826', '6390']);
  expect(right!.ok).toBe(true);
  expect((await db.query<{ pin_provisional: boolean }>(`select pin_provisional from staff where id = $1`, [staffA])).rows[0]!.pin_provisional).toBe(false);
  expect(await as('service_role', `select id from public.verify_staff_pin($1, $2)`, [restaurant, '6390'])).toEqual([{ id: staffA }]);
  expect(await as('service_role', `select id from public.verify_staff_pin($1, $2)`, [restaurant, '5826'])).toEqual([]);
});

test('one person cannot change another person\'s PIN with their own: the current PIN is checked against THAT person', async () => {
  // A's current PIN (6390) used against B's id changes nothing.
  const bBefore = (await db.query<{ pin_hash: string | null }>(`select pin_hash from staff where id = $1`, [staffB])).rows[0]!.pin_hash;
  const [r] = await as<{ ok: boolean }>('service_role', `select public.set_own_pin($1, $2, $3) ok`, [staffB, '6390', '7051']);
  expect(r!.ok).toBe(false);
  expect((await db.query<{ pin_hash: string | null }>(`select pin_hash from staff where id = $1`, [staffB])).rows[0]!.pin_hash).toBe(bBefore);
});

test('the server draws bill numbers in sequence, one per call', async () => {
  const rows = await as<{ n: string }>('service_role', `select public.next_number($1, 'bill') n union all select public.next_number($1, 'bill')`, [restaurant]);
  const nums = rows.map((r) => Number(/(\d+)$/.exec(r.n)?.[1]));
  expect(nums[1]! - nums[0]!).toBe(1);
  // An unknown series is refused rather than invented.
  await expect(as('service_role', `select public.next_number($1, 'nonsense')`, [restaurant])).rejects.toThrow(/No number series/);
});

/* ── The trigger functions added on 02-Oct have a fixed search_path ────────────────────────── */

test('the four 02-Oct trigger functions run with a fixed search_path', async () => {
  const rows = (
    await db.query<{ proname: string; config: string[] | null }>(`
      select proname, proconfig config from pg_proc
       where proname in ('printer_sync_roles', 'bill_order_type_fixed', 'bill_table_not_takeaway', 'kot_table_matches_order_type')
       order by 1`)
  ).rows;
  expect(rows).toHaveLength(4);
  for (const r of rows) expect(r.config, r.proname).toEqual(['search_path=public']);
});

/* ── The application calls them only from the server ───────────────────────────────────────── */

test('every call to these functions is server code, through the secret-key client', () => {
  const call = /rpc\('(set_staff_pin|set_own_pin|verify_staff_pin|next_number)'/;
  const files = ['src/lib/db/owner-mutations.ts', 'src/lib/db/auth.ts', 'src/lib/db/mutations.ts'];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    expect(src, f).toMatch(call);
    expect(src, `${f} is server-only`).not.toMatch(/^['"]use client['"]/m);
  }
  // The client the calls go through is built with the secret key, and the publishable key is never used to call them.
  const server = readFileSync('src/lib/supabase/server.ts', 'utf8');
  expect(server).toContain('createClient(cfg.supabaseUrl, cfg.supabaseSecretKey');
  // Issuing a PIN needs the staff.pin grant; choosing one acts on the signed-in person only.
  expect(readFileSync('src/lib/db/owner-mutations.ts', 'utf8')).toContain("demand(input.actor, 'staff.pin');");
  expect(readFileSync('src/app/api/staff/pin/route.ts', 'utf8')).toContain('chooseOwnPin({ staffId: staff.staffId, current, next })');
});
