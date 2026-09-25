import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { captainMayAssignWaiter } from '../../src/lib/status';

/**
 * A captain assigns the waiter on their own bill (24-Sep correction list, G1).
 *
 * Only the owner could name a waiter (`bill.reassign_staff`, Owner/Admin only, because the tip
 * follows the CAPTAIN). The waiter moves no money, so a captain may now set the waiter on a bill
 * that is theirs and still open, under the grant they already hold for running tables
 * (`tables.assign`). The captain's own position is still the owner's.
 */

const grants = (...keys: string[]) => ({ can: (k: string) => keys.includes(k) });
const IMRAN = { staffId: 'imran', grants: grants('tables.assign', 'orders.add_items') };
const MINE = { captainId: 'imran', status: 'open' };

test('the captain of an open bill may set its waiter', () => {
  expect(captainMayAssignWaiter({ role: 'waiter', actor: IMRAN, bill: MINE })).toBe(true);
});

test('but not the captain position - the tip follows that one', () => {
  expect(captainMayAssignWaiter({ role: 'captain', actor: IMRAN, bill: MINE })).toBe(false);
});

test("not on another captain's bill, not on a closed one, not without the grant", () => {
  expect(
    captainMayAssignWaiter({ role: 'waiter', actor: IMRAN, bill: { captainId: 'ramesh', status: 'open' } })
  ).toBe(false);
  expect(
    captainMayAssignWaiter({ role: 'waiter', actor: IMRAN, bill: { captainId: 'imran', status: 'closed' } })
  ).toBe(false);
  expect(
    captainMayAssignWaiter({
      role: 'waiter',
      actor: { staffId: 'imran', grants: grants('orders.add_items') },
      bill: MINE,
    })
  ).toBe(false);
  expect(
    captainMayAssignWaiter({ role: 'waiter', actor: { staffId: null, grants: grants('tables.assign') }, bill: MINE })
  ).toBe(false);
});

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('the server applies the same rule, and the owner grant still covers both positions', () => {
  const m = code('src/lib/db/mutations.ts');
  const fn = m.slice(m.indexOf('export async function reassignBillStaff'));
  expect(fn).toMatch(
    /if \(!\(input\.actor\.grants\?\.can\('bill\.reassign_staff'\) \?\? false\)\) \{\s*if \(!captainMayAssignWaiter\(/
  );
  expect(fn).toContain("throw new PermissionDenied('bill.reassign_staff')");
  // The eligibility check on the person chosen is unchanged.
  expect(fn).toContain('canHoldBillRole(input.role, candidate.role as string)');
});

test('the captain phone offers it exactly where the server allows it', () => {
  expect(code('src/lib/db/staff-view.ts')).toContain(
    "canAssignWaiter: captainMayAssignWaiter({ role: 'waiter', actor, bill: b })"
  );
  expect(code('src/app/api/staff/action/route.ts')).toContain(
    "reassignBillStaff({ billId: input.billId, role: 'waiter', staffId: input.staffId, actor })"
  );
  const ui = code('src/features/staff/StaffTables.tsx');
  expect(ui).toContain('{bill.canAssignWaiter ? (');
  expect(ui).toContain("action: 'assign-waiter'");
});

/* ── Appended 24-Sep-2026, after review ──────────────────────────────── */

test('not on a voided bill either - only one that is open or asked to pay', () => {
  expect(captainMayAssignWaiter({ role: 'waiter', actor: IMRAN, bill: { captainId: 'imran', status: 'void' } })).toBe(
    false
  );
  expect(
    captainMayAssignWaiter({
      role: 'waiter',
      actor: IMRAN,
      bill: { captainId: 'imran', status: 'payment_requested' },
    })
  ).toBe(true);
});
