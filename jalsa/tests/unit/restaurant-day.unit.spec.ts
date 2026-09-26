import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  dateLabelIn,
  nowForRangeCheck,
  shiftDay,
  timeLabelIn,
  todayIn,
  todayWindow,
  weekdayIn,
} from '../../src/lib/restaurant-time';
import { resolvePreset } from '../../src/lib/report-range';

/**
 * The restaurant's day, at the five instants the 24-Sep correction list names (RC-016).
 *
 * Every "today" the server computed used the HOST's midnight, and the host is UTC: the day began
 * at 05:30 IST. These pin the IST calendar at the edges where that was wrong, and pin that the
 * screens which said "today" now read the one helper instead of the host clock.
 */

// IST = UTC+05:30. Each instant is written in UTC, with the IST wall clock beside it.
const AT = {
  '23:59 on the 23rd': new Date('2026-09-23T18:29:00Z'),
  '00:00 on the 24th': new Date('2026-09-23T18:30:00Z'),
  '00:01 on the 24th': new Date('2026-09-23T18:31:00Z'),
  '05:29 on the 24th': new Date('2026-09-23T23:59:00Z'),
  '05:30 on the 24th': new Date('2026-09-24T00:00:00Z'),
};

test('today is the IST calendar day at every edge the list names', () => {
  expect(todayIn(AT['23:59 on the 23rd'])).toBe('2026-09-23');
  expect(todayIn(AT['00:00 on the 24th'])).toBe('2026-09-24');
  expect(todayIn(AT['00:01 on the 24th'])).toBe('2026-09-24');
  // The two a UTC host got wrong: its date is still the 23rd until 05:30 IST.
  expect(todayIn(AT['05:29 on the 24th'])).toBe('2026-09-24');
  expect(todayIn(AT['05:30 on the 24th'])).toBe('2026-09-24');
});

test("today's window runs IST midnight to IST midnight, whatever time it is asked", () => {
  for (const [label, at] of Object.entries(AT)) {
    const { start, end } = todayWindow(at);
    const day = todayIn(at);
    const expectedStart = day === '2026-09-23' ? '2026-09-22T18:30:00.000Z' : '2026-09-23T18:30:00.000Z';
    expect(start.toISOString(), label).toBe(expectedStart);
    expect(end.getTime() - start.getTime(), label).toBe(24 * 60 * 60 * 1000);
    expect(at >= start && at < end, `${label} falls inside its own day`).toBe(true);
  }
});

test('a bill settled at 00:20 IST counts on the new day, and one at 23:59 on the old', () => {
  const day24 = todayWindow(AT['05:30 on the 24th']);
  const at0020 = new Date('2026-09-23T18:50:00Z');
  const at2359 = AT['23:59 on the 23rd'];
  expect(at0020 >= day24.start && at0020 < day24.end).toBe(true);
  expect(at2359 >= day24.start && at2359 < day24.end).toBe(false);
});

test('yesterday and month edges are calendar arithmetic', () => {
  expect(shiftDay('2026-09-24', -1)).toBe('2026-09-23');
  expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
  expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
});

test('the Reports presets read the IST date, not the device date', () => {
  // A device in UTC at 00:01 IST on the 24th still believes it is the 23rd; the preset must not.
  const today = nowForRangeCheck(AT['00:01 on the 24th']);
  expect(resolvePreset('today', today)).toEqual({ from: '2026-09-24', to: '2026-09-24' });
  expect(resolvePreset('yesterday', today)).toEqual({ from: '2026-09-23', to: '2026-09-23' });
  expect(resolvePreset('thisMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-24' });
});

test('clock labels read the restaurant wall clock', () => {
  expect(timeLabelIn(AT['00:01 on the 24th'])).toMatch(/^12:01\s?am$/i);
  expect(timeLabelIn(AT['05:29 on the 24th'])).toMatch(/^5:29\s?am$/i);
  expect(dateLabelIn(AT['00:01 on the 24th'])).toMatch(/^24 Sep/);
  expect(dateLabelIn(AT['23:59 on the 23rd'])).toMatch(/^23 Sep/);
  // 24-Sep-2026 is a Thursday.
  expect(weekdayIn(AT['00:01 on the 24th'])).toBe(4);
  expect(weekdayIn(AT['23:59 on the 23rd'])).toBe(3);
});

/* ── Source pins: the screens that said "today" read the helper, not the host ── */

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('no server "today" is built from the host clock', () => {
  for (const f of [
    'src/lib/db/queries.ts',
    'src/lib/db/owner-view.ts',
    'src/lib/db/staff-view.ts',
    'src/lib/db/guest-view.ts',
    'src/lib/db/bridge-payload.ts',
    'src/app/q/page.tsx',
  ]) {
    const src = code(f);
    expect(src, `${f}: setHours(0…) is the host's midnight`).not.toMatch(/setHours\(0/);
    expect(src, `${f}: getDay() is the host's weekday`).not.toMatch(/new Date\(\)\.getDay\(\)/);
    expect(src, `${f}: a time with no zone is the host's clock`).not.toMatch(
      /toLocale(Time|Date)String\('en-IN', \{[^}]*\}\)/
    );
  }
  expect(code('src/lib/db/queries.ts')).toMatch(/listClosedBillsToday[\s\S]*?todayWindow\(\)/);
});

test('no screen names "today" with the UTC date', () => {
  for (const f of [
    'src/features/owner/sections/StaffPaperwork.tsx',
    'src/features/owner/sections/LedgersSection.tsx',
    'src/components/ui/data-table.tsx',
  ]) {
    expect(code(f), f).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0, (7|10)\)/);
  }
  expect(code('src/features/owner/sections/ReportsSection.tsx')).not.toMatch(/resolvePreset\([^)]*new Date\(\)\)/);
});
