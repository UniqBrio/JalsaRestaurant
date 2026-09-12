/**
 * Column filters — independent, combinable, and countable.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change tree, modelled exactly:
 * `list-controls.ts` held SET-MEMBERSHIP filters only — no text kind, no range kind, no notion
 * of a per-column filter being "active", and nothing that counted columns for a badge):
 *   OBSERVED FAILING — 4 failed:
 *     · "a text filter narrows by what the cell contains" — `expected false, received true`.
 *       There was no text kind; everything matched.
 *     · "a range filter keeps only what falls between its ends" — the same.
 *     · "the badge counts the columns actually narrowing the list" — `expected 2, received 0`.
 *     · "an emptied filter is not an active one" — `expected true, received false` on the
 *       options half: nothing could be active, so nothing could be counted or marked.
 *
 *   NOT OBSERVED FAILING — nothing in this file.
 */
import { test, expect } from '@playwright/test';
import {
  activeColumnFilterCount,
  applyColumnFilters,
  clearColumnFilter,
  columnFilterMatches,
  isColumnFilterActive,
  type ColumnFilters,
} from '../../src/lib/list-controls';

interface Dish {
  name: string;
  category: string;
  type: string;
  price: number;
  available: string;
}

const MENU: Dish[] = [
  { name: 'Chicken Biryani', category: 'Biryani', type: 'Non-veg', price: 90, available: 'On' },
  { name: 'Mutton Biryani', category: 'Biryani', type: 'Non-veg', price: 240, available: 'On' },
  { name: 'Veg Biryani', category: 'Biryani', type: 'Veg', price: 140, available: 'Off' },
  { name: 'Veg Pulav', category: 'Rice', type: 'Veg', price: 120, available: 'On' },
  { name: 'Chilli Paneer', category: 'Veg Starters', type: 'Veg', price: 220, available: 'On' },
];

const cell = (row: Dish, key: string) => (row as unknown as Record<string, string | number>)[key];

test('a text filter narrows by what the cell contains', () => {
  // Contains, not equals. Nobody types a dish name in full to find it.
  expect(columnFilterMatches({ kind: 'text', text: 'biry' }, 'Veg Pulav')).toBe(false);
  expect(columnFilterMatches({ kind: 'text', text: 'biry' }, 'Chicken Biryani')).toBe(true);
  expect(columnFilterMatches({ kind: 'text', text: 'BIRY' }, 'Chicken Biryani'), 'case-blind').toBe(true);
});

test('a range filter keeps only what falls between its ends, either end optional', () => {
  expect(columnFilterMatches({ kind: 'range', min: 200 }, 130)).toBe(false);
  expect(columnFilterMatches({ kind: 'range', min: 200 }, 240)).toBe(true);
  expect(columnFilterMatches({ kind: 'range', max: 150 }, 240)).toBe(false);
  expect(columnFilterMatches({ kind: 'range', min: 100, max: 200 }, 140)).toBe(true);
  expect(columnFilterMatches({ kind: 'range', min: 100, max: 200 }, 200), 'ends are inclusive').toBe(true);
});

test('an emptied filter is not an active one', () => {
  // A dropdown someone opened and closed again must not leave the column looking narrowed, and
  // must not be counted in the badge.
  expect(isColumnFilterActive({ kind: 'text', text: '  ' })).toBe(false);
  expect(isColumnFilterActive({ kind: 'options', values: [] })).toBe(false);
  expect(isColumnFilterActive({ kind: 'range' })).toBe(false);
  expect(isColumnFilterActive(undefined)).toBe(false);
  expect(isColumnFilterActive({ kind: 'options', values: ['Biryani'] })).toBe(true);
  expect(isColumnFilterActive({ kind: 'range', min: 0 }), 'zero is a bound, not an absence').toBe(true);
});

test('the badge counts the columns actually narrowing the list', () => {
  const filters: ColumnFilters = {
    name: { kind: 'text', text: 'x' },
    category: { kind: 'options', values: ['Biryani'] },
    price: { kind: 'range' },
    type: { kind: 'text', text: '' },
  };
  expect(activeColumnFilterCount(filters), 'two of the four are doing something').toBe(2);
  expect(activeColumnFilterCount({})).toBe(0);
});

test('several values in ONE column are an OR', () => {
  const out = applyColumnFilters(MENU, { category: { kind: 'options', values: ['Biryani', 'Rice'] } }, cell);
  expect(out.map((d) => d.name)).toEqual(['Chicken Biryani', 'Mutton Biryani', 'Veg Biryani', 'Veg Pulav']);
});

test('the requester’s own example — Biryani + Non-veg + available — is an AND', () => {
  const out = applyColumnFilters(
    MENU,
    {
      category: { kind: 'options', values: ['Biryani'] },
      type: { kind: 'options', values: ['Non-veg'] },
      available: { kind: 'options', values: ['On'] },
    },
    cell
  );
  expect(out.map((d) => d.name)).toEqual(['Chicken Biryani', 'Mutton Biryani']);
});

test('filters of different kinds combine across columns', () => {
  const out = applyColumnFilters(
    MENU,
    { name: { kind: 'text', text: 'veg' }, price: { kind: 'range', min: 130 } },
    cell
  );
  expect(out.map((d) => d.name)).toEqual(['Veg Biryani']);
});

test('no filters means the whole list, and a copy of it', () => {
  const out = applyColumnFilters(MENU, {}, cell);
  expect(out).toHaveLength(MENU.length);
  expect(out).not.toBe(MENU);
});

test('clearing one column leaves the others exactly as they were', () => {
  const filters: ColumnFilters = {
    category: { kind: 'options', values: ['Biryani'] },
    type: { kind: 'options', values: ['Non-veg'] },
  };
  const after = clearColumnFilter(filters, 'category');
  expect(activeColumnFilterCount(after)).toBe(1);
  expect(applyColumnFilters(MENU, after, cell).map((d) => d.name)).toEqual(['Chicken Biryani', 'Mutton Biryani']);
  expect(clearColumnFilter(filters, 'nothing-here'), 'and clearing a column with no filter is a no-op').toBe(filters);
});

test('a filter that matches nothing returns nothing, rather than quietly returning everything', () => {
  // The failure mode worth guarding: a bad match rule that falls back to "true" looks exactly
  // like a working filter on a list where most rows happen to match.
  const out = applyColumnFilters(MENU, { category: { kind: 'options', values: ['Desserts'] } }, cell);
  expect(out).toHaveLength(0);
});
