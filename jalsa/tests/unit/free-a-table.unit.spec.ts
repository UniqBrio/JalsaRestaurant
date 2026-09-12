/**
 * Freeing a table by hand — the permission that allows it and the rule that bounds it.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change tree's own rules, modelled
 * exactly: the Tables permission group ended at `tables.transfer`, and no floor view carried any
 * notion of a table that could be released by hand):
 *   OBSERVED FAILING — 2 failed of 3:
 *     · "there is a permission for freeing a table by hand" — `expected [..] to contain
 *       "tables.free"`. There was no such key, which is the whole of "there is no way we can
 *       free the table".
 *     · "a table held by an empty bill can be released" — `expected true, received false`.
 *
 *   NOT OBSERVED FAILING — "a table with food in the kitchen cannot be freed". It passed against
 *   the pre-change rule, because that rule was `false` for every table: nothing could be freed,
 *   so nothing unsafe could be freed either. It is asserted anyway, and it is the assertion that
 *   matters most here — it is the only thing standing between a tile on a floor grid and writing
 *   off a bill, and the fix that made the other two pass is exactly the fix that could break it.
 */
import { test, expect } from '@playwright/test';
import { tableIsFreeable } from '../../src/lib/status';
import { ALL_PERMISSION_KEYS, ROLE_PRESETS } from '../../src/lib/permissions';

test('there is a permission for freeing a table by hand', () => {
  expect(ALL_PERMISSION_KEYS).toContain('tables.free');
});

test('the owner holds it and no other role gets it by default', () => {
  // "Owner can mark this feature to someone else in RBAC like captains" — a GRANT, per person,
  // not a role preset. A captain who has it was given it; a captain who has not, was not.
  expect(ROLE_PRESETS['Owner / Admin']).toContain('tables.free');
  expect(ROLE_PRESETS['Captain'], 'captains are granted it individually, never by role').not.toContain('tables.free');
  expect(ROLE_PRESETS['Waiter']).not.toContain('tables.free');
  expect(ROLE_PRESETS['Cashier']).not.toContain('tables.free');
  expect(ROLE_PRESETS['Chef']).not.toContain('tables.free');
});

test('a table held by an empty bill can be released', () => {
  // The stuck case: a bill opened, nothing ordered, the party gone. The partial unique index
  // then refuses the next party's bill on that table, and nothing could let go of it.
  expect(tableIsFreeable({ roundCount: 0, billId: 'b1', phonesAttached: 0 })).toBe(true);
});

test('a phone left attached with a cart on it is enough to offer the release', () => {
  expect(tableIsFreeable({ roundCount: 0, billId: null, phonesAttached: 1 })).toBe(true);
});

test('a table with food in the kitchen cannot be freed, at any count', () => {
  // THE guard. A tile on a floor grid must never be able to write off a bill.
  expect(tableIsFreeable({ roundCount: 1, billId: 'b1', phonesAttached: 0 })).toBe(false);
  expect(tableIsFreeable({ roundCount: 9, billId: 'b1', phonesAttached: 3 })).toBe(false);
  expect(tableIsFreeable({ roundCount: 1, billId: null, phonesAttached: 1 })).toBe(false);
});

test('an untouched table is not offered a release it does not need', () => {
  // It is already free. Twenty "Mark free" buttons on an empty floor is noise on the screen
  // that matters most during service.
  expect(tableIsFreeable({ roundCount: 0, billId: null, phonesAttached: 0 })).toBe(false);
});
