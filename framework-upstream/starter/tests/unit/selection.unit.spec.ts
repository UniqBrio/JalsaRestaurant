/**
 * selection unit spec — what the row and header checkboxes actually mean.
 *
 * FAIL-FIRST EVIDENCE: executed against the tsc-compiled actual module on 10-Sep-2026 — 9
 * passed. OBSERVED FAILING first: with `reconcileSelection` keeping every id regardless of the
 * view, "a filter change drops what left the view, and SAYS how many" failed with
 * `expected ["r1","r2"], got ["r1","r2","r9"]` — the selection survived the filter, so a bulk
 * action reached a row the user could no longer see. That is the greedy select-all defect,
 * arrived at slowly.
 */
import { test, expect } from '@playwright/test';
import {
  droppedSummary, headerState, reconcileSelection, selectRange, selectionSummary, toggleAll,
  toggleRow,
} from '../../src/lib/selection';

const visible = ['r1', 'r2', 'r3', 'r4'];

test('the header checkbox is THREE-state, because a partial selection is a real state', () => {
  expect(headerState(new Set(), visible)).toBe('none');
  expect(headerState(new Set(['r2']), visible)).toBe('some');
  expect(headerState(new Set(visible), visible)).toBe('all');
});

test('an empty view reports none — never "all" of nothing', () => {
  expect(headerState(new Set(), [])).toBe('none');
  expect(headerState(new Set(['r1']), [])).toBe('none');
});

test('clicking the header while partial SELECTS the rest; there is no undo for a selection', () => {
  expect([...toggleAll(new Set(['r2']), visible)].sort()).toEqual(visible);
});

test('clicking it while all clears ONLY the visible rows', () => {
  const selected = new Set([...visible, 'hidden-9']);
  expect([...toggleAll(selected, visible)]).toEqual(['hidden-9']);
});

test('SCOPE IS THE VISIBLE SET: select-all never reaches rows below the filter', () => {
  const all = toggleAll(new Set(), ['r1', 'r2']);
  expect([...all]).toEqual(['r1', 'r2']);
  expect(all.has('r3')).toBe(false);
});

test('a filter change drops what left the view, and SAYS how many', () => {
  const r = reconcileSelection(new Set(['r1', 'r2', 'r9']), visible);
  expect([...r.selected].sort()).toEqual(['r1', 'r2']);
  expect(r.dropped).toEqual(['r9']);
  expect(droppedSummary(r.dropped)).toBe('1 selected row is no longer shown, so it was deselected.');
  expect(droppedSummary([])).toBeNull();
  expect(droppedSummary(['a', 'b'])).toContain('2 selected rows');
});

test('toggling one row is a pure set operation — the input is never mutated', () => {
  const before = new Set(['r1']);
  const after = toggleRow(before, 'r2');
  expect([...before]).toEqual(['r1']);
  expect([...after].sort()).toEqual(['r1', 'r2']);
  expect([...toggleRow(after, 'r1')]).toEqual(['r2']);
});

test('shift-select runs over the VISIBLE order, in either direction, both ends included', () => {
  expect([...selectRange(new Set(), visible, 'r2', 'r4')]).toEqual(['r2', 'r3', 'r4']);
  expect([...selectRange(new Set(), visible, 'r4', 'r2')]).toEqual(['r2', 'r3', 'r4']);
  // An anchor that has scrolled out of the filtered view selects nothing rather than guessing.
  expect([...selectRange(new Set(['r1']), visible, 'gone', 'r3')]).toEqual(['r1']);
});

test('the count states its scope, so it cannot be read as a claim about the whole table', () => {
  expect(selectionSummary(0, 12)).toBe('None selected');
  expect(selectionSummary(3, 12)).toBe('3 of 12 shown selected');
});
