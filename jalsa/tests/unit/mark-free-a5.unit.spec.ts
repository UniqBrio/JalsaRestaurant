import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { phonesHoldingTables, tableIsFreeable, tableStateFrom } from '../../src/lib/status';

/**
 * Mark Table Free, and A5 (25-Sep correction list, items 35 and 36).
 *
 * THE REPRODUCTION, FROM THE LIVE ROWS (read 25-Sep-2026): A5 had six bills, every one closed and
 * released, and 14 guest_session rows from 18-Sep to 25-Sep - none of them with an open bill.
 * The floor counted all 14 as "phones attached", so A5 was freeable, and showed Mark free, while
 * nothing was at it. Mark free on a table with an empty bill voided the bill - and the floor's
 * `listOpenBills` (`status <> 'closed'`) still counted the VOID bill as holding the table, so the
 * button stayed; pressing it again found "No open bill" and changed nothing.
 */

const code = (p: string): string => readFileSync(p, 'utf8');

const A5 = 'a5';
const CLOSED = 'b-1049';

test('A5 as it was: fourteen old phones, no open bill - no phone holds it and Mark free is not offered', () => {
  const sessions = Array.from({ length: 14 }, (_, i) => ({ id: `s${i}`, table_id: A5, bill_id: i % 2 ? CLOSED : null }));
  const holding = phonesHoldingTables(sessions, new Set(), new Set());
  expect(holding.get(A5) ?? 0).toBe(0);
  expect(tableIsFreeable({ roundCount: 0, billId: null, phonesAttached: holding.get(A5) ?? 0 })).toBe(false);
  expect(tableStateFrom({ hasBill: false, kotStatuses: [], awaitingClearing: false })).toBe('free');
});

test('a phone with an unsent cart, or on the open bill, still holds the table - so Mark free appears', () => {
  const sessions = [
    { id: 'cart', table_id: A5, bill_id: null },
    { id: 'open', table_id: 'a6', bill_id: 'b-open' },
    { id: 'paid', table_id: 'a7', bill_id: CLOSED },
  ];
  const holding = phonesHoldingTables(sessions, new Set(['cart']), new Set(['b-open']));
  expect(holding.get(A5)).toBe(1);
  expect(holding.get('a6')).toBe(1);
  expect(holding.get('a7')).toBeUndefined();
  expect(tableIsFreeable({ roundCount: 0, billId: null, phonesAttached: 1 })).toBe(true);
});

test('occupied: an open bill with no rounds is freeable; with a round it is not (the server refuses too)', () => {
  expect(tableIsFreeable({ roundCount: 0, billId: 'b', phonesAttached: 0 })).toBe(true);
  expect(tableIsFreeable({ roundCount: 1, billId: 'b', phonesAttached: 0 })).toBe(false);
});

test('a void bill no longer holds a table on the floor; an open one holds only the tables it has not released', () => {
  const q = code('src/lib/db/queries.ts');
  const open = q.slice(q.indexOf('export async function listOpenBills'), q.indexOf('export async function listClosedBillsToday'));
  expect(open).toContain(".in('status', ['open', 'payment_requested'])");
  expect(open).not.toContain(".neq('status', 'closed')");
  expect(q).toContain(".filter((m) => !live || !m.released_at)");
});

test('Mark free leaves the table Free, not "needs clearing" - it stamps cleared_at', () => {
  const m = code('src/lib/db/mutations.ts');
  const fn = m.slice(m.indexOf('export async function freeTable'), m.indexOf('export async function reassignBillStaff'));
  expect(fn).toContain(".update({ cleared_at: new Date().toISOString(), cleared_by: input.actor.label })");
  // After it: no open bill, nothing uncleared, no phone -> free, and no Mark free.
  expect(tableStateFrom({ hasBill: false, kotStatuses: [], awaitingClearing: false })).toBe('free');
  expect(tableIsFreeable({ roundCount: 0, billId: null, phonesAttached: 0 })).toBe(false);
});

test('re-occupied after being freed: the new party decides the state, whatever an old release left', () => {
  expect(tableStateFrom({ hasBill: true, billStatus: 'open', kotStatuses: [], awaitingClearing: true })).toBe('ordering');
  expect(tableStateFrom({ hasBill: true, billStatus: 'open', kotStatuses: ['new'], awaitingClearing: true })).toBe('in_the_kitchen');
});

test('both floors decide by the same predicate, from the server-computed state - a refresh reads it again', () => {
  expect(code('src/lib/db/owner-view.ts')).toContain('freeable: tableIsFreeable(t),');
  expect(code('src/features/staff/StaffTables.tsx')).toContain('canFree && tableIsFreeable(t)');
  expect(code('src/lib/db/queries.ts')).toContain('phonesHoldingTables(sessions, withCart, new Set(bills.map((b) => b.id)))');
});
