/**
 * change-versions db spec — the change counters move exactly when what a screen shows moves.
 *
 * WHY (latency fix 4, and its review on 25-Sep-2026): polling screens now ask "has my counter
 * moved?" and skip the re-read when it has not. A counter that fails to move is a screen that
 * silently stops updating — the one failure this design must never have. The review found that
 * nothing EXECUTED the triggers: these tests do, in a real Postgres (PGlite, in-process, no server),
 * with every migration in supabase/migrations applied in filename order.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url));

/** What Supabase provides before any migration runs. */
const SUPABASE_PRELUDE = `
  create schema extensions; create extension pgcrypto with schema extensions;
  create schema auth; create table auth.users (id uuid primary key);
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  set search_path = public, extensions;
`;

let db: PGlite;

async function one<T = Record<string, unknown>>(sql: string): Promise<T> {
  const r = await db.query<T>(sql);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return row;
}
const floor = async () =>
  Number((await one<{ v: string }>(`select version::text v from change_version where scope = 'floor'`)).v);
const catalog = async () =>
  Number((await one<{ v: string }>(`select version::text v from change_version where scope = 'catalog'`)).v);
const billVersion = async (code: string) =>
  Number((await one<{ v: string }>(`select version::text v from bill where code = '${code}'`)).v);

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  // Two bills: JB-X on A1 + A2 (a joined party), JB-Y on A3.
  await db.exec(`
    insert into bill (restaurant_id, code, status, host_table_id, tax_rate)
      select r.id, 'JB-X', 'open', t.id, 5 from restaurant r, dining_table t where t.name = 'A1';
    insert into bill (restaurant_id, code, status, host_table_id, tax_rate)
      select r.id, 'JB-Y', 'open', t.id, 5 from restaurant r, dining_table t where t.name = 'A3';
    insert into bill_table (bill_id, table_id)
      select b.id, t.id from bill b, dining_table t where (b.code, t.name) in (('JB-X','A1'), ('JB-X','A2'), ('JB-Y','A3'));
    insert into kot (restaurant_id, bill_id, table_id, code, status, source)
      select b.restaurant_id, b.id, t.id, 'K-' || t.name, 'new', 'captain'
        from bill b join bill_table bt on bt.bill_id = b.id join dining_table t on t.id = bt.table_id;
    insert into kot_item (kot_id, menu_item_id, name, unit_price, qty, food_type)
      select k.id, m.id, m.name, m.price, 1, m.food_type
        from kot k, lateral (select * from menu_item order by name limit 1) m;
  `);
});

test('the migrations ran and the counters exist', async () => {
  expect((await one<{ n: number }>(`select count(*)::int n from menu_item`)).n).toBe(57);
  expect(await floor()).toBeGreaterThan(0);
});

test('a round placed on a bill moves that bill, and not another bill', async () => {
  const x = await billVersion('JB-X');
  const y = await billVersion('JB-Y');
  await db.exec(`update kot set status = 'preparing' where code = 'K-A1'`);
  expect(await billVersion('JB-X')).toBeGreaterThan(x);
  expect(await billVersion('JB-Y')).toBe(y);
});

test('detaching a table moves the bill the rounds LEFT, not only the one they joined', async () => {
  // detachTableFromBill: A2's KOT moves from JB-X to a new bill. The guest at A1 still watches
  // JB-X, whose rounds and total just changed.
  await db.exec(`
    insert into bill (restaurant_id, code, status, host_table_id, tax_rate)
      select r.id, 'JB-Z', 'open', t.id, 5 from restaurant r, dining_table t where t.name = 'A2';`);
  const x = await billVersion('JB-X');
  const z = await billVersion('JB-Z');
  await db.exec(`update kot set bill_id = (select id from bill where code = 'JB-Z') where code = 'K-A2'`);
  expect(await billVersion('JB-X'), 'the bill the round left').toBeGreaterThan(x);
  expect(await billVersion('JB-Z'), 'the bill the round joined').toBeGreaterThan(z);
});

test('an item moved between rounds of different bills moves both bills', async () => {
  const x = await billVersion('JB-X');
  const y = await billVersion('JB-Y');
  await db.exec(`update kot_item set kot_id = (select id from kot where code = 'K-A3')
                  where kot_id = (select id from kot where code = 'K-A1')`);
  expect(await billVersion('JB-X')).toBeGreaterThan(x);
  expect(await billVersion('JB-Y')).toBeGreaterThan(y);
});

test('closing a bill still releases its tables, and moves its version', async () => {
  const y = await billVersion('JB-Y');
  await db.exec(`update bill set status = 'closed', closed_at = now(), payment_mode = 'cash',
                   closed_by_staff_id = (select id from staff order by name limit 1) where code = 'JB-Y'`);
  expect(await billVersion('JB-Y')).toBeGreaterThan(y);
  const open = await one<{ n: number }>(`select count(*)::int n from bill_table bt join bill b on b.id = bt.bill_id
                                           where b.code = 'JB-Y' and bt.released_at is null`);
  expect(open.n).toBe(0);
});

test("a staff member's new name reaches guest screens (their bill shows the captain)", async () => {
  const c = await catalog();
  await db.exec(`update staff set name = name || ' ' where id = (select id from staff order by name limit 1)`);
  expect(await catalog()).toBeGreaterThan(c);
});

test("a guest's cart does not make every captain's phone re-read (no staff screen shows carts)", async () => {
  await db.exec(`insert into guest_session (restaurant_id, token, table_id)
                   select r.id, 'tok-1', t.id from restaurant r, dining_table t where t.name = 'A5'`);
  const f = await floor();
  await db.exec(`insert into guest_cart_line (session_id, menu_item_id, qty)
                   select s.id, m.id, 2 from guest_session s, lateral (select id from menu_item limit 1) m where s.token = 'tok-1'`);
  expect(await floor()).toBe(f);
});

test('a heartbeat that rewrites unchanged values moves nothing; a first contact does', async () => {
  await db.exec(`insert into bridge_token (restaurant_id, label, token_hash, source)
                   select id, 'Till PC', 'hash-1', 'manual' from restaurant`);
  const f0 = await floor();
  await db.exec(`update bridge_token set last_seen_at = now() where token_hash = 'hash-1'`);
  const f1 = await floor();
  expect(f1, 'the first contact turns "Waiting" into "Connected" on the owner screen').toBeGreaterThan(f0);
  await db.exec(`update bridge_token set last_seen_at = now() where token_hash = 'hash-1'`);
  await db.exec(
    `update bridge_token set hostname = hostname, bridge_version = bridge_version, last_sync_at = now() where token_hash = 'hash-1'`
  );
  expect(await floor(), 'later heartbeats and unchanged syncs').toBe(f1);
});

test('the printers a PC reports move the counter only when the list really changes', async () => {
  const upsert = (queue: string, status: string) => `
    insert into bridge_discovered_printer (bridge_token_id, restaurant_id, queue_name, driver_name, port_name, status, is_virtual, reported_at)
      select b.id, b.restaurant_id, '${queue}', 'EPSON TM-T82', 'USB001', '${status}', false, now()
        from bridge_token b where b.token_hash = 'hash-1'
    on conflict (bridge_token_id, queue_name) do update
      set driver_name = excluded.driver_name, port_name = excluded.port_name, status = excluded.status,
          is_virtual = excluded.is_virtual, reported_at = excluded.reported_at`;
  const f0 = await floor();
  await db.exec(upsert('Kitchen', 'ready'));
  const f1 = await floor();
  expect(f1, 'a printer appeared').toBeGreaterThan(f0);
  await db.exec(upsert('Kitchen', 'ready'));
  await db.exec(`delete from bridge_discovered_printer where reported_at < now() - interval '1 hour'`);
  expect(await floor(), 'the same list, re-reported every sync').toBe(f1);
  await db.exec(upsert('Kitchen', 'offline'));
  expect(await floor(), 'a status change').toBeGreaterThan(f1);
});

/** Tables deliberately watched by nothing, and why. Adding one here is a decision. */
const UNWATCHED: Record<string, string> = {
  guest_cart_line: "a phone's own cart: its screen watches it through the session stamp (change-stamp.ts)",
  number_series: 'moves only with a bill or KOT insert, which moves the counters itself',
  change_version: 'the counters themselves',
};

test('every table a screen reads is watched by a counter — asked of the database, not the SQL text', async () => {
  const dataLayer = ['queries', 'guest', 'guest-view', 'staff-view', 'owner-view', 'mutations', 'change-stamp'].map(
    (f) => readFileSync(fileURLToPath(new URL(`../../src/lib/db/${f}.ts`, import.meta.url)), 'utf8')
  );
  const read = new Set(
    dataLayer.flatMap((src) => [...src.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1] ?? ''))
  );
  expect(read.size, 'the scan found the data layer').toBeGreaterThan(15);
  const watched = new Set(
    (
      await db.query<{ t: string }>(`
        select distinct c.relname t
          from pg_trigger g
          join pg_class c on c.oid = g.tgrelid
          join pg_proc p on p.oid = g.tgfoid
         where not g.tgisinternal
           and p.proname in ('bump_change_version', 'bill_version_from_child', 'bill_version_self')`)
    ).rows.map((r) => r.t)
  );
  const missing = [...read].filter((t) => !watched.has(t) && !(t in UNWATCHED));
  expect(missing, 'a table no counter watches is a screen that never updates').toEqual([]);
});
