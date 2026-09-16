/**
 * module-customizer unit spec - the branches behind "shape your own app".
 *
 * FAIL-FIRST EVIDENCE: executed against the esbuild-compiled actual lib on 05-Sep-2026
 * (all passed); the alwaysOn guard was observed FAILING when deliberately inverted.
 * See the v1.14.0 commit message.
 */
import { test, expect } from '@playwright/test';
import {
  moveItem, positionBadges, setEnabled, type ModuleItem,
} from '../../src/lib/module-customizer';

const items: ModuleItem[] = [
  { id: 'one', label: 'One', enabled: true, children: [
    { id: 'one-a', label: 'One A', enabled: true }] },
  { id: 'two', label: 'Two', enabled: true, children: [
    { id: 'two-a', label: 'Two A', enabled: true },
    { id: 'two-b', label: 'Two B', enabled: false }] },
  { id: 'core', label: 'Core', enabled: true, alwaysOn: true },
];

test('alwaysOn locks the toggle, not the position', () => {
  expect(setEnabled(items, 'core', false)[2]!.enabled).toBe(true);
  expect(moveItem(items, 'core', 'up')[1]!.id).toBe('core');
});

test('edge and missing moves are no-ops returning the SAME reference', () => {
  // Callers detect a no-op by identity and skip the save - asserting the result,
  // not just the absence of an error.
  expect(moveItem(items, 'one', 'up')).toBe(items);
  expect(moveItem(items, 'core', 'down')).toBe(items);
  expect(moveItem(items, 'ghost', 'up')).toBe(items);
});

test('a child moves within its own siblings only, untouched branches keep identity', () => {
  const t = moveItem(items, 'two-b', 'up');
  expect(t[1]!.children![0]!.id).toBe('two-b');
  expect(t[0]).toBe(items[0]);
});

test('disabling a parent keeps the children flags for its return', () => {
  const t = setEnabled(items, 'two', false);
  expect(t[1]!.enabled).toBe(false);
  expect(t[1]!.children![0]!.enabled).toBe(true); // restored exactly on re-enable
});

test('position badges count ENABLED items only', () => {
  const t = setEnabled(items, 'two', false);
  const b = positionBadges(t);
  expect(b.get('one')).toBe('Main tab 1');
  expect(b.get('core')).toBe('Main tab 2'); // disabled "two" not counted
  expect(b.has('two')).toBe(false);
  expect(b.get('one-a')).toBe('Tab 1');
  expect(b.has('two-b')).toBe(false);
});
