/**
 * write-rounds unit spec — placing a round, and the floor behind every staff poll, wait only for
 * the database rounds they need.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md; found re-measuring after the merge
 * with main on 26-Sep-2026): a guest's round waited for 21 rounds one after another when it
 * opened a bill - the cart read after the session, the table's open bill asked for twice, the
 * printers read twice, the dishes, the printers and the routing settings in three separate
 * rounds, the sub-menu parents in a fourth, the reply screen waiting for the cart to be cleared.
 * And the floor read waited for the open bills only to learn their ids for one more read, a whole
 * extra round on every captain's and owner's poll.
 *
 * HOW: tests/support/round-rig.ts runs the REAL route and data layer with the database swapped
 * for a fake that records when each call started and finished; `rounds` is the longest chain of
 * calls that had to wait for each other.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';

interface Result {
  name: string;
  status: number | null;
  threw: string | null;
  calls: number;
  rounds: number;
  openBillReads: number;
  printerReads: number;
  separateCartReads: number;
  categoryReads: number;
  wrote: string[];
  openBillListReads: number;
  requestReads: number;
  tableNameReads: number;
  cartCount: number | null;
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/writes.scenarios.ts', import.meta.url));
let results: Result[] = [];
const get = (name: string) => {
  const r = results.find((x) => x.name === name);
  if (!r) throw new Error(`scenario missing: ${name}`);
  return r;
};
const FIRST = 'guest places the first round (a bill is opened)';
const NEXT = 'guest places another round (the bill exists)';
const FLOOR = 'the floor, with a phone on an open bill';
const STAFF = 'the staff screen';
const OWNER = 'the owner console';
const OWNER_ACTION = 'owner saves a setting (the console rides back)';

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

test('every scenario ran and succeeded', () => {
  expect(results).toHaveLength(9);
  for (const r of results) if (!r.name.includes('fails')) expect(r.threw, r.name).toBeNull();
  expect(get(FIRST).status).toBe(200);
  expect(get(NEXT).status).toBe(200);
  expect(get(OWNER_ACTION).status).toBe(200);
});

test('a first round waits for at most 15 rounds; a later one for at most 10', () => {
  expect(get(FIRST).rounds).toBeLessThanOrEqual(15);
  expect(get(NEXT).rounds).toBeLessThanOrEqual(10);
});

test('nothing on the round path is read twice: the cart, the printers, the open bill', () => {
  for (const name of [FIRST, NEXT]) {
    const r = get(name);
    expect(r.separateCartReads, `${name}: the cart rides in the session read`).toBe(0);
    expect(r.printerReads, `${name}: the printers the lines were routed to are the ones split on`).toBe(1);
    expect(r.categoryReads, `${name}: sub-menu parents ride in the dishes read`).toBe(0);
  }
  // Once by the route, once by the screen it answers with - not a third time by ensureOpenBill.
  expect(get(FIRST).openBillReads).toBe(2);
});

test('the same writes still happen, in the same order', () => {
  expect(get(FIRST).wrote).toEqual([
    'rpc next_number',
    'insert bill',
    'insert bill_table',
    'insert audit_entry',
    'update guest_session',
    'rpc next_number',
    'insert kot',
    'insert kot_item',
    'insert print_job',
    'insert audit_entry',
    'update kot',
    'delete guest_cart_line',
  ]);
});

test('the floor read is one round, even with a phone on an open bill', () => {
  expect(get(FLOOR).rounds).toBe(1);
});

test('the staff screen and the owner console are each one round', () => {
  // Staff: the floor waited for the open bills to learn their ids. Owner: the same, then every
  // grant by the ids the staff list returned, then the print history's table names by the ids it
  // returned - three rounds on every poll.
  expect(get(STAFF).rounds).toBe(1);
  expect(get(OWNER).rounds).toBe(1);
});

test('the open bills and the requests are read once per screen, not once per section', () => {
  for (const name of [STAFF, OWNER, OWNER_ACTION]) {
    expect(get(name).openBillListReads, name).toBe(1);
    expect(get(name).requestReads, name).toBe(1);
    expect(get(name).tableNameReads, `${name}: print history names ride in its read`).toBe(0);
  }
});

test("an owner's action waits for at most 5 rounds, the console included", () => {
  // Who is asking (1), the setting's old value (2), the write (3), its audit line (4), then the
  // identity re-check and the console TOGETHER (5) - they were two rounds, and the console three.
  expect(get(OWNER_ACTION).rounds).toBeLessThanOrEqual(5);
});

/* ── added 26-Sep-2026, review of the write-path changes: a failure is never shown as success ── */

test('a cart clear that fails is not reported as an empty cart', () => {
  // The round is placed and said so; the screen shows the lines still in the cart, now, so the
  // guest does not take the round for unsent six seconds later and send it again.
  const r = get('the cart clear fails after the round is placed');
  expect(r.status).toBe(200);
  expect(r.cartCount, 'the lines still in the cart').toBe(2);
  expect(get(NEXT).cartCount, 'and after a clear that worked, none').toBe(0);
});

test('a phone with no session is asked to scan again, whatever else failed', () => {
  expect(get('the queue read fails for a phone with no session').status).toBe(401);
});

test('a failed grants read fails the console rather than showing presets as grants', () => {
  expect(get('the owner console, the grants read fails').threw).toContain('grants read failed');
});
