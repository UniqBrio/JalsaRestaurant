/**
 * sign-in throttle, in a real Postgres (PGlite) — migration 20261027100000 (27-Oct-2026, P-5).
 *
 * Legitimate use first (a correct PIN is never refused while a network is within its allowance,
 * and never spends it), then the attacks it exists for: one network guessing, many networks
 * guessing together, a guess that lands after the limit, and the limit as an oracle. Concurrency
 * — fifty guesses at once from one network — needs real connections and is proven on the rig's
 * Postgres (docs/audit/AUTH_SCENARIO_TEST_MATRIX.md); PGlite has one.
 *
 * FAIL-FIRST: before this migration there is no `sign_in_with_pin` and every rung fails at its first
 * call. The legacy limit it replaces is pinned by tests/unit/sign-in-throttle.unit.spec.ts.
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
const OWNER_PIN = '2580';
const CAPTAIN_PIN = '3691';

let db: PGlite;
let restaurant = '';

interface Answer {
  result: 'ok' | 'refused' | 'throttled';
  retry_after?: number;
  staff?: { name: string; role: string; provisional: boolean };
}

async function sign(pin: string, net: string, surface: 'staff' | 'owner' = 'staff'): Promise<Answer> {
  const r = await db.query<{ a: Answer }>(`select sign_in_with_pin($1, $2, $3, $4) a`, [
    restaurant,
    pin,
    net,
    surface,
  ]);
  return r.rows[0]!.a;
}
/** n wrong PINs from `net`, all answered. */
async function miss(n: number, net: string, surface: 'staff' | 'owner' = 'staff'): Promise<Answer[]> {
  const out: Answer[] = [];
  for (let i = 0; i < n; i += 1) out.push(await sign('0907', net, surface));
  return out;
}
/** Failures recorded `ago` in the past, as if they had happened then. */
async function pastFailures(n: number, net: string, ago: string, surface = 'staff'): Promise<void> {
  await db.query(
    `insert into sign_in_attempt (net, surface, ok, at) select $1, $2, false, now() - $3::interval from generate_series(1, $4)`,
    [net, surface, ago, n]
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('00000000000000'))
    .sort();
  for (const f of files) await db.exec(readFileSync(`${MIGRATIONS}/${f}`, 'utf8'));
  restaurant = (await db.query<{ id: string }>(`select id from restaurant where slug = 'jalsa-hosur'`)).rows[0]!.id;
  await db.exec(`
    select set_staff_pin(id, '${OWNER_PIN}', false) from staff where role = 'Owner / Admin';
    select set_staff_pin(id, '${CAPTAIN_PIN}', false) from staff
     where id = (select id from staff where role = 'Captain' order by name limit 1);
  `);
});

test.beforeEach(async () => {
  await db.exec(`delete from sign_in_attempt`);
});

test.describe('legitimate use', () => {
  test('a correct PIN opens; a wrong one is refused; both are recorded, the address never is', async () => {
    const ok = await sign(CAPTAIN_PIN, 'n1:shop');
    expect(ok.result).toBe('ok');
    expect(ok.staff?.role).toBe('Captain');
    expect((await sign('0907', 'n1:shop')).result).toBe('refused');
    const rows = await db.query<{ net: string; ok: boolean }>(`select net, ok from sign_in_attempt order by id`);
    expect(rows.rows).toEqual([
      { net: 'n1:shop', ok: true },
      { net: 'n1:shop', ok: false },
    ]);
  });

  test('a shift arriving at once — twelve correct PINs from one wifi — is never refused', async () => {
    for (let i = 0; i < 12; i += 1)
      expect((await sign(i % 2 ? OWNER_PIN : CAPTAIN_PIN, 'n1:wifi')).result).toBe('ok');
  });

  test("a correct PIN never spends anyone's allowance: 4 mistakes, 6 sign-ins, then a 5th mistake is still answered", async () => {
    await miss(4, 'n1:phone');
    for (let i = 0; i < 6; i += 1) expect((await sign(CAPTAIN_PIN, 'n1:phone')).result).toBe('ok');
    expect((await sign('0907', 'n1:phone')).result).toBe('refused');
  });

  test("the restaurant's own wifi (a correct PIN tonight) gets twice the room for mistakes", async () => {
    await sign(CAPTAIN_PIN, 'n1:wifi');
    const answers = await miss(11, 'n1:wifi');
    expect(answers.slice(0, 10).map((a) => a.result)).toEqual(Array(10).fill('refused'));
    expect(answers[10]?.result).toBe('throttled');
  });

  test('a throttled network recovers on its own: failures older than the window stop counting', async () => {
    await pastFailures(5, 'n1:late', '16 minutes');
    expect((await sign(CAPTAIN_PIN, 'n1:late')).result).toBe('ok');
  });
});

test.describe('attacks', () => {
  test('one network guessing: the 6th guess in 15 minutes is refused unanswered, and says how long to wait', async () => {
    const answers = await miss(6, 'n1:guesser');
    expect(answers.slice(0, 5).map((a) => a.result)).toEqual(Array(5).fill('refused'));
    expect(answers[5]).toMatchObject({ result: 'throttled' });
    expect(answers[5]?.retry_after).toBeGreaterThan(14 * 60);
    expect(answers[5]?.retry_after).toBeLessThanOrEqual(15 * 60);
  });

  test('not an oracle: over the limit, the RIGHT PIN gets exactly the answer a wrong one gets', async () => {
    await miss(5, 'n1:guesser');
    const right = await sign(OWNER_PIN, 'n1:guesser', 'owner');
    const wrong = await sign('0907', 'n1:guesser', 'owner');
    expect(right.result).toBe('throttled');
    expect(Object.keys(right).sort()).toEqual(Object.keys(wrong).sort());
    expect(right.staff).toBeUndefined();
  });

  test('a refused guess is not recorded, so hammering a throttled network does not push its wait out', async () => {
    await miss(5, 'n1:guesser');
    await miss(8, 'n1:guesser');
    expect((await db.query<{ n: number }>(`select count(*)::int n from sign_in_attempt`)).rows[0]?.n).toBe(5);
  });

  test('a slow guesser meets the daily limit: 20 failures in 24 hours, spaced to dodge the 15-minute one', async () => {
    for (let h = 1; h <= 20; h += 1) await pastFailures(1, 'n1:slow', `${h} hours`);
    const a = await sign(CAPTAIN_PIN, 'n1:slow');
    expect(a.result).toBe('throttled');
    expect(a.retry_after).toBeGreaterThan(3 * 3600);
  });

  test('many networks guessing together: the 31st failure across untrusted networks closes the staff keypad to strangers', async () => {
    // Thirty networks, one failure each in the last minute (recorded directly: the rule counts rows).
    for (let i = 0; i < 30; i += 1) await pastFailures(1, `n1:bot${i}`, '1 minute');
    expect((await sign(CAPTAIN_PIN, 'n1:bot-new')).result).toBe('throttled');
    // ...but not to the restaurant's own wifi, which has had a correct PIN tonight.
    await db.query(`insert into sign_in_attempt (net, surface, ok) values ('n1:wifi', 'staff', true)`);
    expect((await sign(CAPTAIN_PIN, 'n1:wifi')).result).toBe('ok');
  });

  test('the owner console has its own, tighter distributed bound: 15', async () => {
    for (let i = 0; i < 15; i += 1) await pastFailures(1, `n1:bot${i}`, '1 minute', 'owner');
    expect((await sign(OWNER_PIN, 'n1:bot-new', 'owner')).result).toBe('throttled');
    expect((await sign(CAPTAIN_PIN, 'n1:bot-new', 'staff')).result, 'the staff keypad is a separate budget').toBe(
      'ok'
    );
  });

  test('anything that is not four digits is a wrong PIN, counted as one', async () => {
    for (const pin of ['', '12', '123456', 'abcd', "1' or '1'='1"]) {
      expect((await sign(pin, 'n1:odd')).result, JSON.stringify(pin)).toBe('refused');
    }
    expect((await sign(CAPTAIN_PIN, 'n1:odd')).result).toBe('throttled');
  });

  test('a surface or a network key that is not one is an error, not a sign-in', async () => {
    await expect(sign(CAPTAIN_PIN, 'n1:x', 'admin' as 'staff')).rejects.toThrow(/surface/);
    await expect(sign(CAPTAIN_PIN, '')).rejects.toThrow(/net/);
    await expect(sign(CAPTAIN_PIN, 'x'.repeat(65))).rejects.toThrow(/net/);
  });

  test('old rows are cleared as it goes: nothing older than two days is kept', async () => {
    await pastFailures(3, 'n1:old', '3 days');
    await sign(CAPTAIN_PIN, 'n1:new');
    expect(
      (await db.query<{ n: number }>(`select count(*)::int n from sign_in_attempt where net = 'n1:old'`)).rows[0]?.n
    ).toBe(0);
  });
});

test('only the server may call it, and nobody but the server may read the attempts', async () => {
  const fn = await db.query<{ acl: string; definer: boolean; cfg: string }>(`
    select array_to_string(proacl, ',') acl, prosecdef definer, array_to_string(proconfig, ',') cfg
      from pg_proc where proname = 'sign_in_with_pin'`);
  const row = fn.rows[0]!;
  expect(row.acl).toContain('service_role=X');
  expect(row.acl).not.toMatch(/(^|,)(anon|authenticated)=|(^|,)=X/);
  expect(row.definer).toBe(true);
  expect(row.cfg).toBe('search_path=public, extensions');
  const table = await db.query<{ rls: boolean; acl: string | null }>(`
    select relrowsecurity rls, array_to_string(relacl, ',') acl from pg_class where relname = 'sign_in_attempt'`);
  expect(table.rows[0]?.rls).toBe(true);
  expect(table.rows[0]?.acl ?? '').not.toMatch(/anon|authenticated/);
});
