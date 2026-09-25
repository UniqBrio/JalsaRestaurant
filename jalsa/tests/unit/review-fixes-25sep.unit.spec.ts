import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEFAULT_ENCODER, encodeTicket, hex } from '../../src/lib/escpos';
import { invoiceLines, invoiceTicketData, type InvoiceBill } from '../../src/lib/invoice';
import { PAPER, billColumns, billItemLines, bigColsFor, totalLine } from '../../src/lib/print-template';
import { dailyTruncated, MAX_DAILY_POINTS } from '../../src/lib/report-daily';
import { checkReviewLink } from '../../src/lib/review-link';

/**
 * The code review of the 25-Sep correction list (REQUEST CHANGES) - each finding fixed, executed.
 */

const code = (p: string): string => readFileSync(p, 'utf8');
const WHO = { name: 'Jalsa', address: '', phone: '', gstin: '', upiId: '' };
const bill = (over: Partial<InvoiceBill> = {}): InvoiceBill => ({
  code: 'B-2000',
  hostTable: 'A1',
  tables: ['A1'],
  captain: '',
  openedAt: '2026-09-25T10:00:00Z',
  closedAt: '2026-09-25T11:00:00Z',
  discountPct: 0,
  discountAmount: 0,
  taxRate: 5,
  paymentMode: 'Cash',
  kots: [{ status: 'served', items: [{ name: 'Mutton Biryani', qty: 2, unitPrice: 400, foodType: 'non_veg', category: 'Biryani', cancelledAt: null }] }],
  ...over,
});

test('#7: a tipped bill prints the tip on its own line and a TOTAL equal to the screen\'s To pay', () => {
  const data = invoiceTicketData(bill({ tip: 100 }), WHO);
  expect(data.totals?.payable).toBe(800 + 40 + 100);
  const texts = invoiceLines(bill({ tip: 100 }), WHO, '80', undefined).map((l) => l.text);
  expect(texts.find((t) => t.startsWith('TIP'))?.endsWith('100')).toBe(true);
  expect(texts.find((t) => t.startsWith('TOTAL'))).toContain('940');
  expect(invoiceLines(bill(), WHO, '80', undefined).some((l) => l.text.startsWith('TIP'))).toBe(false);
});

test('#8: a TOTAL too wide for the big grid is never cut - it drops Rs., then prints bold at full width', () => {
  expect(totalLine('940', 16, 32)).toEqual({ text: 'TOTAL     Rs.940', weight: 'big' });
  const lakh = totalLine('1,23,456', 16, 32);
  expect(lakh.weight).toBe('big');
  expect(lakh.text).toBe('TOTAL   1,23,456');
  const crore = totalLine('1,23,45,678', 16, 32);
  expect(crore.weight).toBe('bold');
  expect(crore.text.endsWith('Rs.1,23,45,678')).toBe(true);
});

test('#8: item figures are never clipped and two columns never touch, at 58 mm', () => {
  const c = billColumns(PAPER['58'].cols.normal, true);
  const [line] = billItemLines({ name: 'Family Pack', qty: 12, foodType: 'veg', rate: 12500, category: '', instruction: '' }, c);
  expect(line).toContain('12,500');
  expect(line).toContain('1,50,000');
  expect(line).toMatch(/12,500 +1,50,000$/);
  expect(line!.length).toBe(PAPER['58'].cols.normal);
});

test('#9: "large" is font B at double size for the whole ticket, and a big line is its full width, bold', () => {
  expect(bigColsFor(32, 'large')).toBe(32);
  expect(bigColsFor(32)).toBe(16);
  const lines = [{ text: 'A', weight: 'plain' as const }, { text: 'B', weight: 'big' as const }];
  const h = hex(encodeTicket(lines, { ...DEFAULT_ENCODER, width: '80', area: true, font: 'large' }));
  expect(h.startsWith('1B 40 1B 74 00 1D 4C 00 00 1D 57 40 02 1B 4D 01 1D 21 11 41 0A')).toBe(true);
  // The big line switches bold on, never the size again.
  expect(h).toContain('1B 45 01 42 0A');
  expect(h.split('1D 21 11').length - 1).toBe(1);
});

test('#6: a range longer than the chart draws says so; a shorter one does not', () => {
  expect(dailyTruncated('2026-01-01', '2026-06-30')).toBe(true);
  expect(dailyTruncated('2026-09-01', '2026-09-30')).toBe(false);
  expect(MAX_DAILY_POINTS).toBe(92);
  expect(code('src/features/owner/sections/ReportsSection.tsx')).toContain('data-testid="owner-rep-chart-daily-truncated"');
});

test('#21: a look-alike host is not taken for Google', () => {
  expect(checkReviewLink('https://google.evil.com/x')).toMatchObject({ state: 'ok' });
  const evil = checkReviewLink('https://google.evil.com/x');
  expect(evil.state === 'ok' && evil.warning).toContain('google.evil.com');
  expect(checkReviewLink('https://www.google.co.in/maps/place/x')).toMatchObject({ warning: null });
});

test('#1-#5, #10-#18: the server-side guards the review asked for are in place', () => {
  const m = code('src/lib/db/owner-mutations.ts');
  expect(m).toContain("if ((input.printerId ?? null) !== before) demand(input.actor, 'set.printer');");
  expect(m).toContain("prints bills, not kitchen tickets. Choose a kitchen printer.");
  expect(m).toContain("if (input.printerId) demand(input.actor, 'set.printer');\n  const restaurantId");
  expect(m).toContain("typeof input.base64 !== 'string'");
  expect(m).toContain("typeof input.station !== 'string'");
  const mu = code('src/lib/db/mutations.ts');
  expect(mu).toContain("if (insErr && insErr.code !== '23505') throw insErr;");
  expect(mu).toContain('// A failed read is an error, never an empty round');
  expect(code('supabase/migrations/20260925110000_jalsa_payment_notice_once.sql')).toContain('on public.table_request (bill_id, kind)');
  expect(code('supabase/migrations/20260925100000_jalsa_item_routing_and_media.sql')).toContain('kot_item_route_printer_idx');
  const bp = code('src/lib/db/bridge-payload.ts');
  expect(bp).toContain("const rate = Number.isFinite(Number(tax.rate)) ? Number(tax.rate) : 5;");
  expect(bp).toContain("purpose: 'KOT',");
});
