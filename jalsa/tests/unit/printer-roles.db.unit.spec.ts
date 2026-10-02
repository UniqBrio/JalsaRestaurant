/**
 * Printer roles against a real Postgres (02-Oct-2026).
 *
 * Every migration in supabase/migrations runs in filename order on PGlite, over the seed's four
 * real printers (one Counter for bills, three kitchen machines). The cases hold the database to
 * what the routing code assumes: existing rows keep exactly the kind they printed, older code
 * that writes only `purpose` still works, one default per kind per restaurant, and the same
 * Windows printer may serve two Jalsa printers.
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

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
});

test('existing printers keep exactly the kind they printed, and nobody is a default yet', async () => {
  const printers = await rows<{ machine_id: string; purpose: string; roles: string[]; default_roles: string[] }>(
    `select machine_id, purpose, roles, default_roles from printer order by machine_id`
  );
  expect(printers.length).toBe(4);
  for (const p of printers) {
    expect(p.roles, p.machine_id).toEqual([p.purpose]);
    expect(p.default_roles).toEqual([]);
  }
  expect(printers.find((p) => p.machine_id === 'BILL-01')?.roles).toEqual(['Invoice']);
});

test('a printer set to both is found by both the kitchen-ticket and the bill reads', async () => {
  await db.exec(`update printer set roles = '{KOT,Invoice}' where machine_id = 'BILL-01'`);
  const kot = await rows<{ machine_id: string }>(`select machine_id from printer where roles @> array['KOT'] order by 1`);
  const bills = await rows<{ machine_id: string }>(`select machine_id from printer where roles @> array['Invoice']`);
  expect(kot.map((r) => r.machine_id)).toContain('BILL-01');
  expect(bills.map((r) => r.machine_id)).toEqual(['BILL-01']);
  // `purpose` follows, so a reader from before roles sees a machine that prints kitchen tickets.
  expect((await rows<{ purpose: string }>(`select purpose from printer where machine_id = 'BILL-01'`))[0]?.purpose).toBe('KOT');
});

test('older code that writes only purpose still works, in both directions', async () => {
  const [r] = await rows<{ id: string }>(`select id from restaurant limit 1`);
  // An insert naming only the purpose (roles takes its column default).
  await db.exec(`insert into printer (restaurant_id, machine_id, name, purpose) values ('${r!.id}', 'OLD-01', 'Old', 'Invoice')`);
  expect((await rows<{ roles: string[] }>(`select roles from printer where machine_id = 'OLD-01'`))[0]?.roles).toEqual(['Invoice']);
  // An update changing only the purpose.
  await db.exec(`update printer set purpose = 'KOT' where machine_id = 'OLD-01'`);
  expect((await rows<{ roles: string[] }>(`select roles from printer where machine_id = 'OLD-01'`))[0]?.roles).toEqual(['KOT']);
});

test('one default kitchen printer and one default bill printer per restaurant - possibly the same one', async () => {
  await db.exec(`update printer set default_roles = '{KOT,Invoice}' where machine_id = 'BILL-01'`);
  await expect(db.exec(`update printer set default_roles = '{KOT}' where machine_id = 'KOT-VEG-01'`)).rejects.toThrow(
    /printer_one_default_kot/
  );
  // Moving the default is clear-then-set, which is what releaseDefaults does.
  await db.exec(`update printer set default_roles = '{Invoice}' where machine_id = 'BILL-01'`);
  await db.exec(`update printer set default_roles = '{KOT}' where machine_id = 'KOT-VEG-01'`);
  const defaults = await rows<{ machine_id: string; default_roles: string[] }>(
    `select machine_id, default_roles from printer where cardinality(default_roles) > 0 order by 1`
  );
  expect(defaults).toEqual([
    { machine_id: 'BILL-01', default_roles: ['Invoice'] },
    { machine_id: 'KOT-VEG-01', default_roles: ['KOT'] },
  ]);
});

test('a printer cannot be used for nothing, for an unknown kind, or be the default for what it does not print', async () => {
  await expect(db.exec(`update printer set roles = '{}' where machine_id = 'OLD-01'`)).rejects.toThrow(/printer_roles_known/);
  await expect(db.exec(`update printer set roles = '{Pizza}' where machine_id = 'OLD-01'`)).rejects.toThrow(/printer_roles_known/);
  await expect(db.exec(`update printer set default_roles = '{Invoice}' where machine_id = 'KOT-NV-01'`)).rejects.toThrow(
    /printer_default_roles_held/
  );
});

test('the same Windows printer may serve two Jalsa printers - the database never forbade it', async () => {
  const [t] = await rows<{ id: string; restaurant_id: string }>(
    `insert into bridge_token (restaurant_id, label, token_hash)
       select id, 'Counter PC', 'hash-roles-test' from restaurant limit 1
     returning id, restaurant_id`
  );
  await db.exec(`
    insert into bridge_printer (bridge_token_id, printer_id, restaurant_id, queue_name)
      select '${t!.id}', id, '${t!.restaurant_id}', 'POS-80' from printer where machine_id in ('KOT-VEG-01', 'BILL-01');
  `);
  const onQueue = await rows<{ n: number }>(`select count(*)::int n from bridge_printer where queue_name = 'POS-80'`);
  expect(onQueue[0]?.n).toBe(2);
});

test('deleting the default printer leaves no dangling default', async () => {
  await db.exec(`delete from bridge_printer where printer_id in (select id from printer where machine_id = 'KOT-VEG-01')`);
  await db.exec(`update print_job set printer_id = null where printer_id in (select id from printer where machine_id = 'KOT-VEG-01')`);
  await db.exec(`delete from printer where machine_id = 'KOT-VEG-01'`);
  const left = await rows<{ n: number }>(`select count(*)::int n from printer where 'KOT' = any (default_roles)`);
  expect(left[0]?.n).toBe(0);
});
