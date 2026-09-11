/**
 * list-controls unit spec - every branch behind the standard search / filter / sort (CP-23).
 *
 * FAIL-FIRST EVIDENCE: these assertions were executed against the esbuild-compiled actual lib
 * on 05-Sep-2026 (all passed); see the v1.17.0 commit message for the deliberately inverted
 * assertion observed failing.
 */
import { test, expect } from '@playwright/test';
import {
  applyListControls, filterRows, inDateRange, resolveDateRange, searchRows, sortRows,
  toggleFilterValue, toggleSort,
} from '../../src/lib/list-controls';

const rows = [
  { id: 1, name: 'Asha Rao',   course: 'Piano',  mobile: '+91 98765-43210', email: 'asha@x.in', paidOn: '2026-09-03', amount: 500 },
  { id: 2, name: 'Bala K',     course: 'Violin', mobile: '9123456789',      email: 'bala@x.in', paidOn: '2026-08-28', amount: 1200 },
  { id: 3, name: 'chitra dev', course: 'Piano',  mobile: '',                email: 'c@y.com',   paidOn: '2026-09-05', amount: null },
  { id: 4, name: 'Dev Anand',  course: 'Guitar', mobile: '98765 43210',     email: '',          paidOn: '2026-07-15', amount: 300 },
];
const fields = ['name', 'course', 'mobile', 'email'];
const now = new Date(2026, 8, 5, 10, 30); // Saturday
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('search: one box, all key fields, case-insensitive, phone digits normalised', () => {
  expect(searchRows(rows, 'piano', fields).map((r) => r.id)).toEqual([1, 3]);
  expect(searchRows(rows, '9876543210', fields).map((r) => r.id)).toEqual([1, 4]);
  expect(searchRows(rows, 'y.com', fields).map((r) => r.id)).toEqual([3]);
  expect(searchRows(rows, '', fields)).toHaveLength(4);
});

test('filters: multi-select OR within a field, AND across fields, empty set = none', () => {
  let f = toggleFilterValue({}, 'course', 'Piano');
  f = toggleFilterValue(f, 'course', 'Guitar');
  expect(filterRows(rows, f).map((r) => r.id)).toEqual([1, 3, 4]);
  expect(filterRows(rows, { course: new Set() })).toHaveLength(4);
});

test('date presets resolve in local time, Monday weeks, inclusive ends', () => {
  expect(ymd(resolveDateRange({ preset: 'today' }, now)!.from)).toBe('2026-09-05');
  expect(ymd(resolveDateRange({ preset: 'this-week' }, now)!.from)).toBe('2026-08-31');
  expect(ymd(resolveDateRange({ preset: 'last-week' }, now)!.to)).toBe('2026-08-30');
  expect(ymd(resolveDateRange({ preset: 'this-month' }, now)!.to)).toBe('2026-09-30');
  expect(ymd(resolveDateRange({ preset: 'this-week' }, now, 0)!.from)).toBe('2026-08-30');
  expect(resolveDateRange({ preset: 'all' }, now)).toBeNull();
  const custom = resolveDateRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-04' }, now);
  expect(inDateRange('2026-09-04T23:30:00', custom)).toBe(true);
  expect(inDateRange('2026-09-05T00:00:00', custom)).toBe(false);
  expect(inDateRange(null, custom)).toBe(false);
});

test('sort: stable, locale for strings, value for numbers/dates, blanks LAST both ways', () => {
  expect(sortRows(rows, 'name', 'asc').map((r) => r.id)).toEqual([1, 2, 3, 4]);
  expect(sortRows(rows, 'amount', 'asc').map((r) => r.id)).toEqual([4, 1, 2, 3]);
  expect(sortRows(rows, 'amount', 'desc').map((r) => r.id)).toEqual([2, 1, 4, 3]);
  expect(sortRows(rows, 'paidOn', 'desc').map((r) => r.id)).toEqual([3, 1, 2, 4]);
  expect(toggleSort(undefined, 'name')).toEqual({ key: 'name', dir: 'asc' });
  expect(toggleSort({ key: 'name', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'desc' });
  expect(toggleSort({ key: 'name', dir: 'desc' }, 'course')).toEqual({ key: 'course', dir: 'asc' });
});

test('composition: search -> filters -> date -> sort, count is matching/total', () => {
  const out = applyListControls(rows,
    { query: 'piano', filters: {}, date: { preset: 'this-month' }, sort: { key: 'name', dir: 'desc' } },
    { searchFields: fields, dateField: 'paidOn' }, now);
  expect(out.rows.map((r) => r.id)).toEqual([3, 1]);
  expect(out).toMatchObject({ matching: 2, total: 4 });
});
