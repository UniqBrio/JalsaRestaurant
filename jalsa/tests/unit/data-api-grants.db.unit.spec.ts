/**
 * Every table answers the server through an EXPLICIT grant, and nobody else at all
 * (27-Oct-2026, 20261027120000_jalsa_explicit_data_api_grants, requests/2026-10-27-supabase-data-api-grants.md).
 *
 * WHY THIS EXISTS
 *   On 30-Oct-2026 Supabase stops granting new `public` tables, sequences and functions to `anon`,
 *   `authenticated` and `service_role` by default. Until now no Jalsa migration granted a table to
 *   anybody: the server's role (`service_role`, the secret key) reached all 31 of them purely through
 *   that platform default. A project built from these migrations after the change - production,
 *   staging, a preview branch, a rebuilt test project - would have answered every request from the
 *   server with `42501 permission denied`.
 *
 * HOW
 *   Every migration runs twice on PGlite:
 *     FRESH    - nothing granted by default: a project created (or rebuilt) after 30-Oct-2026.
 *     EXISTING - Supabase's old default privileges emulated first, exactly as `pg_default_acl` shows
 *                them on the development project (`yxgxmbyilpivbmeemqkp`, read 27-Oct-2026).
 *   Both must end in the same state: the server holds exactly what it needs, the browser's roles hold
 *   nothing, and a table the next migration creates is exposed to nobody until it says so.
 *
 * A NEW TABLE FAILS HERE UNTIL IT IS CLASSIFIED below - that is the point. Add it to SERVER (with
 * the verbs the server really uses, and a grant in the migration that creates it) or to INTERNAL
 * (reached only through a SECURITY DEFINER function).
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

/** Supabase's pre-30-Oct default privileges for objects `postgres` creates in `public`. */
const OLD_PLATFORM_DEFAULTS = `
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const CRUD = ['DELETE', 'INSERT', 'SELECT', 'UPDATE'];

/**
 * Every table the server reaches through PostgREST (`db().from(...)`, src/lib/db/**), plus the
 * tables its SECURITY INVOKER triggers and RPCs write as `service_role` (change_version).
 */
const SERVER: Record<string, string[]> = Object.fromEntries(
  [
    'audit_entry', 'bill', 'bill_table', 'bridge_discovered_printer', 'bridge_pairing_code',
    'bridge_printer', 'bridge_token', 'change_version', 'dining_table', 'expense',
    'guest_attribution', 'guest_cart_line', 'guest_favourite', 'guest_session', 'kot', 'kot_item',
    'menu_category', 'menu_food_type', 'menu_item', 'print_job', 'printer', 'restaurant', 'setting',
    'staff', 'staff_permission', 'staff_table', 'suggestion', 'table_request', 'tip',
    'waitlist_entry',
  ].map((t) => [t, CRUD]),
);
/** Drawn only through SECURITY DEFINER next_number(); scripts/reset-test-db.mjs rewinds it by PostgREST. */
SERVER.number_series = ['SELECT', 'UPDATE'];

/** Reached only inside SECURITY DEFINER functions: no API role holds anything on them. */
const INTERNAL = ['sign_in_attempt'];

/** The server's RPCs (`db().rpc(...)`) - and nobody else's. */
const RPCS = [
  'cancel_bill_and_free', 'move_bill_to_table', 'next_number', 'redirect_print_job', 'set_own_pin',
  'set_staff_pin', 'sign_in_with_pin', 'verify_staff_pin',
];

/** The one serial column the server inserts through; identity columns need no sequence grant. */
const SERVER_SEQUENCES = ['audit_entry_id_seq'];

const ROLES = ['anon', 'authenticated', 'service_role'];

async function build(defaults: string): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  if (defaults) await db.exec(defaults);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  return db;
}

type Grant = { obj: string; role: string; privs: string[] };

/** Effective privileges (PUBLIC and membership included) of every API role on every public relation. */
async function grants(db: PGlite): Promise<Grant[]> {
  return (
    await db.query<Grant>(`
      select c.relname obj, r.role,
             array(select p from unnest(case when c.relkind = 'S'
                                             then array['SELECT','UPDATE','USAGE']
                                             else array['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE'] end) p
                   where case when c.relkind = 'S' then has_sequence_privilege(r.role, c.oid, p)
                              else has_table_privilege(r.role, c.oid, p) end
                   order by p) privs
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       cross join unnest(array['anon','authenticated','service_role']) r(role)
       where n.nspname = 'public' and c.relkind in ('r','p','v','m','f','S')
       order by 1, 2`)
  ).rows;
}

async function tables(db: PGlite): Promise<string[]> {
  return (await db.query<{ t: string }>(`select tablename t from pg_tables where schemaname = 'public' order by 1`)).rows.map((r) => r.t);
}

/** Runs one statement as `role`, exactly as PostgREST does for a request made with that role. */
async function as(db: PGlite, role: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

/** One statement per verb that the executor permission-checks before reading a single row. */
const PROBE: Record<string, (t: string) => string> = {
  SELECT: (t) => `select 1 from public.${t} where false`,
  INSERT: (t) => `insert into public.${t} select * from public.${t} where false`,
  UPDATE: (t) => `update public.${t} set ${column[t]} = ${column[t]} where false`,
  DELETE: (t) => `delete from public.${t} where false`,
};

let fresh: PGlite;
let existing: PGlite;
/** A column each table lets `set c = c` touch (not every table has an `id`; bill_table does not). */
let column: Record<string, string> = {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fresh = await build('');
  existing = await build(OLD_PLATFORM_DEFAULTS);
  column = Object.fromEntries(
    (
      await fresh.query<{ t: string; c: string }>(`
        select distinct on (table_name) table_name t, column_name c
          from information_schema.columns
         where table_schema = 'public' and is_identity = 'NO' and is_generated = 'NEVER'
         order by table_name, ordinal_position`)
    ).rows.map((r) => [r.t, r.c]),
  );
});

/* ── The inventory: nothing unclassified, and the parse found something ──────────────────────── */

test('the migrations produced tables, and every one of them is classified', async () => {
  const found = await tables(fresh);
  expect(found.length).toBeGreaterThan(20); // a parse that found nothing is not a clean result
  expect(found).toEqual([...Object.keys(SERVER), ...INTERNAL].sort());
  expect(await tables(existing)).toEqual(found);
});

test('every public table keeps RLS on with no policy (guardrail 3) - a grant never stands alone', async () => {
  const rows = (
    await fresh.query<{ t: string; rls: boolean; policies: number }>(`
      select c.relname t, c.relrowsecurity rls, (select count(*)::int from pg_policy p where p.polrelid = c.oid) policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`)
  ).rows;
  expect(rows.filter((r) => !r.rls || r.policies !== 0)).toEqual([]);
});

/* ── The intended grants, on a fresh project AND an existing one ───────────────────────────────── */

for (const [label, get] of [['fresh', () => fresh], ['existing', () => existing]] as const) {
  test(`${label}: service_role holds exactly what the server uses on every table`, async () => {
    const sr = Object.fromEntries((await grants(get())).filter((g) => g.role === 'service_role').map((g) => [g.obj, g.privs]));
    for (const [t, privs] of Object.entries(SERVER)) expect(sr[t], t).toEqual(privs);
    for (const t of INTERNAL) expect(sr[t], t).toEqual([]);
  });

  test(`${label}: service_role may draw the audit sequence, and holds no other sequence`, async () => {
    const seqs = (await grants(get())).filter((g) => g.role === 'service_role' && g.obj.endsWith('_seq'));
    expect(seqs.length).toBeGreaterThan(0);
    for (const s of seqs) expect(s.privs, s.obj).toEqual(SERVER_SEQUENCES.includes(s.obj) ? ['USAGE'] : []);
  });

  test(`${label}: anon and authenticated hold no privilege on any public table or sequence`, async () => {
    const leaks = (await grants(get())).filter((g) => g.role !== 'service_role' && g.privs.length > 0);
    expect(leaks).toEqual([]);
  });

  test(`${label}: a table the next migration creates is exposed to nobody until it grants`, async () => {
    const db = get();
    await db.exec(`create table public.zz_next_migration_probe (id int primary key)`);
    try {
      const probe = (await grants(db)).filter((g) => g.obj === 'zz_next_migration_probe' || g.obj.startsWith('zz_'));
      expect(probe.length).toBe(ROLES.length);
      for (const g of probe) expect(g.privs, g.role).toEqual([]);
    } finally {
      await db.exec(`drop table public.zz_next_migration_probe`);
    }
  });
}

test('a fresh project and an existing one end with identical grants', async () => {
  expect(await grants(existing)).toEqual(await grants(fresh));
});

/* ── Executed, not read: each role does what PostgREST would do with its key ─────────────────── */

test('service_role can perform every verb the server uses, and is refused the rest', async () => {
  for (const [t, privs] of Object.entries(SERVER)) {
    for (const [verb, sql] of Object.entries(PROBE)) {
      if (privs.includes(verb)) await expect(as(fresh, 'service_role', sql(t)), `${verb} ${t}`).resolves.toBeDefined();
      else await expect(as(fresh, 'service_role', sql(t)), `${verb} ${t}`).rejects.toThrow(/permission denied/);
    }
  }
  for (const t of INTERNAL) await expect(as(fresh, 'service_role', PROBE.SELECT!(t))).rejects.toThrow(/permission denied/);
});

for (const role of ['anon', 'authenticated']) {
  test(`${role} is refused outright on every table, fresh and existing - not merely shown zero rows`, async () => {
    for (const db of [fresh, existing]) {
      for (const t of Object.keys(SERVER)) {
        for (const [verb, sql] of Object.entries(PROBE)) {
          await expect(as(db, role, sql(t)), `${verb} ${t}`).rejects.toThrow(/permission denied/);
        }
      }
      // An identity column refuses `set id = id` before privileges are checked, so INTERNAL tables
      // are probed with the two verbs that reach the permission check unconditionally.
      for (const t of INTERNAL) {
        for (const verb of ['SELECT', 'DELETE']) {
          await expect(as(db, role, PROBE[verb]!(t)), `${verb} ${t}`).rejects.toThrow(/permission denied/);
        }
      }
    }
  });
}

test('service_role writes real rows on a fresh project: the audit sequence and the change-version triggers', async () => {
  const restaurant = (await fresh.query<{ id: string }>(`select id from public.restaurant limit 1`)).rows[0]!.id;
  const before = (await fresh.query<{ v: number }>(`select version::int v from public.change_version where scope = 'catalog'`)).rows[0]!.v;
  const inserted = await as(fresh, 'service_role',
    `insert into public.audit_entry (restaurant_id, action, actor_label) values ($1, 'grant_probe', 'spec') returning id`, [restaurant]);
  expect(inserted).toHaveLength(1);
  await as(fresh, 'service_role', `update public.menu_category set name = name || '' where restaurant_id = $1`, [restaurant]);
  const after = (await fresh.query<{ v: number }>(`select version::int v from public.change_version where scope = 'catalog'`)).rows[0]!.v;
  expect(after).toBeGreaterThan(before); // the INVOKER trigger wrote change_version as service_role
  await as(fresh, 'service_role', `delete from public.audit_entry where action = 'grant_probe'`);
});

test('service_role signs in through sign_in_with_pin and draws a number, without holding the tables behind them', async () => {
  const restaurant = (await fresh.query<{ id: string }>(`select id from public.restaurant limit 1`)).rows[0]!.id;
  const signIn = await as(fresh, 'service_role', `select public.sign_in_with_pin($1, '0000', 'net:probe', 'staff') r`, [restaurant]);
  expect(signIn).toHaveLength(1);
  const drawn = await as(fresh, 'service_role', `select public.next_number($1, 'bill') n`, [restaurant]);
  expect(String((drawn[0] as { n: string }).n)).toMatch(/\d/);
});

/* ── RPCs: the server's, and nobody else's ──────────────────────────────────────────────────── */

test('every server RPC is executable by service_role and by no browser role or PUBLIC', async () => {
  for (const db of [fresh, existing]) {
    const rows = (
      await db.query<{ proname: string; sr: boolean; anon: boolean; auth: boolean; pub: boolean }>(`
        select p.proname,
               has_function_privilege('service_role', p.oid, 'execute') sr,
               has_function_privilege('anon', p.oid, 'execute') anon,
               has_function_privilege('authenticated', p.oid, 'execute') auth,
               coalesce(exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0), true) pub
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = any($1)`, [RPCS])
    ).rows;
    expect(rows.map((r) => r.proname).sort()).toEqual([...RPCS].sort());
    for (const r of rows) expect(r, r.proname).toEqual({ proname: r.proname, sr: true, anon: false, auth: false, pub: false });
  }
});
