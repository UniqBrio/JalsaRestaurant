/**
 * The combobox's matching rules — the part that decides what a person can find and whether the
 * Add row appears.
 *
 * WHY THESE TWO FUNCTIONS ARE EXPORTED AT ALL
 *   They are the only logic in the component. Everything else is state and markup, and both of
 *   those need a mounted React tree to exercise. These do not, so they are lifted out and tested
 *   properly rather than asserted about through a class name. `comboboxExactMatch` in particular
 *   is the duplicate guard the requester named: no `Add "New"` when `New` already exists.
 *
 * WHAT THIS TIER CANNOT DO, STATED RATHER THAN FAKED
 *   Arrow-key navigation, Enter-to-select, Escape-to-close and outside-click all need the
 *   component mounted. The tier that mounts React is the functional one, and it needs a database
 *   this session must not point at. Those cases are listed in TEST_SUMMARY.md as not executed
 *   here — not as passing.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026): three injected defects, recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { comboboxMatches, comboboxExactMatch, type ComboboxOption } from '../../src/components/ui/combobox';

const OPTIONS: ComboboxOption[] = [
  { value: 'c1', label: 'Registration' },
  { value: 'c2', label: 'Merchandise' },
  { value: 'c3', label: 'Event' },
  { value: 'c4', label: 'Grant' },
  { value: 'c5', label: 'Advance Payment' },
  { value: 'c6', label: 'Chicken Biryani', hint: 'Biryani' },
];

const find = (q: string) => OPTIONS.filter((o) => comboboxMatches(o, q)).map((o) => o.label);

test('an empty query shows everything', () => {
  expect(find('')).toHaveLength(OPTIONS.length);
  expect(find('   '), 'whitespace is not a search').toHaveLength(OPTIONS.length);
});

test('search is case-insensitive — the requester\'s own example', () => {
  expect(find('adv')).toEqual(['Advance Payment']);
  expect(find('ADV')).toEqual(['Advance Payment']);
  expect(find('AdV')).toEqual(['Advance Payment']);
});

test('search is whitespace-aware at both ends', () => {
  expect(find('  adv ')).toEqual(['Advance Payment']);
});

test('a query matches anywhere in the label, not only the start', () => {
  // Somebody hunting "biryani" must find "Chicken Biryani". A startsWith match is the one that
  // makes a picker feel broken on a menu.
  expect(find('biryani')).toEqual(['Chicken Biryani']);
  expect(find('payment')).toEqual(['Advance Payment']);
});

test('the hint is searchable too', () => {
  expect(find('Biryani')).toContain('Chicken Biryani');
});

test('special characters are matched literally, not as a pattern', () => {
  // If the query were ever compiled into a regex, `(` would throw and `.` would match anything.
  const odd: ComboboxOption[] = [
    { value: 'a', label: "Chef's Special (half)" },
    { value: 'b', label: 'Chefs Special half' },
  ];
  expect(odd.filter((o) => comboboxMatches(o, '(half)')).map((o) => o.value)).toEqual(['a']);
  expect(odd.filter((o) => comboboxMatches(o, "chef's")).map((o) => o.value)).toEqual(['a']);
  expect(odd.filter((o) => comboboxMatches(o, 'Chef.s')).map((o) => o.value), 'a dot is a dot').toEqual([]);
});

test('nothing matching is nothing, not everything', () => {
  expect(find('zzz')).toEqual([]);
});

/* ── the Add row's guard ─────────────────────────────────────────────────── */

test('an exact existing name offers no Add row', () => {
  expect(comboboxExactMatch(OPTIONS, 'Event')?.value).toBe('c3');
});

test('the duplicate guard ignores case and surrounding space', () => {
  // Typing `event` when `Event` exists must NOT offer Add "event" — that is how a category list
  // acquires two rows meaning one thing.
  expect(comboboxExactMatch(OPTIONS, 'event')?.value).toBe('c3');
  expect(comboboxExactMatch(OPTIONS, '  EVENT  ')?.value).toBe('c3');
});

test('a PARTIAL match is not an exact one — Add is still offered', () => {
  // "New" against "New Year Event" is the requester's own example: the list filters, AND the
  // Add row stays, because "New" is not yet a category.
  const withNew: ComboboxOption[] = [
    { value: 'n1', label: 'New Year Event' },
    { value: 'n2', label: 'New Customer' },
  ];
  expect(withNew.filter((o) => comboboxMatches(o, 'New'))).toHaveLength(2);
  expect(comboboxExactMatch(withNew, 'New'), 'Add "New" must still be offered').toBeNull();
});

test('an empty query never offers to create', () => {
  expect(comboboxExactMatch(OPTIONS, '')).toBeNull();
  expect(comboboxExactMatch(OPTIONS, '   ')).toBeNull();
});

test('matching and the duplicate guard agree on the same string', () => {
  // The invariant that keeps the list and the Add row from contradicting each other: if a query
  // exactly names an option, that option is in the filtered list.
  for (const o of OPTIONS) {
    const exact = comboboxExactMatch(OPTIONS, o.label.toUpperCase());
    expect(exact?.value, `${o.label} is its own exact match`).toBe(o.value);
    expect(find(o.label.toUpperCase()), `${o.label} survives its own query`).toContain(o.label);
  }
});
