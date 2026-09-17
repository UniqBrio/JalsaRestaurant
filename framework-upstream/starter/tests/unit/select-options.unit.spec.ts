/**
 * select-options unit spec — the pure half of the searchable select (DR-5).
 *
 * WHAT IS WORTH PINNING HERE
 *   Not "filtering filters". The cases below are the ones that are invisible by clicking around
 *   and expensive months later: the duplicate that differs only by case or spacing, the empty
 *   query that must show everything, and the arrow key that must not wrap.
 *
 * FAIL-FIRST EVIDENCE: run against the pre-fix module on 12-Sep-2026. OBSERVED FAILING with
 * `canAddOption` comparing raw strings instead of normalised ones — "+ Add is refused when only
 * the CASE differs" and "...or only the SPACING differs" both failed, and `addOption` duly
 * created a second "Mumbai" beside "mumbai". That is the defect this file exists for: two values
 * a human reads as one, which a report later splits across a capital letter.
 */
import { test, expect } from '@playwright/test';
import {
  addOption,
  canAddOption,
  cleanLabel,
  filterOptions,
  findExisting,
  moveActive,
  normalizeLabel,
  type Option,
} from '../../src/lib/select-options';

const opts: Option[] = [
  { id: 'mumbai', label: 'Mumbai' },
  { id: 'delhi', label: 'New Delhi' },
  { id: 'blr', label: 'Bengaluru' },
];

test('an empty query shows EVERY option — a box that opens empty asks the user to guess', () => {
  expect(filterOptions(opts, '')).toHaveLength(3);
  expect(filterOptions(opts, '   ')).toHaveLength(3);
});

test('filtering is case-insensitive and matches inside the label', () => {
  expect(filterOptions(opts, 'mum').map((o) => o.label)).toEqual(['Mumbai']);
  expect(filterOptions(opts, 'DELHI').map((o) => o.label)).toEqual(['New Delhi']);
  expect(filterOptions(opts, 'lur').map((o) => o.label)).toEqual(['Bengaluru']);
});

test('a query matching nothing filters to nothing — and that is when + Add is offered', () => {
  expect(filterOptions(opts, 'chennai')).toHaveLength(0);
  expect(canAddOption(opts, 'chennai')).toBe(true);
});

test('+ Add is refused when only the CASE differs', () => {
  expect(canAddOption(opts, 'mumbai')).toBe(false);
  expect(canAddOption(opts, 'MUMBAI')).toBe(false);
});

test('+ Add is refused when only the SPACING differs', () => {
  expect(canAddOption(opts, '  Mumbai  ')).toBe(false);
  expect(canAddOption(opts, 'New   Delhi')).toBe(false);
});

test('+ Add is refused for blank input', () => {
  expect(canAddOption(opts, '')).toBe(false);
  expect(canAddOption(opts, '   ')).toBe(false);
});

test('a near-duplicate SELECTS the existing option instead of adding a second one', () => {
  const r = addOption(opts, '  mumbai ');
  expect(r.added).toBe(false);
  expect(r.options).toHaveLength(3);
  expect(r.option?.label).toBe('Mumbai'); // the one already there, not what was typed
});

test('a genuinely new option is added, KEEPING the user\'s capitalisation', () => {
  const r = addOption(opts, '  chennai Central ');
  expect(r.added).toBe(true);
  expect(r.options).toHaveLength(4);
  // Not "Chennai central", not "chennai central" — exactly what was typed, whitespace tidied.
  expect(r.option?.label).toBe('chennai Central');
});

test('lower-casing a stored label would be a defect — DR-1 applies to stored values too', () => {
  const r = addOption(opts, 'WhatsApp');
  expect(r.option?.label).toBe('WhatsApp');
  expect(cleanLabel('  PDF  export ')).toBe('PDF export');
});

test('normalisation folds case and collapses whitespace, and nothing else', () => {
  expect(normalizeLabel('  New   DELHI ')).toBe('new delhi');
  expect(findExisting(opts, 'new delhi')?.id).toBe('delhi');
});

test('adding blank input changes nothing', () => {
  const r = addOption(opts, '   ');
  expect(r.added).toBe(false);
  expect(r.option).toBeUndefined();
  expect(r.options).toHaveLength(3);
});

test('the source list is never mutated — callers hold their own copy', () => {
  const before = [...opts];
  addOption(opts, 'Chennai');
  expect(opts).toEqual(before);
});

test('arrow keys STOP at both ends rather than wrapping', () => {
  // Wrapping sends a user holding the down arrow silently back to the top, and they overshoot.
  expect(moveActive(2, 3, 1, false)).toBe(2);
  expect(moveActive(0, 3, -1, false)).toBe(0);
  expect(moveActive(0, 3, 1, false)).toBe(1);
});

test('the + Add row is a landing place only while it is offered', () => {
  expect(moveActive(0, 3, -1, true)).toBe(-1); // up from the first option reaches + Add
  expect(moveActive(-1, 3, 1, true)).toBe(0); // and back down into the list
  expect(moveActive(0, 3, -1, false)).toBe(0); // with no + Add row, the first option is the top
});

test('an empty filtered list still lands somewhere sensible', () => {
  expect(moveActive(0, 0, 1, true)).toBe(-1); // only + Add exists
  expect(moveActive(0, 0, 1, false)).toBe(0); // nothing to land on at all
});
