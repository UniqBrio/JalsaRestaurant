import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PAYMENT_NOTICE, isCounterNotice, noticesToRaise, paymentNoticeNote } from '../../src/lib/payment-notice';
import { whatsAppNumber, whatsAppShareUrl } from '../../src/lib/bill-share';
import { dailySeries, MAX_DAILY_POINTS } from '../../src/lib/report-daily';
import { summarise, type RangeBill } from '../../src/lib/report-range';
import { checkReviewLink } from '../../src/lib/review-link';

/** 25-Sep correction list, items 37-40, executed. */

const code = (p: string): string => readFileSync(p, 'utf8');

/* ── 37: two notifications from one payment request ───────────────────── */

test('37: one request raises two notifications - the captain\'s and the bill counter\'s - with the bill and amount', () => {
  expect(noticesToRaise([])).toEqual(['captain', 'counter']);
  expect(PAYMENT_NOTICE.captain.kind).not.toBe(PAYMENT_NOTICE.counter.kind);
  expect(paymentNoticeNote('captain', 'B-1050', '₹1,764')).toContain('B-1050');
  expect(paymentNoticeNote('captain', 'B-1050', '₹1,764')).toContain('clear it once they leave');
  const counter = paymentNoticeNote('counter', 'B-1050', '₹1,764');
  expect(counter).toContain('B-1050');
  expect(counter).toContain('₹1,764');
  expect(counter).toContain('asked for the bill');
});

test('37: no duplicates - a second tap raises nothing, and a kind already open is never written twice', () => {
  expect(noticesToRaise([PAYMENT_NOTICE.captain.kind])).toEqual(['counter']);
  expect(noticesToRaise([PAYMENT_NOTICE.captain.kind, PAYMENT_NOTICE.counter.kind])).toEqual([]);
  const m = code('src/lib/db/mutations.ts');
  const fn = m.slice(m.indexOf('export async function requestPayment'), m.indexOf('export async function withdrawPaymentRequest'));
  expect(fn).toContain("if (bill.status === 'payment_requested') return;");
  expect(fn).toContain('await raisePaymentNotices(bill);');
  expect(m).toContain(".in('kind', PAYMENT_NOTICE_KINDS as string[]);");
});

test('37: each recipient gets its own - the captain\'s phone leaves out the counter\'s; withdrawing clears both, paying clears the counter\'s', () => {
  expect(isCounterNotice(PAYMENT_NOTICE.counter.kind)).toBe(true);
  expect(isCounterNotice(PAYMENT_NOTICE.captain.kind)).toBe(false);
  expect(isCounterNotice('Need water')).toBe(false);
  expect(code('src/lib/db/staff-view.ts')).toContain('requests.filter((r) => !isCounterNotice(r.kind))');
  expect(code('src/lib/db/owner-view.ts')).toContain('forCounter: isCounterNotice(r.kind),');
  const m = code('src/lib/db/mutations.ts');
  expect(m).toContain('await resolvePaymentNotices(billId, PAYMENT_NOTICE_KINDS);');
  expect(m).toContain('await resolvePaymentNotices(input.billId, [PAYMENT_NOTICE.counter.kind]);');
});

/* ── 38: WhatsApp share ────────────────────────────────────────────────── */

test('38: a guest number opens that chat; empty lets WhatsApp ask; a wrong one is refused in words', () => {
  expect(whatsAppNumber('')).toEqual({ ok: true, digits: null });
  expect(whatsAppNumber('98765 43210')).toEqual({ ok: true, digits: '919876543210' });
  expect(whatsAppNumber('+91-98765-43210')).toEqual({ ok: true, digits: '919876543210' });
  expect(whatsAppNumber('098765 43210')).toEqual({ ok: true, digits: '919876543210' });
  expect(whatsAppNumber('12345').ok).toBe(false);
  expect(whatsAppNumber('5876543210').ok).toBe(false);
  expect(whatsAppNumber('abc').ok).toBe(false);
  expect(whatsAppShareUrl('Bill B-1050', '919876543210')).toBe('https://wa.me/919876543210?text=Bill%20B-1050');
  expect(whatsAppShareUrl('Bill B-1050')).toBe('https://wa.me/?text=Bill%20B-1050');
});

test('38: the shared bill is the one on screen now, read by id from this poll - never an earlier copy', () => {
  const p = code('src/features/owner/sections/Payments.tsx');
  expect(p).toContain('const [viewingId, setViewingId] = React.useState<string | null>(null);');
  expect(p).toContain('[...data.closedToday, ...data.openBills].find((b) => b.id === viewingId)');
  const sheet = code('src/features/owner/BillDetailSheet.tsx');
  expect(sheet).toContain('whatsAppShareUrl(billShareText(bill, identity, whatsAppTemplate), number.ok ? number.digits : null)');
  expect(sheet).toContain('data-testid="owner-bill-share-phone"');
});

/* ── 39: charts ────────────────────────────────────────────────────────── */

const bill = (closedOn: string, income: number): RangeBill => ({
  closedOn,
  subtotal: income,
  discount: 0,
  tax: 0,
  tip: 50,
  restaurantIncome: income,
  covers: 2,
  paymentMode: 'UPI',
});

test('39: every day of the range has a bar, zero days included, and the bars add up to the Sales tile', () => {
  const bills = [bill('2026-09-22', 1000), bill('2026-09-22', 500), bill('2026-09-24', 700)];
  const days = dailySeries('2026-09-21', '2026-09-24', bills);
  expect(days.map((d) => d.day)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
  expect(days.map((d) => d.sales)).toEqual([0, 1500, 0, 700]);
  expect(days.map((d) => d.bills)).toEqual([0, 2, 0, 1]);
  expect(days.reduce((a, d) => a + d.sales, 0)).toBe(summarise({ bills, expenses: [] }).sales);
  expect(days[1]?.label).toBe('22 Sep');
});

test('39: a year-long range is capped rather than drawing hundreds of hairlines; an inverted one is empty', () => {
  expect(dailySeries('2026-01-01', '2026-12-31', [])).toHaveLength(MAX_DAILY_POINTS);
  expect(dailySeries('2026-09-24', '2026-09-21', [])).toEqual([]);
});

test('39: the charts are the report\'s own data, move with the range, and say when there is nothing', () => {
  expect(code('src/app/api/owner/report/route.ts')).toContain('daily: dailySeries(from, to, rangeBills, rangeExpenses),');
  const r = code('src/features/owner/sections/ReportsSection.tsx');
  expect(r).toContain('<ChartsPanel report={report} />');
  expect(r).toContain('data-testid="owner-rep-chart-daily-empty"');
  expect(r).toContain('data-testid="owner-rep-chart-category-empty"');
  const chart = code('src/components/ui/bar-chart.tsx');
  expect(chart).toContain('fill="var(--primary)"');
  expect(chart).toContain('<title>');
  expect(chart).toContain('role="img" aria-label={summary}');
  expect(chart).toContain('className="block h-auto w-full"');
});

/* ── 40: the Google review link ────────────────────────────────────────── */

test('40: empty hides the card; a non-https or broken link is refused; a non-Google one is allowed with a warning', () => {
  expect(checkReviewLink('')).toEqual({ state: 'empty' });
  expect(checkReviewLink('http://g.page/r/abc/review').state).toBe('invalid');
  expect(checkReviewLink('g.page/r/abc').state).toBe('invalid');
  expect(checkReviewLink('https://localhost').state).toBe('invalid');
  const g = checkReviewLink('https://g.page/r/CabcXYZ/review');
  expect(g).toEqual({ state: 'ok', url: 'https://g.page/r/CabcXYZ/review', warning: null });
  expect(checkReviewLink('https://search.google.com/local/writereview?placeid=X')).toMatchObject({ state: 'ok', warning: null });
  const other = checkReviewLink('https://example.com/review');
  expect(other.state).toBe('ok');
  expect(other.state === 'ok' && other.warning).toContain('example.com');
});

test('40: saved from the screen, checked again on the server, and opened / shared / printed from it - never hard-coded', () => {
  const s = code('src/features/owner/sections/SettingsSection.tsx');
  expect(s).toContain("disabled={busy || review.state === 'invalid'}");
  expect(s).toContain('data-testid="owner-engage-review-open-link"');
  expect(s).toContain('data-testid="owner-engage-review-share-link"');
  expect(s).toContain('href="/api/owner/review-qr"');
  expect(code('src/lib/db/owner-mutations.ts')).toContain("if (input.key === 'engagement' && 'reviewUrl' in input.value)");
  for (const f of ['src/features/owner/sections/SettingsSection.tsx', 'src/lib/review-link.ts', 'src/app/api/owner/review-qr/route.ts']) {
    expect(code(f), f).not.toMatch(/https:\/\/g\.page\/r\/[A-Za-z0-9]/);
  }
});
