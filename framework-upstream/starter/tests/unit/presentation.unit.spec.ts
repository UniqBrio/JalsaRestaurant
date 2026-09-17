/**
 * presentation unit spec — CP-32, as pure logic.
 *
 * WHAT IS WORTH PINNING
 *   Not "the map returns a string". The load-bearing claims are that the CANONICAL VALUE IS
 *   UNTOUCHED by anything here — it is what the database, the API, filters, sorts and every
 *   `data-testid` use — and that an unmapped value never reaches a user as a raw identifier.
 *   The totality of the map is enforced by the type system, not by a test: `Record<T, string>`
 *   cannot be missing a case, and the assertion for that is the build.
 *
 * FAIL-FIRST EVIDENCE: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { presentation, humanise } from '../../src/lib/presentation';

type Status = 'active' | 'paused' | 'archived';

const status = presentation<Status>({
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
});

test('the label is what a person reads', () => {
  expect(status.label('active')).toBe('Active');
  expect(status.label('paused')).toBe('Paused');
  expect(status.label('archived')).toBe('Archived');
});

test('THE CANONICAL VALUE IS UNCHANGED — it is what everything else compares', () => {
  // The whole point: presenting a value must not alter the value. A filter comparing
  // `row.status === 'active'` keeps working, and so does every data-testid built from it.
  expect(status.values).toEqual(['active', 'paused', 'archived']);
  expect(status.options().map((o) => o.value)).toEqual(['active', 'paused', 'archived']);
});

test('an option carries BOTH — the canonical value and the label, side by side', () => {
  expect(status.options()).toEqual([
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'archived', label: 'Archived' },
  ]);
});

test('sorting and filtering on the canonical value are unaffected by presentation', () => {
  const rows = [
    { id: '1', status: 'archived' as Status },
    { id: '2', status: 'active' as Status },
    { id: '3', status: 'active' as Status },
  ];
  expect(rows.filter((r) => r.status === 'active').map((r) => r.id)).toEqual(['2', '3']);
  // 'active' sorts before 'archived' on the CANONICAL value - which is the stable thing to
  // sort on. Sorting on labels would reorder the table the day someone rewords one.
  const sorted = [...rows].sort((a, b) => a.status.localeCompare(b.status)).map((r) => r.id);
  expect(sorted).toEqual(['2', '3', '1']);
});

test('a value from outside the union never reaches a user as a raw identifier', () => {
  // The boundary case: an API, an import or a URL supplying something the union does not know.
  // It must not render as `in_progress`; an underscore on screen is the identifier leaking.
  expect(status.from('in_progress')).toBe('In progress');
  expect(status.from('active')).toBe('Active');
});

test('unknown() names the values with no declared label — the review handle', () => {
  expect(status.unknown(['active', 'in_progress', 'pending', 'pending'])).toEqual(['in_progress', 'pending']);
  expect(status.unknown(['active', 'paused'])).toEqual([]);
});

test('humanise does not corrupt what it cannot improve (DR-1s lesson)', () => {
  expect(humanise('on-hold')).toBe('On hold');
  expect(humanise('in_progress')).toBe('In progress');
  // The tail is never lowercased and camelCase is never split. Both are how "WhatsApp" turns
  // into "Whatsapp" or "Whats App" - a transformation wrong about one product name is worse
  // than no transformation at all.
  expect(humanise('sent_to_WhatsApp')).toBe('Sent to WhatsApp');
});
