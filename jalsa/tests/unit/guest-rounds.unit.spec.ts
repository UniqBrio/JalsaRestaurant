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
  phase: string | null;
  calls: number;
  rounds: number;
  writes: string[];
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

test('the rig ran every scenario and each one reached the database', () => {
  expect(results.length).toBe(6);
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
  const live = get('live poll').writes;
  expect(live).toEqual(['update guest_session']); // last_seen_at only
  const stale = get('live poll, bill pointer stale').writes;
  expect(stale.filter((w) => w === 'update guest_session').length).toBe(2); // last_seen_at + bill_id
  const moved = get('phone moved from another table').writes;
  expect(moved).toContain('delete guest_session');
  expect(moved).toContain('insert guest_session');
});
