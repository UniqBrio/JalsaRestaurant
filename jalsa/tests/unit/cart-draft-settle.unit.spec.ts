/**
 * A tap made while an earlier write is in flight must count (27-Oct-2026).
 *
 * Found on the rig, where the functional tier ran against a real database for the first time in
 * this container: `guest-total-visibility` › `a tap lands on the row at once` went red in 2 of 2
 * full runs — three taps of +, the row showed 2. Under load the taps landed more than the 200 ms
 * collapse apart, so the first write left alone; when it answered, GuestApp dropped the row's
 * draft outright, the row fell back to the server's 1, and the third tap counted up from that.
 *
 * FAIL-FIRST: the functional rung above (observed red twice, green 3 of 3 in isolation — a timing
 * defect). The source pin below fails on the pre-fix GuestApp, which called `withoutDraft` on
 * every answer.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { effectiveQty, settleDraft } from '../../src/lib/cart-draft';

const GUEST_APP = fileURLToPath(new URL('../../src/features/guest/GuestApp.tsx', import.meta.url));

test('an older write answering does not erase a newer tap', () => {
  // + at 0 ms (a write for 1 leaves), + at 300 ms (draft 2, not yet sent), the write for 1 answers.
  const d = settleDraft({ a: 2 }, 'a', 1);
  expect(effectiveQty(d, 'a', 1), 'still the newer intention, not the server’s older 1').toBe(2);
});

test('the write carrying the shown figure settles it — on success or failure alike', () => {
  expect(settleDraft({ a: 2, b: 1 }, 'a', 2)).toEqual({ b: 1 });
  const same = { a: 2 };
  expect(settleDraft(same, 'zz', 2), 'another row: nothing changes, nothing is copied').toBe(same);
});

test('GuestApp settles a row only by its own write, and never while a newer one waits to leave', () => {
  const src = readFileSync(GUEST_APP, 'utf8');
  expect(src).toMatch(/if \(!unsent\.current\.has\(itemId\)\) setDraft\(\(d\) => settleDraft\(d, itemId, qty\)\)/);
  expect(src, 'no unconditional drop on an answer').not.toMatch(/setDraft\(\(d\) => withoutDraft\(d, itemId\)\)/);
});
