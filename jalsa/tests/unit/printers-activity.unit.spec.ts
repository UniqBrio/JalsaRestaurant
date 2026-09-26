import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addedOnLabel, bridgeActivityLabel, lastPrintedLabel } from '../../src/lib/print-computer';

/**
 * Printers - Delete, Added on, and the time that was wrong (25-Sep correction list, items 1, 2, 12).
 *
 * Item 12 was observed on the live data: Kitchen PC's `bridge_token.last_seen_at` was
 * 2026-09-24T16:45:57Z - an idle poll, the last one before the PC was switched off - and the
 * Bridges tab printed it as "Last collected 10:15 pm", with no date and in the browser's zone.
 * Nothing was collected then. The fix names the heartbeat for what it is and takes the ticket
 * time from the print job itself.
 */

const HEARTBEAT = '2026-09-24T16:45:57.857Z';

test('item 12: a heartbeat is never shown as a collection, and every time carries its date in IST', () => {
  const line = bridgeActivityLabel({ lastSeenAt: HEARTBEAT, lastTicketAt: null });
  expect(line).not.toContain('Last collected');
  expect(line).toBe('No ticket taken yet · last in touch 24 Sep 2026, 10:15 pm');
});

test('item 12: the ticket time is the job the bridge took, not its last poll', () => {
  const line = bridgeActivityLabel({ lastSeenAt: HEARTBEAT, lastTicketAt: '2026-09-24T12:52:40Z' });
  expect(line.startsWith('Last ticket 24 Sep 2026, 6:22 pm')).toBe(true);
});

test('item 12: a bridge that never connected says so', () => {
  expect(bridgeActivityLabel({ lastSeenAt: null, lastTicketAt: null })).toBe('Has never connected');
});

test('item 12: the IST day is used even when the UTC day differs', () => {
  // 20:00 UTC on the 24th is 01:30 on the 25th in Hosur.
  expect(lastPrintedLabel('2026-09-24T20:00:00Z')).toBe('Last printed 25 Sep 2026, 1:30 am');
  expect(lastPrintedLabel(null)).toBe('Nothing printed yet');
});

test('item 2: Added on is the creation date, in the restaurant calendar', () => {
  expect(addedOnLabel('2026-09-24T12:52:13.398Z')).toBe('Added on 24 Sep 2026');
  expect(addedOnLabel('2026-09-24T19:00:00Z')).toBe('Added on 25 Sep 2026');
});

test('item 2: the printer read carries created_at, and no update time is used', () => {
  const src = readFileSync('src/lib/db/queries.ts', 'utf8');
  const listPrinters = src.slice(src.indexOf('export async function listPrinters'), src.indexOf('async function latestPerKey'));
  expect(listPrinters).toContain('created_at');
  expect(listPrinters).toContain('createdAt: p.created_at');
  expect(listPrinters).not.toContain('updated_at');
});

test('item 1: the Printers screen lists every printer and deletes only through a confirmation naming it', () => {
  const src = readFileSync('src/features/owner/sections/PrintersSection.tsx', 'utf8');
  // Every printer, not only those on a computer.
  expect(src).toContain('...data.printers.filter((p) => !mappingByPrinter.has(p.id))');
  // The Delete button opens the dialog; it never calls the action itself.
  expect(src).toMatch(/owner-printers-delete-\$\{p\.id\}[\s\S]{0,200}onClick=\{\(\) => setDeleting\(p\)\}/);
  // The dialog names the printer and is the only caller of the delete action.
  expect(src).toContain('title={deleting ? `Delete ${deleting.name}?`');
  expect(src.match(/action: 'delete-printer'/g)?.length).toBe(1);
  expect(src).toMatch(/onConfirm=\{\(\) => deleting && removePrinter\(deleting\)\}/);
});

test('item 1: deleting keeps the print history - the job link is set null, not cascaded', () => {
  const schema = readFileSync('supabase/migrations/20260910070000_jalsa_core_schema.sql', 'utf8');
  expect(schema).toContain('printer_id     uuid references public.printer(id) on delete set null');
});
