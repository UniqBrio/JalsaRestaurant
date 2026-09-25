/**
 * change-check unit spec — a polling screen asks "changed?" and reads in full only when it must.
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 4): every tick re-read the whole
 * screen. These are the client's rules for when a tick may send its stamp instead, and when it
 * must not — the rules whose failure would be a screen that silently stops updating.
 *
 * FAIL-FIRST: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { forgetStamp, isUnchanged, newCheck, pollTarget, readInFull } from '../../src/hooks/change-check';

test('with no stamp yet, a tick reads in full', () => {
  const c = newCheck(60_000);
  expect(pollTarget('/api/staff/state', c, 1_000, false)).toEqual({ href: '/api/staff/state', full: true });
});

test('with a fresh stamp, a tick only asks — and keeps the URL it already had', () => {
  const c = newCheck(60_000);
  readInFull(c, 'f41', 1_000);
  expect(pollTarget('/api/staff/state', c, 7_000, false)).toEqual({
    href: '/api/staff/state?since=f41',
    full: false,
  });
  expect(pollTarget('/api/guest/state?table=A5', c, 7_000, false).href).toBe('/api/guest/state?table=A5&since=f41');
});

test('a stamp is sent encoded, whatever it contains', () => {
  const c = newCheck(60_000);
  readInFull(c, '["3",true,"b1","7",""]', 0);
  expect(pollTarget('/x?table=A5', c, 1, false).href).toBe(
    `/x?table=A5&since=${encodeURIComponent('["3",true,"b1","7",""]')}`
  );
});

test('what moves with the clock is re-read on time', () => {
  const c = newCheck(60_000);
  readInFull(c, 'f41', 1_000);
  expect(pollTarget('/s', c, 60_999, false).full).toBe(false);
  expect(pollTarget('/s', c, 61_000, false).full, 'due: a KOT age must not freeze').toBe(true);
});

test('a read a person caused is always in full', () => {
  const c = newCheck(60_000);
  readInFull(c, 'f41', 1_000);
  expect(pollTarget('/s', c, 2_000, true).full).toBe(true);
});

test('after a write answers with its own screen, the next tick reads in full', () => {
  const c = newCheck(60_000);
  readInFull(c, 'f41', 1_000);
  forgetStamp(c);
  expect(pollTarget('/s', c, 2_000, false).full).toBe(true);
});

test('a full screen without a stamp (older server, missing migration) keeps every tick in full', () => {
  const c = newCheck(60_000);
  readInFull(c, null, 1_000);
  expect(pollTarget('/s', c, 2_000, false).full).toBe(true);
});

test('"unchanged" is recognised, and nothing else is mistaken for it', () => {
  expect(isUnchanged('{"unchanged":true}')).toBe(true);
  expect(isUnchanged('{"unchanged":false}')).toBe(false);
  expect(isUnchanged('{"phase":"live","menu":[]}')).toBe(false);
  expect(isUnchanged('not json')).toBe(false);
  expect(isUnchanged(`{"unchanged":true,"padding":"${'x'.repeat(80)}"}`), 'a screen is never that small').toBe(false);
});
