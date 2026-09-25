/**
 * refresh-gate unit spec — which refreshes may be dropped, and which may never be.
 *
 * FAIL-FIRST EVIDENCE (11-Sep-2026, observed against the shipped tree):
 *   OBSERVED FAILING — "a refresh a person caused is never dropped" was written against the
 *   behaviour `useLiveData` actually shipped with, which was a single `inFlight` boolean and an
 *   unconditional `if (inFlight.current) return;`. Modelled exactly, it fails:
 *
 *       begin(g)        -> true   (a scheduled poll starts)
 *       begin(g)        -> false  (the post-write read is REFUSED)
 *       end(g)          -> false  (and nothing re-runs it)
 *
 *   `expected true, received false` on the re-run. That is the defect in one line: a captain's
 *   round is sent, the screen is refused its own confirmation for up to six seconds, and the
 *   obvious human response is to press Send again.
 *
 *   NOT OBSERVED FAILING — "a scheduled poll is dropped freely". It is the behaviour the old
 *   code already had; it is asserted so the fix above cannot be implemented by making every
 *   refresh queue, which would rebuild the request pile-up the drop existed to prevent.
 */
import { test, expect } from '@playwright/test';
import { newGate, begin, end, wrote, superseded } from '../../src/hooks/refresh-gate';

test('the first refresh always starts', () => {
  const g = newGate();
  expect(begin(g)).toBe(true);
  expect(g.inFlight).toBe(true);
});

test('a scheduled poll is dropped freely while one is in flight', () => {
  // Dropping costs nothing: the next tick is seconds away, and a queue of stale reads arriving
  // out of order is how a screen shows an older state than the one it just showed.
  const g = newGate();
  begin(g);
  expect(begin(g)).toBe(false);
  expect(g.pending, 'a timer must not leave anything owed').toBe(false);
  expect(end(g), 'nothing is owed, so nothing re-runs').toBe(false);
});

test('a refresh a person caused is never dropped', () => {
  // THE defect. A write completed; the read that proves it must happen.
  const g = newGate();
  begin(g); // a poll is already out on the network
  expect(begin(g, true), 'it cannot start yet').toBe(false);
  expect(g.pending, 'but it must be remembered').toBe(true);
  expect(end(g), 'and re-run the moment the poll returns').toBe(true);
});

test('two person-caused refreshes behind one poll collapse into a single re-run', () => {
  // Two writes landing together owe ONE fresh read, not two: the second would read exactly what
  // the first already read.
  const g = newGate();
  begin(g);
  begin(g, true);
  begin(g, true);
  expect(end(g)).toBe(true);
  expect(g.pending).toBe(false);
});

test('the gate is reusable — a completed cycle leaves no residue', () => {
  const g = newGate();
  begin(g);
  end(g);
  // SUPERSEDED 24-Sep-2026 (review of latency fix 3): the gate now also counts writes that
  // answered with their own screen; this asserted `{ inFlight: false, pending: false }`.
  expect(g).toEqual({ inFlight: false, pending: false, writes: 0 });
  expect(begin(g), 'the next refresh must start normally').toBe(true);
});

test('a person-caused refresh with nothing in flight starts immediately', () => {
  // It must not take the deferred path when the direct one is open, or every write would wait
  // for a tick that is not coming.
  const g = newGate();
  expect(begin(g, true)).toBe(true);
  expect(g.pending).toBe(false);
});

/* ── added 24-Sep-2026, review of latency fix 3 ───────────────────────────── */

test('a poll that left before a write answered is older than the screen, and is discarded', () => {
  // A scheduled poll is on the wire; the captain taps Send; the write answers WITH the new screen;
  // then the poll lands, carrying the state from before the tap. Applying it would show the round
  // as unsent again — the double-send this module exists to stop.
  const g = newGate();
  begin(g);
  const seen = g.writes; // the poll leaves
  wrote(g); // the write's own answer is applied
  expect(superseded(g, seen), 'the late poll must not overwrite the echoed screen').toBe(true);
  end(g);
  expect(superseded(g, g.writes), 'a read that starts after the write is current').toBe(false);
});
