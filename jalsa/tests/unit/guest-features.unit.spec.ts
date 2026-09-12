/**
 * guest-features unit spec — what a guest's phone shows before anyone has chosen anything, and
 * whether the owner's switch agrees with it.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change tree's own rules, modelled
 * exactly: the owner panel's `checked={values[key] !== false}` and a DEFAULT_FEATURES literal
 * with no `orderTotal` in it):
 *   OBSERVED FAILING — all three assertions below, `3 failed`:
 *     · "an unsaved feature resolves to its own default, not to 'on'"
 *       `expected false, received true` — the panel drew an unsaved key as ON, unconditionally.
 *     · "the owner switch and the guest phone agree about an unsaved feature"
 *       `expected false, received true` — the switch said the guest could see their total while
 *       the phone showed none. This is the defect the shared module exists to make impossible:
 *       two sides of a server boundary each holding their own idea of a default.
 *     · "the order total is off until someone turns it on"
 *       `expected false, received undefined` — there was no such default to read.
 *
 *   NOT OBSERVED FAILING — nothing in this file. Every assertion was run red first.
 */
import { test, expect } from '@playwright/test';
import { DEFAULT_FEATURES, resolveFeatures } from '../../src/lib/guest-features';

test('the order total is off until someone turns it on', () => {
  // The restaurant asked for the quieter default: a table reads the menu before it reads a
  // running total. The guest is not DENIED it — the tick box in the bottom bar is always there.
  expect(DEFAULT_FEATURES.orderTotal).toBe(false);
});

test('an unsaved feature resolves to its own default, not to "on"', () => {
  const resolved = resolveFeatures({ captainName: true });
  expect(resolved.orderTotal, 'off by default').toBe(false);
  expect(resolved.askBill, 'the other off-by-default feature').toBe(false);
  expect(resolved.water, 'and an on-by-default one is still on').toBe(true);
});

test('the owner switch and the guest phone agree about an unsaved feature', () => {
  // Both sides now call THIS function. The assertion is that there is no second answer to give.
  const stored = { captainName: true };
  const phone = resolveFeatures(stored);
  const panel = resolveFeatures(stored);
  expect(panel.orderTotal).toBe(phone.orderTotal);
  expect(panel).toEqual(phone);
});

test('a saved value always beats the default, in both directions', () => {
  expect(resolveFeatures({ orderTotal: true }).orderTotal, 'owner turned it on').toBe(true);
  expect(resolveFeatures({ water: false }).water, 'owner turned it off').toBe(false);
});

test('a missing or malformed document is the defaults, not a crash', () => {
  // readAllSettings returns whatever JSONB is in the row, including nothing at all on a
  // restaurant that has never opened the Settings screen.
  expect(resolveFeatures(undefined)).toEqual(DEFAULT_FEATURES);
  expect(resolveFeatures(null)).toEqual(DEFAULT_FEATURES);
  expect(resolveFeatures('not an object')).toEqual(DEFAULT_FEATURES);
});
