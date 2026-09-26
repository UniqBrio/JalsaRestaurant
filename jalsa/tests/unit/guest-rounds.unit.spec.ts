/**
 * guest-rounds unit spec — the guest screen reaches its data in at most 3 sequential rounds.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 2): the guest page and its
 * 6-second poll waited for 8 database round trips one after another — table, then the rescan
 * setting, then the session, then its `last_seen_at` write, then the bill's membership row, then
 * the bill, then an unconditional `bill_id` write, then the payload reads. Most of those needed
 * nothing from the one before. Measured at ≈2.9 s per poll while each trip cost ≈250 ms.
 *
 * HOW: tests/support/round-rig.ts runs the REAL data layer with the database swapped for a fake
 * that records when each call started and finished; `rounds` is the longest chain of calls that
 * had to wait for each other.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md — run against the pre-fix tree before the change.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';

interface Result {
  name: string;
  threw: string | null;
  phase: string | null;
  billCode: string | null;
  heardSources: string[];
  calls: number;
  rounds: number;
  writes: string[];
  heardScan: boolean;
  heavyClosedRead: boolean;
  fullBillReads: number;
  deleteBeforeInsert: boolean | null;
  mintedTokenPersisted: string | null;
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/guest.scenarios.ts', import.meta.url));
let results: Result[] = [];
const get = (name: string) => {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`scenario missing: ${name}`);
  return r;
};

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

// SUPERSEDED 24-Sep-2026 (review of fix 2): this asserted exactly 6 scenarios. The scenario file
// now covers every phase and both failure paths, so the count is 14.
test('the rig ran every scenario and each one reached the database', () => {
  expect(results.length).toBe(14);
  for (const r of results) expect(r.calls, r.name).toBeGreaterThan(0);
});

test('every guest load and poll waits for at most 3 sequential rounds', () => {
  for (const name of [
    'first scan (no session yet)',
    'welcome poll',
    'live poll',
    'live poll, bill pointer stale',
    'phone moved from another table',
  ]) {
    expect(get(name).rounds, name).toBeLessThanOrEqual(3);
  }
});

test('the common case — a live poll — waits for at most 2', () => {
  expect(get('live poll').phase).toBe('live');
  expect(get('live poll').rounds).toBeLessThanOrEqual(2);
});

test('a cart tap answers with the new state in at most 2 rounds after the write', () => {
  expect(get('cart tap echo (live)').phase).toBe('live');
  expect(get('cart tap echo (live)').rounds).toBeLessThanOrEqual(2);
});

test('the phases are unchanged by the regrouping', () => {
  expect(get('first scan (no session yet)').phase).toBe('welcome');
  expect(get('welcome poll').phase).toBe('welcome');
  expect(get('live poll, bill pointer stale').phase).toBe('live');
  expect(get('phone moved from another table').phase).toBe('live');
});

test('the bill pointer is written only when it is wrong, and liveness is still stamped', () => {
  // SUPERSEDED 24-Sep-2026 (review of fix 2): these compared bare 'update guest_session' labels,
  // which could not tell the liveness stamp from a bill_id write. The labels now carry the fields.
  const live = get('live poll').writes;
  expect(live).toEqual(['update guest_session last_seen_at']);
  const stale = get('live poll, bill pointer stale').writes;
  expect(stale).toEqual(['update guest_session last_seen_at', 'update guest_session bill_id']);
  const moved = get('phone moved from another table').writes;
  expect(moved).toContain('delete guest_session');
  expect(moved.some((w) => w.startsWith('insert guest_session'))).toBe(true);
});

/* ── added 24-Sep-2026 after review of fix 2 ─────────────────────────────── */

test('every phase is still reached, with the bill it shows', () => {
  expect(get('recently paid')).toMatchObject({ phase: 'recently_paid', billCode: 'JB-1040', threw: null });
  expect(get('paid long ago')).toMatchObject({ phase: 'welcome', billCode: null });
  expect(get('table switched off')).toMatchObject({ phase: 'table_inactive', billCode: null });
  expect(get('no such table')).toMatchObject({ phase: null, threw: null }); // null payload → the 404
  expect(get('live poll')).toMatchObject({ phase: 'live', billCode: 'JB-1041' });
  expect(get('cart tap echo (recently paid)')).toMatchObject({ phase: 'recently_paid', billCode: 'JB-1040' });
  for (const name of ['recently paid', 'paid long ago', 'table switched off', 'cart tap echo (recently paid)']) {
    expect(get(name).rounds, name).toBeLessThanOrEqual(3);
  }
});

test('a closed bill is downloaded whole only for the screen that shows it', () => {
  for (const name of ['live poll', 'paid long ago', 'welcome poll', 'cart tap echo (live)']) {
    expect(get(name).heavyClosedRead, name).toBe(false);
    expect(get(name).fullBillReads, name).toBe(0);
  }
  expect(get('recently paid').fullBillReads).toBe(1);
  expect(get('cart tap echo (recently paid)').fullBillReads).toBe(1);
});

test('the heard-sources scan runs on the welcome screen and nowhere else', () => {
  expect(get('welcome poll').heardScan).toBe(true);
  expect(get('welcome poll').heardSources).toContain('Walked past');
  for (const name of ['live poll', 'recently paid', 'cart tap echo (live)', 'cart tap echo (recently paid)']) {
    expect(get(name).heardScan, name).toBe(false);
  }
});

test('a phone that moved tables: the old session is gone before the new one is written', () => {
  expect(get('phone moved from another table').deleteBeforeInsert).toBe(true);
  expect(get('phone moved from another table').writes).toContain(
    'insert guest_session bill_id+restaurant_id+table_id+token'
  );
});

test('a failed closed-bill read cannot take down a live guest screen', () => {
  expect(get('live poll, closed-bill read fails')).toMatchObject({ threw: null, phase: 'live' });
});

test('a failed bill read never leaves a moved phone without a session', () => {
  const r = get('moved phone, open-bill read fails');
  expect(r.threw).toBe('open-bill read failed');
  expect(r.writes).toContain('delete guest_session');
  expect(r.writes.some((w) => w.startsWith('insert guest_session'))).toBe(true);
});

test('with no cookie, the route handler persists the token it minted', () => {
  expect(get('no cookie (route handler mints one)')).toMatchObject({
    phase: 'welcome',
    mintedTokenPersisted: 'minted-token',
  });
  expect(get('first scan (no session yet)').mintedTokenPersisted).toBeNull(); // the page never writes one
});
