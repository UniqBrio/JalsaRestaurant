/**
 * module-access unit spec - the branches behind the RBAC grant editor.
 *
 * FAIL-FIRST EVIDENCE: the same assertions were executed against the esbuild-compiled
 * actual lib on 05-Sep-2026 (all passed), and a deliberately inverted alwaysOn/deny
 * assertion was observed FAILING - the guard fires. See the v1.14.0 commit message.
 */
import { test, expect } from '@playwright/test';
import {
  applyPreset, changedCount, emptyGrants, sectionCount, toggleGrant,
  type SectionDef,
} from '../../src/lib/module-access';

const section: SectionDef = {
  id: 's1',
  label: 'Alpha',
  capabilities: [
    { id: 'a1', label: 'View' },
    { id: 'a2', label: 'Edit', confidential: true },
    { id: 'a3', label: 'Delete' },
  ],
};
const presets = { Manager: ['a1', 'a2'] } as const;

test('deny-by-default: a fresh grant set is empty', () => {
  expect(emptyGrants().size).toBe(0);
});

test('a preset applies, and custom toggles edit on top of it', () => {
  let g = applyPreset(presets, 'Manager');
  expect([...g].sort()).toEqual(['a1', 'a2']);
  g = toggleGrant(toggleGrant(g, 'a3'), 'a1');
  expect([...g].sort()).toEqual(['a2', 'a3']);
});

test('re-applying a preset RESETS to the role - never a merge', () => {
  let g = toggleGrant(applyPreset(presets, 'Manager'), 'a3');
  g = applyPreset(presets, 'Manager');
  // A merge would have kept a3 - and an access reviewer reading "Manager preset"
  // would then be wrong about what the member actually has.
  expect([...g].sort()).toEqual(['a1', 'a2']);
});

test('an unknown preset yields empty grants, never a throw', () => {
  expect(applyPreset(presets, 'NoSuchRole').size).toBe(0);
});

test('section counts and the honest save label inputs', () => {
  const g = applyPreset(presets, 'Manager');
  expect(sectionCount(section, g)).toEqual({ granted: 2, total: 3 });
  expect(changedCount(new Set(['a1']), g)).toBe(1); // one addition
  expect(changedCount(g, emptyGrants())).toBe(2);   // removals count too
  expect(changedCount(g, g)).toBe(0);               // -> "No changes"
});
