/**
 * undo unit spec — the reversible half of the destructive-action decision.
 *
 * FAIL-FIRST EVIDENCE: executed against the tsc-compiled actual module on 10-Sep-2026 — 9
 * passed. OBSERVED FAILING first: with `pushToast` returning an empty commit list for its
 * overflow, "AN OVERFLOWING QUEUE COMMITS THE OLDEST" failed with `expected ["a"], got []` —
 * the fourth toast silently discarded a pending archive, so the user's action never happened
 * and nothing said so.
 */
import { test, expect } from '@playwright/test';
import {
  DEFAULT_UNDO_WINDOW_MS, createUndoState, describeAction, dismissToast, expireToasts,
  pushToast, undoToast, type UndoableEntry,
} from '../../src/lib/undo';

const T0 = 1_000_000;
const entry = (id: string, committed: string[]): UndoableEntry => ({
  id,
  message: `Archived ${id}`,
  undo: { commit: () => { committed.push(id); } },
});

test('a plain message has no Undo, and a reversible action does', () => {
  const s = pushToast(createUndoState(), { id: 'm', message: 'Saved.' }, T0).state;
  expect(s.toasts[0]?.undo).toBeUndefined();
  const r = pushToast(createUndoState(), entry('a', []), T0).state;
  expect(r.toasts[0]?.undo).toBeTruthy();
  expect(r.toasts[0]?.expiresAt).toBe(T0 + DEFAULT_UNDO_WINDOW_MS);
});

test('THE WRITE IS DEFERRED: nothing commits while the window is open', () => {
  const committed: string[] = [];
  const s = pushToast(createUndoState(), entry('a', committed), T0).state;
  const tick = expireToasts(s, T0 + 1_000);
  expect(tick.commit).toEqual([]);
  expect(committed).toEqual([]);
  expect(tick.state.toasts).toHaveLength(1);
});

test('the window closing is what commits — and it commits exactly once', () => {
  const committed: string[] = [];
  const s = pushToast(createUndoState(), entry('a', committed), T0).state;
  const closed = expireToasts(s, T0 + DEFAULT_UNDO_WINDOW_MS);
  expect(closed.commit).toHaveLength(1);
  closed.commit.forEach((t) => t.undo?.commit());
  expect(committed).toEqual(['a']);
  expect(expireToasts(closed.state, T0 + 60_000).commit).toEqual([]);
});

test('Undo inside the window cancels; the write never ran, so nothing is reversed', () => {
  const committed: string[] = [];
  const s = pushToast(createUndoState(), entry('a', committed), T0).state;
  const r = undoToast(s, 'a', T0 + 500);
  expect(r.outcome).toBe('undone');
  expect(expireToasts(r.state, T0 + 60_000).commit).toEqual([]);
  expect(committed).toEqual([]);
});

test('Undo AFTER the window is refused out loud, never accepted and ignored', () => {
  const s = pushToast(createUndoState(), entry('a', []), T0).state;
  expect(undoToast(s, 'a', T0 + DEFAULT_UNDO_WINDOW_MS).outcome).toBe('too-late');
  expect(undoToast(s, 'nope', T0).outcome).toBe('unknown');
});

test('a second Undo on the same toast is a no-op with an honest name', () => {
  const s = pushToast(createUndoState(), entry('a', []), T0).state;
  const once = undoToast(s, 'a', T0 + 100);
  expect(undoToast(once.state, 'a', T0 + 200).outcome).toBe('already-undone');
});

test('AN OVERFLOWING QUEUE COMMITS THE OLDEST — it never drops a pending action', () => {
  const committed: string[] = [];
  let s = createUndoState();
  let forced: string[] = [];
  for (const id of ['a', 'b', 'c', 'd']) {
    const r = pushToast(s, entry(id, committed), T0, 3);
    s = r.state;
    r.commit.forEach((t) => { forced.push(t.id); t.undo?.commit(); });
  }
  expect(s.toasts).toHaveLength(3);
  expect(forced).toEqual(['a']);
  expect(committed).toEqual(['a']);
});

test('dismissing by hand ACCEPTS the action — the window just ends early', () => {
  const committed: string[] = [];
  const s = pushToast(createUndoState(), entry('a', committed), T0).state;
  const d = dismissToast(s, 'a');
  expect(d.commit).toHaveLength(1);
  d.commit.forEach((t) => t.undo?.commit());
  expect(committed).toEqual(['a']);
  expect(d.state.toasts).toEqual([]);
});

test('the message is composed from the real values: one is never a plural or a batch', () => {
  expect(describeAction('Archived', 1, { one: 'invoice', many: 'invoices' })).toBe('Archived 1 invoice.');
  expect(describeAction('Archived', 3, { one: 'invoice', many: 'invoices' })).toBe('Archived 3 invoices.');
  expect(describeAction('Archived', 1, { one: 'invoice', many: 'invoices' }, 'Invoice 4021'))
    .toBe('Archived Invoice 4021.');
  expect(describeAction('Archive', 0, { one: 'invoice', many: 'invoices' })).toBe('Nothing to archive.');
});
