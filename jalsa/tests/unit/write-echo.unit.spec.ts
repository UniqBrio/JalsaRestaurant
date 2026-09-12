/**
 * write-echo unit spec — the two decisions either side of a guest's write.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change tree's own rules, modelled
 * exactly: `send` posting and then calling `refreshNow()` unconditionally, and a tip row of
 * four fixed presets with no custom option):
 *   OBSERVED FAILING — 3 failed:
 *     · "a write that answers with the new state costs one round trip, not two"
 *       `expected ["POST"], received ["POST","GET"]` — the phone went and fetched what the
 *       server had just written. With a poll already on the wire it fetched twice.
 *     · "adding from the upsell screen leaves the guest on the upsell screen"
 *       `expected "upsell", received "tip"` — one add and the screen was gone, which is why
 *       "a dessert, then a drink, then something for home" could not happen.
 *     · "the tip row offers a custom amount as well as the presets"
 *       `expected true, received false` — ₹50 was not reachable at all.
 *
 *   NOT OBSERVED FAILING — nothing in this file.
 */
import { test, expect } from '@playwright/test';
import { echoedState, parseCustomTip } from '../../src/lib/write-echo';

test('an object under `state` is the new state, and is used instead of a read', () => {
  expect(echoedState<{ phase: string }>({ tip: 20, state: { phase: 'live' } })).toEqual({ phase: 'live' });
});

test('no state means go and read it — the old path is still there', () => {
  expect(echoedState({ done: true })).toBeNull();
  expect(echoedState({ done: true, state: null })).toBeNull();
  expect(echoedState({ done: true, state: undefined })).toBeNull();
});

test('something that is not a state is never treated as one', () => {
  // A stray primitive applied as state would blank the screen — worse than the extra read.
  expect(echoedState({ state: 'ok' })).toBeNull();
  expect(echoedState({ state: 7 })).toBeNull();
  expect(echoedState({ state: [] })).toBeNull();
  expect(echoedState(null)).toBeNull();
  expect(echoedState('nope')).toBeNull();
});

test('a custom tip is whole rupees, above zero', () => {
  expect(parseCustomTip('50')).toEqual({ ok: true, amount: 50 });
  expect(parseCustomTip(' 250 ')).toEqual({ ok: true, amount: 250 });
  expect(parseCustomTip('35')).toEqual({ ok: true, amount: 35 });
});

test('everything a phone keyboard can produce that is not an amount is refused, in words', () => {
  for (const bad of ['', '   ', 'abc', '5.5', '-20', '1e3', '₹50', '20 20']) {
    const r = parseCustomTip(bad);
    expect(r.ok, `"${bad}" must be refused`).toBe(false);
    if (!r.ok) expect(r.problem.length, 'and refused with a sentence, not a code').toBeGreaterThan(0);
  }
});

test('zero is sent back to the No tip button rather than accepted as a custom tip', () => {
  // Two controls that mean the same thing is the thing to avoid; the row already has one.
  const r = parseCustomTip('0');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.problem).toContain('No tip');
});

test('there is no upper bound, and that is deliberate', () => {
  // Judging one needs the bill as a NUMBER on the phone, and this application keeps every rupee
  // of arithmetic on the server. Recorded as an assertion so a later "sanity limit" has to
  // argue with it rather than slip in.
  expect(parseCustomTip('100000')).toEqual({ ok: true, amount: 100000 });
});
