/**
 * loading unit spec — the waiting screen's decision, at every instant a test could not wait for.
 *
 * FAIL-FIRST EVIDENCE: executed against the tsc-compiled actual module on 10-Sep-2026 — 7
 * passed. OBSERVED FAILING first: with `resolveThresholds` returning the configured value
 * unordered, "a stalled threshold at or below the slow one is REPAIRED" failed with
 * `expected > 5000, got 1000` — a misconfigured pair left the stalled state, which carries the
 * only way out of the screen, unreachable, and nothing reported it.
 */
import { test, expect } from '@playwright/test';
import {
  DEFAULT_LOADING_COPY, DEFAULT_SLOW_AFTER_MS, DEFAULT_STALLED_AFTER_MS,
  loadingStage, resolveThresholds,
} from '../../src/lib/loading';

test('the ordinary wait carries the promise, not a spinner caption', () => {
  const s = loadingStage(500);
  expect(s.tone).toBe('working');
  expect(s.headline).toBe(DEFAULT_LOADING_COPY.working.headline);
  expect(s.showEscape).toBe(false);
});

test('a wait that has gone on says so, and only then shows the clock', () => {
  const slow = loadingStage(DEFAULT_SLOW_AFTER_MS, {});
  expect(slow.tone).toBe('slow');
  expect(slow.showEscape).toBe(false);
  expect(loadingStage(DEFAULT_SLOW_AFTER_MS - 1).tone).toBe('working');
  expect(loadingStage(12_345).waitedSeconds).toBe(12);
});

test('a stalled wait stops pretending and owes the user a way out', () => {
  const s = loadingStage(DEFAULT_STALLED_AFTER_MS + 1);
  expect(s.tone).toBe('stalled');
  expect(s.showEscape).toBe(true);
  // The stalled copy must not repeat the cheerful promise — that is the defect it exists for.
  expect(s.headline).not.toBe(DEFAULT_LOADING_COPY.working.headline);
});

test('configured copy wins; a CLEARED field falls back rather than blanking the screen', () => {
  const custom = loadingStage(0, { copy: { working: { headline: 'Building your timetable' } } });
  expect(custom.headline).toBe('Building your timetable');

  const cleared = loadingStage(0, { copy: { working: { headline: '   ' } } });
  expect(cleared.headline).toBe(DEFAULT_LOADING_COPY.working.headline);
  expect(cleared.headline.trim().length).toBeGreaterThan(0);
});

test('the work is named where it is known, and never on the failure screen', () => {
  expect(loadingStage(0, { work: 'your invoice' }).detail).toContain('your invoice');
  // "We're preparing your invoice" under "this has stalled" is the application arguing with
  // itself in front of the user.
  expect(loadingStage(60_000, { work: 'your invoice' }).detail).not.toContain('your invoice');
});

test('a stalled threshold at or below the slow one is REPAIRED, never left unreachable', () => {
  expect(resolveThresholds({ slowAfterMs: 5_000, stalledAfterMs: 1_000 }).stalled).toBeGreaterThan(5_000);
  expect(resolveThresholds({ slowAfterMs: 5_000, stalledAfterMs: 5_000 }).stalled).toBeGreaterThan(5_000);
  expect(loadingStage(30_000, { slowAfterMs: 5_000, stalledAfterMs: 1_000 }).tone).toBe('stalled');
});

test('a clock that went backwards reports "just started", never a fabricated failure', () => {
  expect(loadingStage(-1).tone).toBe('working');
  expect(loadingStage(Number.NaN).tone).toBe('working');
  expect(loadingStage(-1).waitedSeconds).toBe(0);
});
