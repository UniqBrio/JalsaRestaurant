/**
 * Sign-in throttling, from the application's side (27-Oct-2026, P-5).
 *
 * The rules live in the database (tests/unit/sign-in-throttle.db.unit.spec.ts). This proves what
 * the application hands them and does with their answer: a keyed network, never an address; a
 * throttled answer becomes a 429 that says how long to wait; and a database the migration has not
 * reached keeps today's limit instead of breaking sign-in.
 *
 * FAIL-FIRST: against the pre-change tree the scenario rungs fail — `signInWithPin` never called
 * `sign_in_with_pin`, and the route answered every 11th attempt in a minute, from anyone, with
 * "Too many attempts in the last minute".
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { networkKey, networkPrefix } from '../../src/lib/network-key';

const SCENARIOS = fileURLToPath(new URL('../support/rounds/sign-in.scenarios.ts', import.meta.url));
type Row = Record<string, unknown> & { name: string };
let rows: Row[] = [];
const get = (name: string) => {
  const r = rows.find((x) => x.name === name);
  if (!r) throw new Error(`scenario missing: ${name}`);
  return r;
};

test.describe('through the real code', () => {
  test.beforeAll(async () => {
    rows = await runScenario<Row[]>(SCENARIOS);
  });

  test('the throttle is given a keyed network and the surface — never the address', () => {
    const w = get('what is sent');
    expect(w.keys).toEqual(['p_net', 'p_pin', 'p_restaurant', 'p_surface']);
    expect(w.surface).toBe('owner');
    expect(String(w.net)).toMatch(/^n1:[A-Za-z0-9_-]{32}$/);
    expect(w.containsAddress).toBe(false);
    expect(w.sameAsSibling, 'another address in the same /64 is the same network').toBe(true);
  });

  test("the database's answer is the outcome: ok, refused, throttled", () => {
    expect(get('ok').outcome).toEqual({ signedIn: 'Arun' });
    expect(get('refused').outcome).toEqual({ signedIn: null });
    expect(get('throttled').outcome).toEqual({ throttled: 840 });
    for (const n of ['ok', 'refused', 'throttled']) expect(get(n).rpc, n).toEqual(['sign_in_with_pin']);
  });

  test('the shared setup code is still refused before the database is asked', () => {
    expect(get('setup code')).toMatchObject({ outcome: { signedIn: null }, rpc: [] });
  });

  test('the route: a wrong PIN is the one unhelpful answer; throttled is a 429 that says how long', () => {
    expect(get('route: refused')).toMatchObject({ status: 401, code: 'unauthenticated' });
    expect(get('route: throttled for minutes')).toMatchObject({
      status: 429,
      code: 'rate-limited',
      retryAfter: '840',
      message: 'Too many attempts. Wait 14 minutes, then try again.',
    });
    expect(get('route: throttled for seconds')).toMatchObject({
      status: 429,
      retryAfter: '30',
      message: 'Too many attempts. Wait a moment, then try again.',
    });
  });

  test('a database without the migration keeps working, on the old limit, and is not asked again at once', () => {
    expect(get('missing: falls back')).toMatchObject({
      outcome: { signedIn: 'Arun' },
      rpc: ['sign_in_with_pin', 'verify_staff_pin'],
    });
    expect(get('missing: not asked again')).toMatchObject({
      outcome: { signedIn: 'Arun' },
      rpc: ['verify_staff_pin'],
    });
    // The old window: ten in a minute per process. Two above, eight here, then refused.
    const outcomes = get('legacy window').outcomes as Array<Record<string, unknown>>;
    expect(outcomes.slice(0, 8).every((o) => o.signedIn === 'Arun')).toBe(true);
    expect(outcomes.slice(8).every((o) => typeof o.throttled === 'number')).toBe(true);
  });
});

test.describe('the network key', () => {
  test('IPv4 is its own network; IPv6 is its /64, however it is written', () => {
    expect(networkPrefix('203.0.113.7')).toBe('203.0.113.7');
    expect(networkPrefix(' 203.0.113.7 ')).toBe('203.0.113.7');
    expect(networkPrefix('::ffff:203.0.113.7')).toBe('203.0.113.7');
    const p = '2001:db8:1:2::/64';
    for (const a of [
      '2001:db8:1:2::1',
      '2001:0db8:0001:0002:ffff:ffff:ffff:ffff',
      '[2001:db8:1:2:0:0:0:9]',
      '2001:DB8:1:2::1%eth0',
    ]) {
      expect(networkPrefix(a), a).toBe(p);
    }
    expect(networkPrefix('2001:db8:1:3::1')).not.toBe(p);
    expect(networkPrefix('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(networkPrefix('::1')).toBe('0:0:0:0::/64');
  });

  test('the key needs the secret, and never contains the address', () => {
    const a = networkKey('203.0.113.7', 'secret-one');
    expect(a).toMatch(/^n1:[A-Za-z0-9_-]{32}$/);
    expect(a).toBe(networkKey('203.0.113.7', 'secret-one'));
    expect(a).not.toBe(networkKey('203.0.113.7', 'secret-two'));
    expect(a).not.toBe(networkKey('203.0.113.8', 'secret-one'));
    expect(a).not.toContain('203');
    expect(networkKey('', 'secret-one'), 'no address is still one network').toMatch(/^n1:/);
  });
});

test('the per-process window is gone from the route, and lives on only as the fallback', () => {
  const route = readFileSync(
    fileURLToPath(new URL('../../src/app/api/staff/session/route.ts', import.meta.url)),
    'utf8'
  );
  expect(route).not.toMatch(/MAX_ATTEMPTS|attempts\.push/);
  const auth = readFileSync(fileURLToPath(new URL('../../src/lib/db/auth.ts', import.meta.url)), 'utf8');
  expect(auth.indexOf("rpc('sign_in_with_pin'")).toBeLessThan(auth.indexOf('legacyLimit();'));
});
