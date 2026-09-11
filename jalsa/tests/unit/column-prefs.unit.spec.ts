/**
 * CP-21 unit spec — reconcileOrder, the part with all the branches.
 *
 * No page, no server, no storage: it runs everywhere, always. Each case pins a RELEASE-DAY
 * failure, not the implementation — a stored preference meeting a column set that has moved on
 * since the day it was saved.
 */
import { test, expect } from '@playwright/test';
import { reconcileOrder } from '../../src/hooks/useColumnPrefs';

const ALL = ['name', 'status', 'owner', 'created', 'updated'];

test.describe('reconcileOrder — a stored order meets a changed column set', () => {
  test('no stored preference yields the code order', () => {
    expect(reconcileOrder(null, ALL)).toEqual(ALL);
    expect(reconcileOrder(undefined, ALL)).toEqual(ALL);
    expect(reconcileOrder([], ALL)).toEqual(ALL);
  });

  test('a stored order is honoured exactly', () => {
    const stored = ['owner', 'name', 'updated', 'status', 'created'];
    expect(reconcileOrder(stored, ALL)).toEqual(stored);
  });

  test('a column ADDED since the preference was stored appears, it does not vanish', () => {
    // The bug this pins: a release adds a column, and everyone who ever touched this control
    // never sees it — the feature silently suppresses the new work.
    const stored = ['name', 'status', 'owner', 'created']; // saved before `updated` existed
    const out = reconcileOrder(stored, ALL);
    expect(out).toContain('updated');
    expect(out).toHaveLength(ALL.length);
  });

  test('a column REMOVED since the preference was stored is dropped', () => {
    // Left in place it is a key that later indexes into nothing.
    const stored = ['name', 'legacyFlag', 'status', 'owner', 'created', 'updated'];
    expect(reconcileOrder(stored, ALL)).not.toContain('legacyFlag');
    expect(reconcileOrder(stored, ALL)).toHaveLength(ALL.length);
  });

  test('a new column lands at its CODE position, not at the front of a reordered table', () => {
    // The subtle one. The user moved `updated` (normally last) to the front. A newcomer that
    // anchors to "the first column I precede" would land at position 0 — the most prominent
    // slot in the table, for a column nobody asked for.
    const all = ['name', 'status', 'owner', 'created', 'updated'];
    const stored = ['updated', 'name', 'status']; // `owner`/`created` are new to this preference
    const out = reconcileOrder(stored, all);
    expect(out[0]).toBe('updated');
    // `owner` belongs after `status` in code order, and that is where it goes.
    expect(out.indexOf('owner')).toBeGreaterThan(out.indexOf('status'));
    expect(out.indexOf('created')).toBeGreaterThan(out.indexOf('owner'));
  });

  test('a duplicated stored key renders its column once, not twice', () => {
    const stored = ['name', 'name', 'status'];
    const out = reconcileOrder(stored, ALL);
    expect(out.filter((k) => k === 'name')).toHaveLength(1);
    expect(out).toHaveLength(ALL.length);
  });

  test('every known column appears exactly once, whatever the input', () => {
    // The invariant the table depends on: render every column, render none of them twice.
    for (const stored of [null, [], ['zzz'], ['updated', 'updated', 'ghost'], ALL.slice().reverse()]) {
      const out = reconcileOrder(stored as string[] | null, ALL);
      expect([...out].sort()).toEqual([...ALL].sort());
    }
  });
});
