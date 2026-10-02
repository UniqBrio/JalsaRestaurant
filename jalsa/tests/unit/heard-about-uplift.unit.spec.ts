import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { tallyHeard } from '../../src/lib/heard-about';

/**
 * "How did you hear about us" in the Uplift section (24-Sep correction list, H2).
 *
 * The answers were captured on the guest's welcome screen and stored in
 * `guest_session.heard_about` - and shown to the owner nowhere. They are now counted over the
 * last 30 days from that one field; nothing new is stored.
 */

test('answers are counted, largest first, with their share', () => {
  expect(tallyHeard(['Instagram', 'Friend recommended', 'Instagram', 'Google'])).toEqual([
    { source: 'Instagram', count: 2, share: 50 },
    { source: 'Friend recommended', count: 1, share: 25 },
    { source: 'Google', count: 1, share: 25 },
  ]);
});

test('the same answer typed differently is one source, not three small ones', () => {
  const t = tallyHeard(['Instagram', 'instagram ', 'INSTAGRAM', '  Walked  past ']);
  expect(t[0]).toEqual({ source: 'Instagram', count: 3, share: 75 });
  expect(t[1]).toEqual({ source: 'Walked past', count: 1, share: 25 });
});

test('no answers is an empty list, never a division by zero', () => {
  expect(tallyHeard([])).toEqual([]);
  expect(tallyHeard(['', '   '])).toEqual([]);
});

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('read from the one stored field, over the IST range, gated like the section', () => {
  const q = code('src/lib/db/queries.ts');
  const fn = q.slice(q.indexOf('export async function listHeardAboutBetween'));
  /* SUPERSEDED 02-Oct-2026 (answers that survive): previously asserted `.from('guest_session')`
     and `.select('heard_about')`. A released table deleted those sessions and their answers, so
     the report now reads `guest_attribution` (`source`), which outlives the session; the answers
     on sessions were backfilled into it by 20261002110000_jalsa_guest_attribution. Still one
     stored answer per visit, over the same IST range. */
  expect(fn.slice(0, 900)).toContain(".from('guest_attribution')");
  expect(fn.slice(0, 900)).toContain(".select('source')");
  expect(fn).toContain('dayWindow(from, to)');
  const route = code('src/app/api/owner/heard/route.ts');
  expect(route).toContain("staff.grants.can('rep.sales')");
  expect(route).toContain('tallyHeard(answers)');
  // The section it feeds is gated on the same key.
  expect(code('src/features/owner/OwnerConsole.tsx')).toContain(
    "{ key: 'uplift', label: 'Uplift', permission: 'rep.sales' }"
  );
});

test('the Uplift section shows it, read on open rather than on the poll', () => {
  const ui = code('src/features/owner/sections/UpliftSection.tsx');
  expect(ui).toContain('<HeardAboutCard />');
  expect(ui).toContain('fetch(`/api/owner/heard?from=${range.from}&to=${range.to}`)');
  expect(ui).toContain("resolvePreset('last30', nowForRangeCheck())");
});
