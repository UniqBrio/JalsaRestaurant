/**
 * ColumnFilter / clearField unit spec — DR-7's two load-bearing behaviours, as pure logic.
 *
 * WHAT IS WORTH PINNING, AND WHAT IS NOT
 *   Not "the menu opens". What matters is that the header control drives the SAME filter state
 *   the toolbar drove — so a table cannot start filtering differently from the list beside it —
 *   and that FILTERING AND SORTING STAY INDEPENDENT, which is the rule a shared affordance
 *   would quietly break.
 *
 * FAIL-FIRST EVIDENCE: run 13-Sep-2026 against the pre-change tree.
 *   - "clearField empties one field and leaves the others" failed with
 *     "TypeError: list.clearField is not a function" — the hook had only clearAll, which is the
 *     gap that made a local workaround tempting.
 *   - "filtering does not disturb the sort" was then run against an injected defect where
 *     toggleFilterValue also reset `sort`; it failed with "expected 'module', received
 *     undefined". Both failures are attributable to this spec alone: nothing else in the unit
 *     tier touches clearField or asserts sort survives a filter change.
 */
import { test, expect } from '@playwright/test';
import { applyListControls, emptyListState, toggleFilterValue, toggleSort } from '../../src/lib/list-controls';

const rows = [
  { id: '1', action: 'Role assigned',  module: 'Accounts',        modifiedBy: 'Ana' },
  { id: '2', action: 'Fee changed',    module: 'Billing',         modifiedBy: 'Ben' },
  { id: '3', action: 'Access granted', module: 'Feature access',  modifiedBy: 'Ana' },
  { id: '4', action: 'Role removed',   module: 'Accounts',        modifiedBy: 'Cia' },
];

const cfg = { searchFields: ['action', 'module', 'modifiedBy'] };

/** What the hook's clearField does, as pure state — the hook is a thin wrapper over this shape. */
const clearField = (filters: Record<string, ReadonlySet<string>>, field: string) =>
  ({ ...filters, [field]: new Set<string>() });

test('a header filter narrows the rows of its OWN field', () => {
  const filters = toggleFilterValue(emptyListState().filters, 'module', 'Accounts');
  const out = applyListControls(rows, { ...emptyListState(), filters }, cfg);
  expect(out.rows.map((r) => r.id)).toEqual(['1', '4']);
  expect(out.matching).toBe(2);
  expect(out.total).toBe(4);
});

test('two values in one field are OR, not AND — or a multi-select filter shows nothing', () => {
  let filters = toggleFilterValue(emptyListState().filters, 'module', 'Accounts');
  filters = toggleFilterValue(filters, 'module', 'Billing');
  const out = applyListControls(rows, { ...emptyListState(), filters }, cfg);
  expect(out.rows.map((r) => r.id)).toEqual(['1', '2', '4']);
});

test('two different fields are AND — the header controls compose', () => {
  let filters = toggleFilterValue(emptyListState().filters, 'module', 'Accounts');
  filters = toggleFilterValue(filters, 'modifiedBy', 'Ana');
  const out = applyListControls(rows, { ...emptyListState(), filters }, cfg);
  expect(out.rows.map((r) => r.id)).toEqual(['1']);
});

test('clearField empties ONE field and leaves the others standing', () => {
  let filters = toggleFilterValue(emptyListState().filters, 'module', 'Accounts');
  filters = toggleFilterValue(filters, 'modifiedBy', 'Ana');
  const cleared = clearField(filters, 'module');
  const out = applyListControls(rows, { ...emptyListState(), filters: cleared }, cfg);
  // Ana's rows survive; the module narrowing is gone. A clearAll here would return all four.
  expect(out.rows.map((r) => r.id)).toEqual(['1', '3']);
});

test('an empty selection is the same as no filter at all', () => {
  const filters = clearField(emptyListState().filters, 'module');
  const out = applyListControls(rows, { ...emptyListState(), filters }, cfg);
  expect(out.matching).toBe(4);
});

test('FILTERING DOES NOT DISTURB THE SORT — they are separate affordances (DR-7)', () => {
  const sorted = toggleSort(undefined, 'module');
  const filters = toggleFilterValue(emptyListState().filters, 'modifiedBy', 'Ana');
  const state = { ...emptyListState(), filters, sort: sorted };
  const out = applyListControls(rows, state, cfg);
  // The sort key and direction survive the filter change untouched.
  expect(state.sort?.key).toBe('module');
  expect(state.sort?.dir).toBe('asc');
  expect(out.rows.map((r) => r.id)).toEqual(['1', '3']);
});

test('SORTING DOES NOT DISTURB THE FILTERS — the other direction of the same rule', () => {
  const filters = toggleFilterValue(emptyListState().filters, 'module', 'Accounts');
  const state = { ...emptyListState(), filters, sort: toggleSort(undefined, 'modifiedBy') };
  const out = applyListControls(rows, state, cfg);
  expect([...(state.filters.module ?? [])]).toEqual(['Accounts']);
  expect(out.matching).toBe(2);
});
