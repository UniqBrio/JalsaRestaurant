import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dayIn, dayWindow, nowForRangeCheck, startOfDay, RESTAURANT_TIME_ZONE } from '../../src/lib/restaurant-time';
import { checkRange } from '../../src/lib/report-range';

/**
 * R-025 — "In 'Report' section, nothing is showing up".
 *
 * ROOT CAUSE, not the symptom: a report range is a pair of CALENDAR DAYS, and turning a calendar
 * day into an instant needs a zone. `listClosedBillsBetween` used `new Date('2026-09-22T00:00:00')`,
 * which has no offset and is therefore read in the HOST's zone. Vercel runs in UTC, so the window
 * for a day began at 05:30 that morning in Hosur and ended at 05:30 the next.
 *
 * The proof this is real and not theoretical is bill B-1048 in the live database: settled at
 * 18:46:01Z on 21-Sep, which is 00:16 on 22-Sep in the restaurant. Under the old window it was
 * absent from the 22nd and present on the 21st. Both readings are wrong.
 *
 * These cases exercise the real functions. Two of them also pin the source, because a helper
 * nothing calls fixes nothing — that is exactly how this defect survived a green suite before.
 */

/** 00:16 IST on 22-Sep-2026, as stored. The live bill this defect was proven against. */
const AFTER_MIDNIGHT = new Date('2026-09-21T18:46:01.597Z');

test('the zone is the restaurant, and it is stated once', () => {
  expect(RESTAURANT_TIME_ZONE).toBe('Asia/Kolkata');
});

test('a day begins at local midnight, not at UTC midnight', () => {
  // 22-Sep in Hosur begins at 18:30Z on the 21st. The old code began it at 00:00Z on the 22nd.
  expect(startOfDay('2026-09-22').toISOString()).toBe('2026-09-21T18:30:00.000Z');
  expect(startOfDay('2026-01-01').toISOString()).toBe('2025-12-31T18:30:00.000Z');
});

test('a sitting that ended after midnight belongs to the day it ended, not the day before', () => {
  const today = dayWindow('2026-09-22', '2026-09-22');
  expect(AFTER_MIDNIGHT >= today.start, 'inside the 22nd').toBe(true);
  expect(AFTER_MIDNIGHT < today.end, 'and not past its end').toBe(true);

  const yesterday = dayWindow('2026-09-21', '2026-09-21');
  expect(AFTER_MIDNIGHT >= yesterday.end, 'and therefore NOT on the 21st').toBe(true);
});

test('the window is half-open, so the last millisecond of a day is still in it', () => {
  const { start, end } = dayWindow('2026-09-22', '2026-09-22');
  const lastMoment = new Date(end.getTime() - 1);
  expect(lastMoment >= start && lastMoment < end).toBe(true);
  // A single day spans exactly 24 hours; a multi-day range spans its own count.
  expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  const week = dayWindow('2026-09-16', '2026-09-22');
  expect(week.end.getTime() - week.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
});

test('a range spanning a month end does not lose or gain a day', () => {
  const { start, end } = dayWindow('2026-08-31', '2026-09-01');
  expect(start.toISOString()).toBe('2026-08-30T18:30:00.000Z');
  expect(end.toISOString()).toBe('2026-09-01T18:30:00.000Z');
});

test('which day a stored instant belongs to is read in the restaurant, not in UTC', () => {
  expect(dayIn(AFTER_MIDNIGHT), 'after midnight locally, still yesterday in UTC').toBe('2026-09-22');
  expect((AFTER_MIDNIGHT.toISOString() ?? '').slice(0, 10), 'what the old code stamped').toBe('2026-09-21');
  // Mid-afternoon, where the two agree — so the fix cannot be "add a day to everything".
  expect(dayIn(new Date('2026-09-17T11:39:50.458Z'))).toBe('2026-09-17');
});

test('the server no longer calls a shift in progress "the future"', () => {
  // 00:16 IST on the 22nd. The owner asks for the 22nd; the server clock still says the 21st.
  const verdict = checkRange({ from: '2026-09-22', to: '2026-09-22' }, nowForRangeCheck(AFTER_MIDNIGHT));
  expect(verdict.problem, 'today is never in the future').toBe(null);
  // A range that really is ahead is still refused — the check was corrected, not removed.
  const ahead = checkRange({ from: '2026-09-23', to: '2026-09-23' }, nowForRangeCheck(AFTER_MIDNIGHT));
  expect(ahead.problem).toContain('has not happened yet');
});

test('the range query builds its window from the restaurant day', () => {
  const src = readFileSync('src/lib/db/queries.ts', 'utf8');
  expect(src, 'the helper is actually called').toContain('dayWindow(from, to)');
  expect(src, 'and the host-local parse is gone').not.toContain("new Date(`${from}T00:00:00`)");
});

test('the report route reads today and stamps the day in the restaurant zone', () => {
  const src = readFileSync('src/app/api/owner/report/route.ts', 'utf8');
  expect(src, 'validated against the restaurant clock').toContain('nowForRangeCheck()');
  expect(src, 'and each bill stamped by its local day').toContain('dayIn(new Date(b.closedAt))');
  expect(src, 'the UTC slice is gone').not.toContain("(b.closedAt ?? '').slice(0, 10)");
});
