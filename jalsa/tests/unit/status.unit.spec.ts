/**
 * status unit spec — the one status vocabulary, and the two rules derived from it.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, executed against the actual module):
 *   OBSERVED FAILING — "a table with a ready round AND a cooking one reads as READY" against a
 *   `tableStateFrom` that checked `preparing` before `ready`, the order the states are declared
 *   in: expected "ready", received "in_the_kitchen". A floor tile that says "In the kitchen"
 *   over a plated round hides the one thing a runner needed to see.
 *
 *   Worth recording: the FIRST version of this assertion used a table whose rounds were only
 *   served-and-ready, and it passed against the broken ordering — the mutation was invisible to
 *   it. The case that actually exercises the branch is a table holding BOTH a ready round and a
 *   cooking one, which is what it now asserts. A test that cannot fail is not evidence.
 *
 *   OBSERVED FAILING — "a round that has been picked up counts as started" was run against a
 *   `kitchenHasStarted` that listed only 'preparing' and 'ready'. It returned false for a round
 *   already carried out of the kitchen, which would have let a captain cancel food that was in
 *   somebody's hand — expected true, received false.
 *
 *   NOT OBSERVED FAILING: the vocabulary assertions (guest wording versus staff wording). They
 *   pin a table of words rather than a branch; there is no version of the module in which they
 *   fail without the table itself having been edited, which is precisely what they guard.
 */
import { test, expect } from '@playwright/test';
import {
  BILL_STATUS,
  KOT_FLOW,
  KOT_STATUS,
  kitchenHasStarted,
  nextKotStatus,
  TABLE_STATE,
  tableStateFrom,
  type KotStatus,
} from '../../src/lib/status';

/* ── The vocabulary ────────────────────────────────────────────────────── */

test('every status reads as words a new employee understands, never as a code', () => {
  for (const [key, word] of Object.entries(KOT_STATUS)) {
    expect(word.staff, `${key} has staff wording`).toBeTruthy();
    expect(word.guest, `${key} has guest wording`).toBeTruthy();
    // No underscores, no SCREAMING_CASE, no leaked enum keys.
    expect(word.staff).not.toMatch(/_/);
    expect(word.guest).not.toMatch(/_/);
  }
  for (const word of Object.values(BILL_STATUS)) {
    expect(word.staff).not.toMatch(/_/);
  }
});

test('the guest and the captain are told different things about the same state, on purpose', () => {
  // Reassurance versus instruction. Both read from one state; the mapping is the difference.
  expect(KOT_STATUS.preparing.guest).toBe('In the kitchen');
  expect(KOT_STATUS.preparing.staff).toBe('Cooking');
  expect(KOT_STATUS.new.guest).toBe('Sent to the kitchen');
  expect(KOT_STATUS.new.staff).toBe('New');
});

test('a closed bill reads as Paid to the guest and Closed to staff', () => {
  expect(BILL_STATUS.closed.guest).toBe('Paid');
  expect(BILL_STATUS.closed.staff).toBe('Closed');
});

/* ── The flow ──────────────────────────────────────────────────────────── */

test('the flow runs new → preparing → ready → picked up → served, and stops there', () => {
  expect([...KOT_FLOW]).toEqual(['new', 'preparing', 'ready', 'picked_up', 'served']);
  expect(nextKotStatus('new')).toBe('preparing');
  expect(nextKotStatus('ready')).toBe('picked_up');
  expect(nextKotStatus('served')).toBeNull();
});

test('a cancelled round is not on the flow at all', () => {
  expect(KOT_FLOW).not.toContain('cancelled');
  expect(nextKotStatus('cancelled')).toBeNull();
});

/* ── The kitchen gate ──────────────────────────────────────────────────── */

test('a round the kitchen has not touched can still be changed by a captain', () => {
  expect(kitchenHasStarted('new')).toBe(false);
});

test('a round that has been picked up counts as started', () => {
  // The food is out of the kitchen and in somebody's hand. Cancelling it is the owner's call.
  expect(kitchenHasStarted('preparing')).toBe(true);
  expect(kitchenHasStarted('ready')).toBe(true);
  expect(kitchenHasStarted('picked_up')).toBe(true);
  expect(kitchenHasStarted('served')).toBe(true);
});

/* ── The derived table state ───────────────────────────────────────────── */

const state = (kotStatuses: KotStatus[], extra: Partial<Parameters<typeof tableStateFrom>[0]> = {}) =>
  tableStateFrom({ hasBill: true, kotStatuses, ...extra });

test('a table with no bill is free, whatever else is true of it', () => {
  expect(tableStateFrom({ hasBill: false, kotStatuses: [] })).toBe('free');
});

test('a table with a ready round AND a cooking one reads as READY', () => {
  // Most urgent first. This is the case the ordering exists for: a table with food at the pass
  // and more on the way needs a runner NOW, and a tile that says "In the kitchen" hides that.
  expect(state(['served', 'ready', 'preparing'])).toBe('ready');
  expect(state(['new', 'ready'])).toBe('ready');
  expect(state(['served', 'served', 'ready', 'served'])).toBe('ready');
});

test('a table with food cooking and nothing ready reads as in the kitchen', () => {
  expect(state(['served', 'preparing'])).toBe('in_the_kitchen');
  expect(state(['new'])).toBe('in_the_kitchen');
});

test('a table where everything has been served reads as served', () => {
  expect(state(['served', 'served'])).toBe('served');
});

test('a bill open with no rounds yet is ordering, not free', () => {
  // The guest is at the table with the menu open. Marking it free would seat someone on top.
  expect(state([])).toBe('ordering');
});

test('payment requested outranks every kitchen state', () => {
  expect(state(['ready', 'preparing'], { billStatus: 'payment_requested' })).toBe('payment_requested');
});

test('a table waiting to be cleared outranks everything, including a live bill', () => {
  expect(state(['ready'], { awaitingClearing: true })).toBe('clearing');
  expect(tableStateFrom({ hasBill: false, kotStatuses: [], awaitingClearing: true })).toBe('clearing');
});

test('every table state has a label and a tone, so no tile can render untinted', () => {
  for (const [key, value] of Object.entries(TABLE_STATE)) {
    expect(value.label, `${key} has a label`).toBeTruthy();
    expect(value.tone, `${key} has a tone`).toBeTruthy();
  }
});
