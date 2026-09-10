/**
 * permissions unit spec — the matrix, and the two properties that make it a boundary.
 *
 * FAIL-FIRST EVIDENCE (10-Sep-2026, executed against the actual module):
 *   OBSERVED FAILING — "a waiter cannot see a bill's total" was run first against a Waiter
 *   preset that included `bill.view`, which is the natural thing to grant somebody who works on
 *   tables. It failed: expected false, received true. The design shows the sentence "Bill
 *   amounts are hidden for waiters" ON the waiter's own screen, and a sentence like that is only
 *   worth something if the grant behind it is actually absent.
 *
 *   OBSERVED FAILING — "an empty grant set permits nothing" was run against a `Grants.can` that
 *   returned true when the set was empty (`this.keys.size === 0 || this.keys.has(key)`), a
 *   plausible-looking "no restrictions configured" default. It failed on the first assertion:
 *   expected false, received true. That default is how an unconfigured account ends up able to
 *   close bills.
 *
 *   NOT OBSERVED FAILING: "every preset names a permission that exists". It is a consistency
 *   check over two literals in the same file, and it cannot fail without one of them being
 *   edited — which is exactly the edit it is there to catch.
 */
import { test, expect } from '@playwright/test';
import {
  ALL_PERMISSION_KEYS,
  Grants,
  isConfidential,
  PERMISSION_GROUPS,
  PermissionDenied,
  permissionLabel,
  ROLE_PRESETS,
} from '../../src/lib/permissions';

/* ── Grants ────────────────────────────────────────────────────────────── */

test('an empty grant set permits nothing', () => {
  const none = new Grants([]);
  expect(none.can('bill.record_payment')).toBe(false);
  expect(none.can('orders.view')).toBe(false);
  expect(none.can('anything.at.all')).toBe(false);
  expect(none.list()).toEqual([]);
});

test('a grant set permits exactly what it lists, and nothing adjacent', () => {
  const g = new Grants(['orders.view', 'orders.add_items']);
  expect(g.can('orders.view')).toBe(true);
  expect(g.can('orders.add_items')).toBe(true);
  // Neither a prefix nor a sibling is an implicit grant.
  expect(g.can('orders.cancel_after')).toBe(false);
  expect(g.can('orders')).toBe(false);
});

test('a duplicated grant is still one grant', () => {
  const g = new Grants(['tips.own', 'tips.own', 'tips.own']);
  expect(g.list()).toEqual(['tips.own']);
});

/* ── The presets ───────────────────────────────────────────────────────── */

test('a waiter cannot see a bill total', () => {
  // The waiter's screen SAYS amounts are hidden. The grant has to actually be absent, or the
  // sentence is decoration and the figures are one response away.
  expect(ROLE_PRESETS.Waiter).not.toContain('bill.view');
  expect(new Grants(ROLE_PRESETS.Waiter ?? []).can('bill.view')).toBe(false);
});

test('a captain may close a bill; a waiter may not', () => {
  expect(new Grants(ROLE_PRESETS.Captain ?? []).can('bill.record_payment')).toBe(true);
  expect(new Grants(ROLE_PRESETS.Waiter ?? []).can('bill.record_payment')).toBe(false);
});

test('nobody but the owner may cancel after the kitchen has started', () => {
  for (const [role, keys] of Object.entries(ROLE_PRESETS)) {
    if (role === 'Owner / Admin') continue;
    expect(new Grants(keys).can('orders.cancel_after'), `${role} must not hold cancel_after`).toBe(false);
  }
  expect(new Grants(ROLE_PRESETS['Owner / Admin'] ?? []).can('orders.cancel_after')).toBe(true);
});

test('nobody but the owner may change a price', () => {
  for (const [role, keys] of Object.entries(ROLE_PRESETS)) {
    if (role === 'Owner / Admin') continue;
    expect(new Grants(keys).can('menu.price_edit'), `${role} must not hold price_edit`).toBe(false);
  }
});

test('the owner preset holds every permission that exists, including ones added later', () => {
  // Listing them individually is how a NEW permission silently fails to reach the person whose
  // job is to grant it.
  expect(ROLE_PRESETS['Owner / Admin']).toEqual(ALL_PERMISSION_KEYS);
});

test('every preset names a permission that exists', () => {
  const known = new Set(ALL_PERMISSION_KEYS);
  for (const [role, keys] of Object.entries(ROLE_PRESETS)) {
    for (const key of keys) {
      expect(known.has(key), `${role} grants unknown permission "${key}"`).toBe(true);
    }
  }
});

/* ── The matrix itself ─────────────────────────────────────────────────── */

test('every permission key is unique across the whole matrix', () => {
  const seen = new Set<string>();
  for (const key of ALL_PERMISSION_KEYS) {
    expect(seen.has(key), `duplicate permission key "${key}"`).toBe(false);
    seen.add(key);
  }
});

test('every permission has a human label — the panel can never render a raw key', () => {
  for (const key of ALL_PERMISSION_KEYS) {
    expect(permissionLabel(key)).not.toBe(key);
    expect(permissionLabel(key).length).toBeGreaterThan(3);
  }
});

test('an unknown key is shown as itself rather than hidden', () => {
  // A permission the panel cannot name is a bug, and hiding it is how it stays one.
  expect(permissionLabel('some.future.permission')).toBe('some.future.permission');
});

test('the permissions that touch money, access or employment are marked confidential', () => {
  expect(isConfidential('menu.price_edit')).toBe(true);
  expect(isConfidential('bill.void')).toBe(true);
  expect(isConfidential('staff.perms')).toBe(true);
  expect(isConfidential('staff.pin')).toBe(true);
  expect(isConfidential('tips.all')).toBe(true);
  expect(isConfidential('set.tax')).toBe(true);
  // …and the ordinary ones are not, or the badge means nothing.
  expect(isConfidential('orders.view')).toBe(false);
  expect(isConfidential('menu.view')).toBe(false);
});

test('counting grants within a group counts only that group', () => {
  const billing = PERMISSION_GROUPS.find((g) => g.name === 'Billing');
  expect(billing).toBeTruthy();
  const g = new Grants(['bill.view', 'bill.reprint', 'orders.view']);
  expect(g.countIn(billing!)).toBe(2);
});

/* ── The refusal ───────────────────────────────────────────────────────── */

test('a refusal names the permission in words the denied screen can print', () => {
  const err = new PermissionDenied('bill.record_payment');
  expect(err.permission).toBe('bill.record_payment');
  expect(err.message).toContain('Record payment and close a bill');
  expect(err.name).toBe('PermissionDenied');
});
