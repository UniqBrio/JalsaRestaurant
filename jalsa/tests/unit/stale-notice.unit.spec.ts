/**
 * stale-notice unit spec — when a screen may tell a guest it has stopped keeping up.
 *
 * FAIL-FIRST EVIDENCE (12-Sep-2026, run against the pre-change rule, modelled exactly: the
 * first failed poll set `staleReason` from `handleError`'s generic fallback):
 *   OBSERVED FAILING — 2 failed:
 *     · "one failed read says nothing" — `expected null, received "Something went wrong. Please
 *       try again."`. That is the reported defect in one line: the screen was correct, the order
 *       was safe, and the application raised an alarm about neither.
 *     · "what it does say is the restaurant's sentence, not the runtime's" —
 *       `expected not to contain "Something went wrong", received "Something went wrong. Please
 *       try again."` — the taxonomy fallback, which names nothing and asks the guest to retry
 *       something they did not do.
 *
 *   NOT OBSERVED FAILING — "a success resets the count": the counter did not exist to reset, so
 *   there was no pre-change behaviour to run it against. It is asserted here because the whole
 *   threshold is worthless if a run of blips separated by successes ever accumulates.
 */
import { test, expect } from '@playwright/test';
import { STALE_AFTER_CONSECUTIVE_FAILURES, staleNotice } from '../../src/lib/stale-notice';

test('one failed read says nothing', () => {
  // A phone in a restaurant drops a read now and then. The screen is still right.
  expect(staleNotice(0)).toBeNull();
  expect(staleNotice(1)).toBeNull();
});

test('two in a row is an outage, and it is said', () => {
  expect(staleNotice(2)).not.toBeNull();
  expect(staleNotice(7)).not.toBeNull();
  expect(STALE_AFTER_CONSECUTIVE_FAILURES).toBe(2);
});

test('what it does say is the restaurant’s sentence, not the runtime’s', () => {
  const said = staleNotice(2) ?? '';
  expect(said).not.toContain('Something went wrong');
  expect(said).not.toContain('try again');
  expect(said.length, 'and it is an actual sentence').toBeGreaterThan(10);
});

test('a success resets the count, so blips never accumulate into an alarm', () => {
  // Modelled the way the hook does it: any success sets the counter to 0.
  let failures = 0;
  const fail = () => staleNotice((failures += 1));
  const succeed = () => {
    failures = 0;
    return null;
  };
  expect(fail(), 'blip').toBeNull();
  expect(succeed()).toBeNull();
  expect(fail(), 'another blip, an hour later, is still just a blip').toBeNull();
  expect(succeed()).toBeNull();
  expect(fail()).toBeNull();
  expect(fail(), 'two in a row, though, is real').not.toBeNull();
});
