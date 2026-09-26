import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { emptyRangeCopy } from '../../src/lib/report-range';
import { shortDayLabel } from '../../src/lib/restaurant-time';

/**
 * Reports on Today with no bill closed yet (24-Sep correction list, A1).
 *
 * The morning after 23-Sep, Reports opened on Today and said "Nothing in this range" - true, and
 * read as "the payment I recorded is missing". Today now says so plainly, names the ACTUAL last
 * bill (read by the route, never invented) and offers Yesterday. With no earlier bill there is
 * no "Last bill" line and no button.
 */

const B1044 = { code: 'B-1044', closedOn: '2026-09-23', closedOnLabel: '23 Sep' };

test('Today with an earlier bill: says no bills today, names the last one, offers Yesterday', () => {
  const copy = emptyRangeCopy('today', B1044);
  expect(copy.title).toBe('No bills closed today.');
  expect(copy.lastBill).toBe('Last bill: B-1044 • 23 Sep');
  expect(copy.offerYesterday).toBe(true);
});

test('Today with no bill ever: the plain empty state, no invented bill, no button', () => {
  const copy = emptyRangeCopy('today', null);
  expect(copy.title).toBe('No bills closed today.');
  expect(copy.lastBill).toBeNull();
  expect(copy.offerYesterday).toBe(false);
});

test('any other range keeps the generic sentence and offers nothing', () => {
  for (const preset of ['yesterday', 'last7', 'last30', 'thisMonth', 'custom'] as const) {
    const copy = emptyRangeCopy(preset, B1044);
    expect(copy.title, preset).toBe('Nothing in this range');
    expect(copy.lastBill, preset).toBeNull();
    expect(copy.offerYesterday, preset).toBe(false);
  }
});

test('the day label is "23 Sep", the same in every runtime', () => {
  expect(shortDayLabel('2026-09-23')).toBe('23 Sep');
  expect(shortDayLabel('2026-01-05')).toBe('5 Jan');
});

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('the last bill is READ: the latest closed bill before the range start, in IST', () => {
  const q = code('src/lib/db/queries.ts');
  const fn = q.slice(q.indexOf('export async function lastClosedBillBefore'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  expect(body).toContain(".eq('status', 'closed')");
  expect(body).toContain('dayWindow(from, from)');
  expect(body).toContain(".lt('closed_at', start.toISOString())");
  expect(body).toContain(".order('closed_at', { ascending: false })");
  expect(body).toContain('.limit(1)');
  const route = code('src/app/api/owner/report/route.ts');
  expect(route).toContain('lastClosedBillBefore(from)');
  expect(route).toContain('closedOnLabel: shortDayLabel(dayIn(new Date(lastBefore.closedAt)))');
});

test('the screen wires the button to the Yesterday preset', () => {
  const screen = code('src/features/owner/sections/ReportsSection.tsx');
  expect(screen).toContain("onYesterday={() => pick('yesterday')}");
  expect(screen).toContain("label: 'View Yesterday'");
});
