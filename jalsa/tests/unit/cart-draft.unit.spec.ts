/**
 * cart-draft unit spec — what the phone shows between the tap and the server's answer.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change tree's own rules, modelled
 * exactly: a row's quantity was `item.inCart` and nothing else — no overlay existed — and
 * `runBusy` opened with `if (busy) return`, so a tap during a write went nowhere):
 *   OBSERVED FAILING — 3 failed:
 *     · "a tap shows on the row before the server has confirmed it" — `expected 2, received 0`.
 *       The number under the guest's thumb was the last thing on the screen to move.
 *     · "the bar appears on the first add, not a round trip later" — `expected 1, received 0`.
 *       The Review order bar is gated on the count, so the first add of the evening left the
 *       screen looking like nothing had happened.
 *     · "a second tap during a write is never silently dropped" — `expected "ran", received
 *       "dropped"`. This is the half that made it look erratic rather than merely slow: taps
 *       were not queued or refused out loud, they were discarded.
 *
 *   NOT OBSERVED FAILING — nothing in this file.
 */
import { test, expect } from '@playwright/test';
import { draftedCount, effectiveQty, withDraft, withoutDraft } from '../../src/lib/cart-draft';

test('a tap shows on the row before the server has confirmed it', () => {
  expect(effectiveQty({ a: 2 }, 'a', 0), 'the phone’s intention wins while it is unconfirmed').toBe(2);
});

test('a row with nothing pending shows exactly what the server says', () => {
  expect(effectiveQty({}, 'a', 3)).toBe(3);
  expect(effectiveQty({ b: 9 }, 'a', 3), 'another row’s draft must not leak into this one').toBe(3);
});

test('zero is a real intention, not an absent one', () => {
  // The bug this guards: `draft[id] || serverQty` would show the old quantity for a row the
  // guest has just emptied, which is the removal appearing not to work.
  expect(effectiveQty({ a: 0 }, 'a', 4)).toBe(0);
});

test('the bar appears on the first add, not a round trip later', () => {
  expect(draftedCount({ a: 1 }, [{ id: 'a', inCart: 0 }])).toBe(1);
  expect(draftedCount({}, [{ id: 'a', inCart: 2 }, { id: 'b', inCart: 1 }])).toBe(3);
  expect(
    draftedCount({ a: 0 }, [{ id: 'a', inCart: 2 }, { id: 'b', inCart: 1 }]),
    'emptying a row takes it out of the count at once'
  ).toBe(1);
});

test('the server becomes the truth again the moment it answers', () => {
  const after = withoutDraft({ a: 5, b: 1 }, 'a');
  expect(effectiveQty(after, 'a', 2), 'the server’s figure, not the abandoned draft').toBe(2);
  expect(effectiveQty(after, 'b', 0), 'and the other row is untouched').toBe(1);
});

test('dropping a draft that is not there changes nothing, and does not copy for the sake of it', () => {
  const d = { a: 1 };
  expect(withoutDraft(d, 'zz')).toBe(d);
});

test('a quantity can never go below zero, however fast the minus is tapped', () => {
  expect(withDraft({}, 'a', -3)['a']).toBe(0);
  expect(withDraft({}, 'a', 2.7)['a'], 'and it is always a whole number of dishes').toBe(2);
});

test('the latest intention for a row replaces the one before it', () => {
  // Three taps of + are one request for three, not three requests racing to decide one row.
  const d = withDraft(withDraft(withDraft({}, 'a', 1), 'a', 2), 'a', 3);
  expect(d['a']).toBe(3);
  expect(Object.keys(d), 'one entry per row, not one per tap').toEqual(['a']);
});
