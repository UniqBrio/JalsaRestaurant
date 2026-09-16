/**
 * hr-documents — an offer letter, an experience certificate and a payslip, merged from the
 * employment record.
 *
 * THE ONE RULE THE WHOLE MODULE EXISTS FOR
 *   `Jalsa Navigation Flowchart.dc.html`, section six: *"Variables merge from the employment
 *   record and the restaurant identity. **Anything unfilled prints as a marked placeholder so
 *   nothing is signed blank.**"*
 *
 *   That last clause is not a styling note. These three documents get signed, and two of them
 *   get signed by the employee. A merge that silently drops an unknown value produces "You will
 *   receive a gross monthly salary of  , subject to applicable statutory deductions" — which
 *   reads as a typo and is in fact a blank cheque. So every field goes through `merge()`, which
 *   returns either the value or a `[LABEL]` placeholder that is impossible to read as prose, and
 *   `missingFields()` names them all before anybody reaches for the printer.
 *
 * WHY THE MONEY IS SPELLED OUT
 *   Every Indian payslip and offer letter carries the amount in words, because a figure can be
 *   altered with a pen and "Rupees Twenty Two Thousand" cannot. It is written in the Indian
 *   system — crore, lakh, thousand — since that is what the reader will check it against.
 *
 * NOTHING HERE TOUCHES THE DATABASE OR REACT. The document is a data structure; the screen
 * renders it and the printer prints it, and both are looking at the same merge.
 */

/* ── The record a document merges from ─────────────────────────────────── */

export interface EmploymentRecord {
  name: string;
  employeeCode: string;
  designation: string;
  department: string;
  /** ISO date, or '' when nobody has recorded one. */
  joinedOn: string;
  lastWorkingDay: string;
  gender: string;
  employmentType: string;
  monthlySalary: number | null;
  reportsTo: string;
  shift: string;
  mobile: string;
  email: string;
  homeAddress: string;
  pan: string;
  uan: string;
  bankLast4: string;
}

export interface RestaurantIdentity {
  name: string;
  address: string;
  phone: string;
  email: string;
  signatoryName: string;
  signatoryRole: string;
}

export type DocumentKind = 'offer' | 'experience' | 'payslip';

export interface OfferTerms {
  letterDate: string;
  probation: string;
  notice: string;
  workLocation: string;
}

export interface CertificateTerms {
  letterDate: string;
  duties: string;
  qualities: string;
}

export interface PayslipTerms {
  /** `YYYY-MM`. */
  month: string;
  payDate: string;
  payableDays: string;
  paidDays: string;
  lopDays: string;
  paymentMode: string;
  preparedBy: string;
  earnings: Record<string, number | null>;
  deductions: Record<string, number | null>;
}

/* ── Merged values ─────────────────────────────────────────────────────── */

export interface Merged {
  /** What prints. Either the real value or `[LABEL]`. */
  text: string;
  /** True when this is a placeholder — the screen marks it, and so does the paper. */
  placeholder: boolean;
}

/**
 * The merge.
 *
 * An empty value never becomes an empty string. It becomes a bracketed, upper-case label that
 * cannot be mistaken for the sentence around it — which is the entire point, because the
 * alternative is a document that reads correctly and says nothing.
 */
export function merge(value: string | null | undefined, label: string): Merged {
  const v = (value ?? '').toString().trim();
  return v ? { text: v, placeholder: false } : { text: `[${label.toUpperCase()}]`, placeholder: true };
}

/* ── Money ─────────────────────────────────────────────────────────────── */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n: number): string =>
  n < 20 ? (ONES[n] ?? '') : `${TENS[Math.floor(n / 10)] ?? ''}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;

const threeDigits = (n: number): string =>
  n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}` : twoDigits(n);

/**
 * A rupee figure, in words, in the Indian system.
 *
 * Crore and lakh rather than million — the person checking this against the figure beside it
 * groups digits as 22,000 and 1,20,000, and a document that spells "One Hundred Twenty Thousand"
 * makes them do arithmetic to agree with it.
 *
 * A negative net is spelled with its sign rather than silently made positive. A payslip whose
 * deductions exceed its earnings is a mistake somebody needs to see, not one to round away.
 */
export function rupeesInWords(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded === 0) return 'Zero';
  const sign = rounded < 0 ? 'Minus ' : '';
  let n = Math.abs(rounded);

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return sign + parts.join(' ');
}

/* ── Dates ─────────────────────────────────────────────────────────────── */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `2024-06-03` → `3 June 2024`. An unparseable or absent date returns '' so `merge` marks it. */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? '').trim());
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '';
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** `2026-08` → `August 2026`. */
export function monthName(value: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec((value ?? '').trim());
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : '';
}

/* ── Pronouns ──────────────────────────────────────────────────────────── */

export interface Pronouns {
  subject: string;
  possessive: string;
  object: string;
}

/**
 * The pronouns an experience certificate uses.
 *
 * A certificate is a paragraph about a person, so it needs one. Where the record does not say —
 * and "prefer not to say" is one of the answers the form offers — it is **they/their/them**,
 * never a guess from the name. A certificate that misgenders its subject is worse than one that
 * reads a little formally, and it is handed to a future employer.
 */
export function pronounsFor(gender: string): Pronouns {
  const g = (gender ?? '').trim().toLowerCase();
  if (g === 'male') return { subject: 'he', possessive: 'his', object: 'him' };
  if (g === 'female') return { subject: 'she', possessive: 'her', object: 'her' };
  return { subject: 'they', possessive: 'their', object: 'them' };
}

/* ── Payslip arithmetic ────────────────────────────────────────────────── */

export const EARNING_LINES: Array<[string, string]> = [
  ['basic', 'Basic Salary'],
  ['hra', 'HRA'],
  ['conveyance', 'Conveyance / Transport Allowance'],
  ['meal', 'Food / Meal Allowance'],
  ['other', 'Other Allowances'],
  ['overtime', 'Overtime'],
  ['incentive', 'Incentives'],
];

export const DEDUCTION_LINES: Array<[string, string]> = [
  ['pf', 'Provident Fund (PF)'],
  ['esi', 'ESI'],
  ['ptax', 'Professional Tax'],
  ['tds', 'TDS'],
  ['advance', 'Advance / Loan'],
  ['otherDed', 'Other Deductions'],
];

export interface PayslipRow {
  label: string;
  amount: number;
}

export interface PayslipTotals {
  earnings: PayslipRow[];
  deductions: PayslipRow[];
  gross: number;
  totalDeductions: number;
  net: number;
  netInWords: string;
}

/**
 * The payslip's figures.
 *
 * A LINE WORTH NOTHING IS NOT PRINTED. The design says so — *"Blank rows are left out of the
 * printed slip rather than printed as zero"* — and the reason is that "Overtime  0" on a slip
 * invites the question "why does it say zero, did I not get paid for Tuesday?". A line that does
 * not apply should not be on the paper at all.
 *
 * Net is gross minus deductions and nothing else. There is no rounding step: these are whole
 * rupees entered by a person, and a payslip that disagreed with the bank transfer by a rupee
 * would be a conversation every month.
 */
export function payslipTotals(terms: {
  earnings: Record<string, number | null>;
  deductions: Record<string, number | null>;
}): PayslipTotals {
  const rows = (
    defs: Array<[string, string]>,
    values: Record<string, number | null>
  ): PayslipRow[] =>
    defs
      .map(([key, label]) => ({ label, amount: Number(values[key] ?? 0) || 0 }))
      .filter((r) => r.amount !== 0);

  const earnings = rows(EARNING_LINES, terms.earnings);
  const deductions = rows(DEDUCTION_LINES, terms.deductions);
  const gross = earnings.reduce((a, r) => a + r.amount, 0);
  const totalDeductions = deductions.reduce((a, r) => a + r.amount, 0);
  const net = gross - totalDeductions;

  return { earnings, deductions, gross, totalDeductions, net, netInWords: rupeesInWords(net) };
}

/* ── Readiness ─────────────────────────────────────────────────────────── */

export interface MissingField {
  key: string;
  label: string;
}

/**
 * What is still blank, per document.
 *
 * Checked BEFORE printing rather than discovered on the paper. The three documents need
 * different things — a certificate needs a last working day and an offer letter must not have
 * one — so the list is per kind, not a single "employment record complete" flag that would be
 * false for every current employee forever.
 */
export function missingFields(input: {
  kind: DocumentKind;
  record: EmploymentRecord;
  identity: RestaurantIdentity;
  offer?: OfferTerms;
  certificate?: CertificateTerms;
  payslip?: PayslipTerms;
}): MissingField[] {
  const blank = (v: unknown): boolean => !String(v ?? '').trim();
  const out: MissingField[] = [];
  const need = (cond: boolean, key: string, label: string): void => {
    if (cond) out.push({ key, label });
  };

  need(blank(input.record.name), 'name', 'Full name');
  need(blank(input.record.designation), 'designation', 'Designation');
  need(blank(input.record.department), 'department', 'Department');
  need(blank(input.record.joinedOn), 'joinedOn', 'Date of joining');
  need(input.record.monthlySalary === null || input.record.monthlySalary === 0, 'monthlySalary', 'Monthly salary');
  need(blank(input.identity.address), 'rAddress', 'Restaurant address');
  need(blank(input.identity.signatoryName), 'signatoryName', 'Signatory');

  if (input.kind === 'offer') {
    need(blank(input.offer?.probation), 'probation', 'Probation period');
    need(blank(input.offer?.notice), 'notice', 'Notice period');
    need(blank(input.offer?.letterDate), 'letterDate', 'Letter date');
  }

  if (input.kind === 'experience') {
    need(blank(input.record.lastWorkingDay), 'lastWorkingDay', 'Last working day');
    need(blank(input.certificate?.duties), 'duties', 'Responsibilities');
    need(blank(input.certificate?.letterDate), 'letterDate', 'Certificate date');
  }

  if (input.kind === 'payslip') {
    need(blank(input.payslip?.month), 'month', 'Salary month');
    need(blank(input.payslip?.payDate), 'payDate', 'Payment date');
    // A payslip with no earnings is not an unfinished form, it is a wrong one. Named here
    // rather than left to the totals, which would honestly report a net of zero.
    need(payslipTotals(input.payslip ?? { earnings: {}, deductions: {} }).gross === 0, 'earnings', 'At least one earning line');
  }

  return out;
}

/**
 * One sentence about whether this document may be printed, for the screen to show.
 *
 * It names the first three missing fields rather than a count, because "7 fields still to fill"
 * sends somebody hunting and "Designation, Department, Date of joining and more" sends them to
 * the right part of the form.
 */
export function readinessLine(missing: MissingField[], who: string): string {
  if (missing.length === 0) {
    return `Every required field is filled — ready to print for ${who || 'this employee'}`;
  }
  const named = missing.slice(0, 3).map((m) => m.label).join(', ');
  return `${missing.length} ${missing.length === 1 ? 'field' : 'fields'} still to fill — ${named}${
    missing.length > 3 ? ' and more' : ''
  }`;
}
