/**
 * Who may be the captain or the waiter on a bill.
 *
 * WHY THIS GUARDS MONEY AND NOT JUST A LIST
 *   The "Captain on B-1043" sheet offered every active person — Chefs, Cleaning staff, the
 *   Cashier — and `reassignBillStaff` wrote whatever id it was given straight into
 *   `captain_staff_id`. An UNSETTLED TIP FOLLOWS THE CAPTAIN, so a Cleaning staff member could be
 *   made captain on a bill and have somebody else's gratuity moved onto their name, with an audit
 *   line saying an owner did it deliberately.
 *
 *   Both halves were wrong at once: the dialog promised captains and delivered everyone, and the
 *   write checked nothing. That is rule 3 of `mutations.ts` — the server re-checks what the UI
 *   checked — broken in both directions, which is why the fix is one predicate that both call.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026): run against the pre-change rule, modelled exactly — the
 * picker's `data.staff.filter((p) => p.active)` and a mutation with no candidate check.
 *   OBSERVED FAILING — **6 failed, 3 passed**:
 *     · "A CLEANING STAFF MEMBER MAY NOT BE THE CAPTAIN" — expected false, received true
 *     · "A WAITER MAY NOT BE PROMOTED TO CAPTAIN by a picker" — expected false, received true
 *     · "a Chef may not be the captain, and neither may the Cashier" — expected false, received true
 *     · "a captain MAY run food — the asymmetry is the real hierarchy" — the old rule had no
 *       asymmetry to assert, so even the permissive half of it was unproven
 *     · "THE PICKER OFFERS CAPTAINS ONLY" — received all seven active people
 *     · "the waiter picker offers waiters, captains and the owner" — same
 *
 *   The three that passed are worth naming too: a Captain and the Owner MAY hold the position
 *   (true before and after, because the old rule permitted everybody), a removed person is not
 *   offered (the `active` filter was the one thing the old rule did do), and the current holder
 *   is offered. A suite asserting only the PERMISSIONS would have been fully green against a
 *   rule that permits everything — which is exactly the failure mode the six exist to close.
 */
import { test, expect } from '@playwright/test';
import { canHoldBillRole, eligibleForBillRole } from '../../src/lib/status';

const PEOPLE = [
  { id: 'cap1', name: 'Imran', role: 'Captain', active: true },
  { id: 'cap2', name: 'Karthik', role: 'Captain', active: true },
  { id: 'wai1', name: 'Mani', role: 'Waiter', active: true },
  { id: 'chef', name: 'Anand', role: 'Chef', active: true },
  { id: 'cash', name: 'Farhan', role: 'Cashier', active: true },
  { id: 'clean', name: 'Suresh', role: 'Cleaning', active: true },
  { id: 'own', name: 'Javeed Ahmed', role: 'Owner / Admin', active: true },
  { id: 'gone', name: 'Old Captain', role: 'Captain', active: false },
];

test('a Captain may be the captain, and so may the owner who runs tables himself', () => {
  expect(canHoldBillRole('captain', 'Captain')).toBe(true);
  expect(canHoldBillRole('captain', 'Owner / Admin')).toBe(true);
});

test('A CLEANING STAFF MEMBER MAY NOT BE THE CAPTAIN — the tip follows that name', () => {
  expect(canHoldBillRole('captain', 'Cleaning')).toBe(false);
});

test('a Chef may not be the captain, and neither may the Cashier', () => {
  expect(canHoldBillRole('captain', 'Chef')).toBe(false);
  expect(canHoldBillRole('captain', 'Cashier')).toBe(false);
});

test('A WAITER MAY NOT BE PROMOTED TO CAPTAIN by a picker — that is the position the tip attaches to', () => {
  expect(canHoldBillRole('captain', 'Waiter')).toBe(false);
});

test('a captain MAY run food — the asymmetry is the real hierarchy', () => {
  expect(canHoldBillRole('waiter', 'Captain')).toBe(true);
  expect(canHoldBillRole('waiter', 'Waiter')).toBe(true);
  expect(canHoldBillRole('waiter', 'Chef')).toBe(false);
});

test('THE PICKER OFFERS CAPTAINS ONLY, not every active person', () => {
  const offered = eligibleForBillRole('captain', PEOPLE, null).map((p) => p.name);
  expect(offered).toEqual(['Imran', 'Karthik', 'Javeed Ahmed']);
});

test('the waiter picker offers waiters, captains and the owner', () => {
  const offered = eligibleForBillRole('waiter', PEOPLE, null).map((p) => p.name);
  expect(offered).toEqual(['Imran', 'Karthik', 'Mani', 'Javeed Ahmed']);
});

test('a removed person is not offered, however senior they were', () => {
  expect(eligibleForBillRole('captain', PEOPLE, null).map((p) => p.id)).not.toContain('gone');
});

test('THE CURRENT HOLDER IS ALWAYS OFFERED, even if the old unchecked write put them there', () => {
  // Somebody wrongly made captain by the old rule is still recorded as captain today. A list
  // that filtered them out would make the mistake permanent: the one name needed to undo it
  // would be the one name missing.
  const offered = eligibleForBillRole('captain', PEOPLE, 'clean').map((p) => p.name);
  expect(offered).toContain('Suresh');
  expect(offered).toContain('Imran');
});
