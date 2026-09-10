/**
 * guest phase unit spec — what a poll from the server is allowed to do to the screen a guest is
 * standing in front of.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, executed against the actual module):
 *   OBSERVED FAILING — "a guest halfway through choosing a tip is not yanked back by a poll" was
 *   run first against a `reconcilePhase` with no phone-owned list, i.e. one that simply followed
 *   the bill. It failed: expected "tip", received "status". That is the defect in its purest
 *   form — a guest with their thumb over "+ ₹20" watching the screen jump back to their order
 *   list every six seconds.
 *
 *   OBSERVED FAILING — "a bill closed by staff pulls the guest to the receipt, wherever they
 *   were" was run against a version that checked the phone-owned list BEFORE the closed-bill
 *   rule. It failed on the first phone-owned phase the assertion walks: expected "paid",
 *   received "menu" — and by the same branch it would leave a guest on the tip screen being
 *   asked to tip a bill that has already been settled.
 *
 *   NOT OBSERVED FAILING: `startingPhase`. It is three branches over the same facts and shares
 *   its inputs with the reconciliation above; no mutation makes it fail without also failing a
 *   reconciliation assertion. It is asserted because it is the FIRST thing a returning guest
 *   sees, not because the assertion is independently load-bearing.
 */
import { test, expect } from '@playwright/test';
import { reconcilePhase, startingPhase, type Phase, type PhaseFacts } from '../../src/features/guest/phase';

const facts = (over: Partial<PhaseFacts> = {}): PhaseFacts => ({
  phase: 'live',
  billStatus: 'open',
  roundCount: 1,
  ...over,
});

/* ── The phone keeps its own steps ─────────────────────────────────────── */

const PHONE_OWNED: Phase[] = ['menu', 'cart', 'upsell', 'tip', 'paying', 'failed', 'invoice'];

test('a guest halfway through choosing a tip is not yanked back by a poll', () => {
  expect(reconcilePhase('tip', facts())).toBe('tip');
});

test('every step the phone owns survives a poll that changes nothing', () => {
  for (const phase of PHONE_OWNED) {
    expect(reconcilePhase(phase, facts()), `${phase} must survive a poll`).toBe(phase);
  }
});

test('a guest mid-order is not moved by a round arriving from the captain', () => {
  // The captain adding a round to the same bill must not close the menu under the guest's thumb.
  expect(reconcilePhase('menu', facts({ roundCount: 3 }))).toBe('menu');
  expect(reconcilePhase('cart', facts({ roundCount: 3 }))).toBe('cart');
});

/* ── The bill wins for everything else ─────────────────────────────────── */

test('a bill closed by staff pulls the guest to the receipt, wherever they were', () => {
  // Closure is the one thing that outranks a decision in progress: continuing to offer a tip on
  // a settled bill is worse than interrupting.
  for (const phase of PHONE_OWNED) {
    if (phase === 'invoice') continue;
    expect(reconcilePhase(phase, facts({ billStatus: 'closed' })), `${phase} after closure`).toBe('paid');
  }
  expect(reconcilePhase('status', facts({ billStatus: 'closed' }))).toBe('paid');
});

test('a guest reading their itemised bill is left reading it, even after closure', () => {
  // The one exception. They are looking at the very thing the closure produced.
  expect(reconcilePhase('invoice', facts({ billStatus: 'closed' }))).toBe('invoice');
  expect(reconcilePhase('invoice', facts({ phase: 'recently_paid' }))).toBe('invoice');
});

test('rescanning inside the window lands on the receipt, not on a fresh welcome', () => {
  expect(reconcilePhase('welcome', facts({ phase: 'recently_paid', roundCount: 0 }))).toBe('paid');
});

test('the first round moves a waiting guest to their order list', () => {
  expect(reconcilePhase('welcome', facts({ roundCount: 1 }))).toBe('status');
});

test('the just-placed screen is not immediately replaced by the order list', () => {
  // The guest has just pressed Send. Overwriting the confirmation with a list reads as a failure.
  expect(reconcilePhase('placed', facts({ roundCount: 1 }))).toBe('placed');
});

test('a bill with nothing on it returns a waiting guest to the welcome screen', () => {
  expect(reconcilePhase('status', facts({ roundCount: 0 }))).toBe('welcome');
});

/* ── Where a reopened link lands ───────────────────────────────────────── */

test('reopening the link mid-service lands on the order list, not the welcome screen', () => {
  expect(startingPhase(facts({ roundCount: 2 }))).toBe('status');
});

test('reopening the link before ordering lands on the welcome screen', () => {
  expect(startingPhase(facts({ roundCount: 0, phase: 'welcome' }))).toBe('welcome');
});

test('reopening the link just after paying lands on the receipt', () => {
  expect(startingPhase(facts({ phase: 'recently_paid', billStatus: 'closed', roundCount: 4 }))).toBe('paid');
});
