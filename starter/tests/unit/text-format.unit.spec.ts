/**
 * text-format unit spec - DR-1, sentence case for visible text.
 *
 * The assertions that matter are the ones proving what the function does NOT do: the naive
 * implementation lowercases the tail and quietly corrupts every product name and acronym in
 * the application.
 */
import { test, expect } from '@playwright/test';
import { cellCase, findUncased, isSentenceCased, sentenceCase } from '../../src/lib/text-format';

test('capitalises the first letter', () => {
  expect(sentenceCase('save changes')).toBe('Save changes');
  expect(sentenceCase('  leading space')).toBe('  Leading space');
  expect(sentenceCase('(parenthesised)')).toBe('(Parenthesised)');
});

test('NEVER lowercases the rest - the whole point', () => {
  expect(sentenceCase('send via WhatsApp')).toBe('Send via WhatsApp');
  expect(sentenceCase('export as PDF')).toBe('Export as PDF');
  expect(sentenceCase('works on iOS and Android')).toBe('Works on iOS and Android');
  expect(sentenceCase('Asha Rao paid')).toBe('Asha Rao paid');
});

test('passes through what cannot be cased', () => {
  expect(sentenceCase('')).toBe('');
  expect(sentenceCase('12:30')).toBe('12:30');
  expect(sentenceCase('₹2.45L')).toBe('₹2.45L');
  expect(sentenceCase('—')).toBe('—');
});

test('cell values keep their formatting', () => {
  expect(cellCase(null)).toBe('');
  expect(cellCase(undefined)).toBe('');
  expect(cellCase(1248)).toBe('1248');       // a number is not re-cased or re-formatted
  expect(cellCase('overdue')).toBe('Overdue');
});

test('the review helper finds only genuinely uncased strings', () => {
  expect(isSentenceCased('Save')).toBe(true);
  expect(isSentenceCased('12 items')).toBe(true);   // a digit cannot be capitalised
  expect(isSentenceCased('save')).toBe(false);
  // FAIL-FIRST: this assertion was OBSERVED FAILING (06-Sep-2026). The first implementation
  // flagged "iOS build" as uncased, which would push a reviewer to "correct" it into "IOS" -
  // the exact corruption this module exists to prevent. A capital at the SECOND character is
  // the dictionary-free signal that the lowercase first letter was chosen, not missed.
  expect(isSentenceCased('iOS build')).toBe(true);
  expect(isSentenceCased('eBay listing')).toBe(true);
  expect(findUncased(['Save', 'delete', '', 'iOS build', 'cancel'])).toEqual(['delete', 'cancel']);
});
