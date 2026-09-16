/**
 * hr-documents unit spec — the merge, and the rule that nothing gets signed blank.
 *
 * WHY THESE ARE THE CASES
 *   Three documents here get SIGNED, and two of them by the employee. The failure that matters
 *   is not a crash; it is a document that reads perfectly and says nothing — "a gross monthly
 *   salary of  , subject to applicable statutory deductions". Every case below is about a value
 *   that is absent and must be visible as absent.
 *
 * FAIL-FIRST EVIDENCE: observed on 16-Sep-2026. The module is new, so against the pre-fix tree
 * the whole file failed to collect. Two deliberate defects were then put into the finished module
 * and the suite re-run:
 *
 *   1. `merge()` returning `{ text: '', placeholder: false }` for a blank value instead of the
 *      bracketed label — **5 failed, 22 passed**: "A BLANK VALUE IS NEVER A BLANK STRING", "a
 *      placeholder cannot be mistaken for the sentence around it", "whitespace is not a value",
 *      "undefined and null are the same as empty", and "AN UNPARSEABLE DATE RETURNS EMPTY so the
 *      merge marks it". That is the defect the flowchart's rule exists to prevent: an offer
 *      letter with a blank salary is a blank cheque, and it reads like a typo.
 *   2. `pronounsFor` falling back to he/him when the gender field is empty instead of they/them
 *      — **1 failed, 26 passed**. An experience certificate is handed to a future employer; one
 *      that misgenders its subject is worse than one that reads a little formally.
 *
 * Both were reverted and the suite returned to 27 passed.
 */
import { test, expect } from '@playwright/test';
import {
  longDate,
  merge,
  missingFields,
  monthName,
  payslipTotals,
  pronounsFor,
  readinessLine,
  rupeesInWords,
  type EmploymentRecord,
  type RestaurantIdentity,
} from '../../src/lib/hr-documents';

const RECORD: EmploymentRecord = {
  name: 'Firoz Ahmed',
  employeeCode: 'JAL-014',
  designation: 'Captain',
  department: 'Service',
  joinedOn: '2024-06-03',
  lastWorkingDay: '',
  gender: 'Male',
  employmentType: 'Full-time',
  monthlySalary: 22000,
  reportsTo: 'Javeed',
  shift: '11:00 AM – 3:30 PM, 6:30 PM – 11:00 PM',
  mobile: '+91 98765 43210',
  email: 'firoz@example.com',
  homeAddress: '12/4 Bagalur Road, Hosur 635109',
  pan: 'ABCPF1234K',
  uan: '',
  bankLast4: '7741',
};

const IDENTITY: RestaurantIdentity = {
  name: 'Jalsa Restaurant',
  address: '142 Bagalur Main Road, Hosur, Tamil Nadu 635109',
  phone: '+91 90000 12345',
  email: 'hello@jalsahosur.in',
  signatoryName: 'Javeed',
  signatoryRole: 'Proprietor',
};

const EMPTY: EmploymentRecord = {
  name: '', employeeCode: '', designation: '', department: '', joinedOn: '', lastWorkingDay: '',
  gender: '', employmentType: '', monthlySalary: null, reportsTo: '', shift: '', mobile: '',
  email: '', homeAddress: '', pan: '', uan: '', bankLast4: '',
};

/* ── The merge ─────────────────────────────────────────────────────────── */

test('A BLANK VALUE IS NEVER A BLANK STRING — it is a bracketed label', () => {
  const m = merge('', 'Monthly salary');
  expect(m.placeholder).toBe(true);
  expect(m.text).toBe('[MONTHLY SALARY]');
});

test('a placeholder cannot be mistaken for the sentence around it', () => {
  // Brackets and upper case, both. Either alone reads as prose in a formal letter.
  const m = merge(null, 'Employee full name');
  expect(m.text.startsWith('[')).toBe(true);
  expect(m.text.endsWith(']')).toBe(true);
  expect(m.text).toBe(m.text.toUpperCase());
});

test('whitespace is not a value — a field holding spaces is still unfilled', () => {
  expect(merge('   ', 'Designation').placeholder).toBe(true);
  expect(merge('\t\n', 'Designation').placeholder).toBe(true);
});

test('a real value passes through untouched and is not marked', () => {
  const m = merge('Captain', 'Designation');
  expect(m.text).toBe('Captain');
  expect(m.placeholder).toBe(false);
});

test('undefined and null are the same as empty — a missing column is a missing field', () => {
  expect(merge(undefined, 'PAN').placeholder).toBe(true);
  expect(merge(null, 'PAN').placeholder).toBe(true);
});

/* ── Money in words ────────────────────────────────────────────────────── */

test('the amount is spelled in the INDIAN system — lakh and crore, not million', () => {
  expect(rupeesInWords(120000)).toBe('One Lakh Twenty Thousand');
  expect(rupeesInWords(10000000)).toBe('One Crore');
  expect(rupeesInWords(22000)).toBe('Twenty Two Thousand');
});

test('the words agree with the figure for the awkward numbers', () => {
  expect(rupeesInWords(101)).toBe('One Hundred One');
  expect(rupeesInWords(115)).toBe('One Hundred Fifteen');
  expect(rupeesInWords(1000)).toBe('One Thousand');
  expect(rupeesInWords(19)).toBe('Nineteen');
  expect(rupeesInWords(90)).toBe('Ninety');
});

test('zero is the word Zero, never an empty string on a signed document', () => {
  expect(rupeesInWords(0)).toBe('Zero');
});

test('A NEGATIVE NET IS SPELLED WITH ITS SIGN, never quietly made positive', () => {
  // Deductions exceeding earnings is a mistake somebody has to see.
  expect(rupeesInWords(-500)).toBe('Minus Five Hundred');
});

test('paise round to the rupee rather than appearing in the words', () => {
  expect(rupeesInWords(22000.6)).toBe('Twenty Two Thousand One');
});

/* ── Dates ─────────────────────────────────────────────────────────────── */

test('a date prints the way a letter reads it', () => {
  expect(longDate('2024-06-03')).toBe('3 June 2024');
  expect(monthName('2026-08')).toBe('August 2026');
});

test('AN UNPARSEABLE DATE RETURNS EMPTY so the merge marks it, never a fabricated one', () => {
  expect(longDate('')).toBe('');
  expect(longDate('03/06/2024')).toBe('');
  expect(longDate('2024-13-03')).toBe('');
  expect(monthName('2026')).toBe('');
  expect(merge(longDate('not a date'), 'Date of joining').placeholder).toBe(true);
});

/* ── Pronouns ──────────────────────────────────────────────────────────── */

test('an unrecorded gender is THEY, never a guess from the name', () => {
  expect(pronounsFor('')).toEqual({ subject: 'they', possessive: 'their', object: 'them' });
  expect(pronounsFor('Prefer not to say')).toEqual({ subject: 'they', possessive: 'their', object: 'them' });
});

test('a recorded gender is used as recorded', () => {
  expect(pronounsFor('Male').subject).toBe('he');
  expect(pronounsFor('female').possessive).toBe('her');
});

/* ── Payslip arithmetic ────────────────────────────────────────────────── */

const SLIP = {
  earnings: { basic: 13200, hra: 5280, conveyance: 1600, meal: 1200, other: 720 },
  deductions: { pf: 1584, esi: 165 },
};

test('net is gross minus deductions, and the words agree with the figure', () => {
  const t = payslipTotals(SLIP);
  expect(t.gross).toBe(22000);
  expect(t.totalDeductions).toBe(1749);
  expect(t.net).toBe(20251);
  expect(t.netInWords).toBe('Twenty Thousand Two Hundred Fifty One');
});

test('A LINE WORTH NOTHING IS NOT PRINTED — "Overtime 0" invites a question it cannot answer', () => {
  const t = payslipTotals(SLIP);
  expect(t.earnings.map((r) => r.label)).not.toContain('Overtime');
  expect(t.deductions.map((r) => r.label)).not.toContain('TDS');
  expect(t.earnings).toHaveLength(5);
});

test('an explicit zero is treated as a blank line, not as a printed zero', () => {
  const t = payslipTotals({ earnings: { basic: 10000, overtime: 0 }, deductions: {} });
  expect(t.earnings).toHaveLength(1);
});

test('a slip with nothing on it totals zero honestly rather than throwing', () => {
  const t = payslipTotals({ earnings: {}, deductions: {} });
  expect(t.gross).toBe(0);
  expect(t.net).toBe(0);
  expect(t.netInWords).toBe('Zero');
});

test('deductions exceeding earnings produce a negative net, not a clamped one', () => {
  const t = payslipTotals({ earnings: { basic: 1000 }, deductions: { advance: 1500 } });
  expect(t.net).toBe(-500);
  expect(t.netInWords).toContain('Minus');
});

/* ── Readiness ─────────────────────────────────────────────────────────── */

test('a whole offer letter with an empty record marks every field it needs', () => {
  const missing = missingFields({
    kind: 'offer',
    record: EMPTY,
    identity: { ...IDENTITY, address: '', signatoryName: '' },
    offer: { letterDate: '', probation: '', notice: '', workLocation: '' },
  });
  expect(missing.map((m) => m.key)).toEqual(
    expect.arrayContaining(['name', 'designation', 'monthlySalary', 'rAddress', 'signatoryName', 'probation', 'notice'])
  );
});

test('THE THREE DOCUMENTS NEED DIFFERENT THINGS — an offer letter must not want a leaving date', () => {
  const offer = missingFields({
    kind: 'offer',
    record: RECORD,
    identity: IDENTITY,
    offer: { letterDate: '2026-09-09', probation: '3 months', notice: '30 days', workLocation: 'Hosur' },
  });
  const cert = missingFields({
    kind: 'experience',
    record: RECORD,
    identity: IDENTITY,
    certificate: { letterDate: '2026-09-09', duties: 'table service', qualities: 'punctuality' },
  });
  expect(offer).toEqual([]);
  expect(cert.map((m) => m.key)).toContain('lastWorkingDay');
});

test('an employee who has left can be given a certificate, and the offer letter is unaffected', () => {
  const left = { ...RECORD, lastWorkingDay: '2026-08-31' };
  const cert = missingFields({
    kind: 'experience',
    record: left,
    identity: IDENTITY,
    certificate: { letterDate: '2026-09-09', duties: 'table service', qualities: 'punctuality' },
  });
  expect(cert).toEqual([]);
});

test('A PAYSLIP WITH NO EARNINGS IS A WRONG FORM, not an unfinished one — it is named', () => {
  const missing = missingFields({
    kind: 'payslip',
    record: RECORD,
    identity: IDENTITY,
    payslip: {
      month: '2026-08', payDate: '2026-09-05', payableDays: '31', paidDays: '31', lopDays: '0',
      paymentMode: 'Bank transfer', preparedBy: 'Rehana', earnings: {}, deductions: {},
    },
  });
  expect(missing.map((m) => m.key)).toContain('earnings');
});

test('a salary of zero counts as unrecorded — nobody is employed at nothing a month', () => {
  const missing = missingFields({
    kind: 'offer',
    record: { ...RECORD, monthlySalary: 0 },
    identity: IDENTITY,
    offer: { letterDate: '2026-09-09', probation: '3 months', notice: '30 days', workLocation: 'Hosur' },
  });
  expect(missing.map((m) => m.key)).toContain('monthlySalary');
});

test('the readiness line NAMES fields rather than counting them', () => {
  const line = readinessLine(
    [
      { key: 'designation', label: 'Designation' },
      { key: 'department', label: 'Department' },
      { key: 'joinedOn', label: 'Date of joining' },
      { key: 'notice', label: 'Notice period' },
    ],
    'Firoz Ahmed'
  );
  expect(line).toContain('Designation, Department, Date of joining');
  expect(line).toContain('and more');
});

test('a complete record says so, and says whose it is', () => {
  expect(readinessLine([], 'Firoz Ahmed')).toContain('Firoz Ahmed');
  expect(readinessLine([], '')).toContain('this employee');
});

test('one missing field is reported in the singular', () => {
  expect(readinessLine([{ key: 'notice', label: 'Notice period' }], 'Mani')).toContain('1 field still');
});
