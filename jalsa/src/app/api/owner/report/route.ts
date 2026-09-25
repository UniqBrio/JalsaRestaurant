import { dailySeries, dailyTruncated, MAX_DAILY_POINTS } from '@/lib/report-daily';
import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import {
  billTotals,
  lastClosedBillBefore,
  listClosedBillsBetween,
  listExpensesBetween,
  readAllSettings,
} from '@/lib/db/queries';
import { rupees } from '@/lib/money';
import { KOT_SOURCE_LABEL } from '@/lib/status';
import { checkRange, summarise, type GstSide, type RangeBill, type RangeExpense } from '@/lib/report-range';
import { dayIn, nowForRangeCheck, shortDayLabel } from '@/lib/restaurant-time';

/** Money formatted once, on the server, like every other figure this route sends. */
function sideLabels(side: GstSide): { grossLabel: string; netLabel: string; taxLabel: string } {
  return { grossLabel: rupees(side.gross), netLabel: rupees(side.net), taxLabel: rupees(side.tax) };
}

/* The same three words the console and the printed KOT use - `KOT_SOURCE_LABEL`, one map. A
 * second spelling of "guest phone" is how a report and a bill detail end up disagreeing about
 * where an order came from. */

/**
 * The ranged report — one date range, read once, projected into every panel.
 *
 * WHY THIS IS ITS OWN ENDPOINT AND NOT PART OF THE OWNER PAYLOAD
 *   `/api/owner/state` is polled every few seconds and carries the whole console. A thirty-day
 *   range is thousands of bill rows with their rounds and lines, and putting that on the poll
 *   would make every screen in the console pay for a report nobody has opened. It is fetched
 *   when the range changes and not otherwise.
 *
 * WHY THE FIGURES ARE COMPUTED HERE AND NOT IN THE BROWSER
 *   `billTotals` is the one place a bill is totalled (`money.ts`, Standard 7.4). A report that
 *   re-summed lines in the browser would be a second answer to "what did this bill come to", and
 *   the two would disagree on the first bill with a discount. The browser receives figures, not
 *   arithmetic.
 *
 * Guardrail 3: the browser never speaks to Supabase. This reads with the server key behind the
 * same permission check every other owner read makes, and `rep.sales` gates it — a report over a
 * month is the most confidential thing this console can show.
 */

export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request): Promise<NextResponse> => {
  const staff = await currentStaff();
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN to open the console.' });
  }
  if (!staff.grants.can('rep.sales')) {
    return fail(403, {
      code: 'forbidden',
      message: 'Reports over a date range are not part of your role.',
      permission: 'rep.sales',
    });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  // Validated with the SAME function the screen validates with, so a range the browser accepted
  // can never be one this route silently reinterprets.
  /* The restaurant's today, not the server's. On a UTC host, between midnight and 05:30 IST the
     server's date is still yesterday, so a range the browser had just accepted came back 400
     "that range has not happened yet" — for a range covering the shift in progress. */
  const verdict = checkRange({ from, to }, nowForRangeCheck());
  if (verdict.problem) {
    return fail(400, { code: 'validation', message: verdict.problem });
  }

  const [bills, expenses, settings, lastBefore] = await Promise.all([
    listClosedBillsBetween(from, to),
    listExpensesBetween(from, to),
    readAllSettings(),
    // The actual last bill before this range, for the empty state's "Last bill" line (A1).
    lastClosedBillBefore(from),
  ]);

  const tax = (settings.tax ?? {}) as { rate?: number };
  const taxRate = typeof tax.rate === 'number' ? tax.rate : 5;

  const rangeBills: RangeBill[] = bills.map((b) => {
    const t = billTotals(b);
    return {
      // Which local day the bill belongs to. Slicing the stored UTC string put a sitting that
      // ended after midnight on the day before, in the per-day rows and the daily chart alike.
      closedOn: b.closedAt ? dayIn(new Date(b.closedAt)) : '',
      subtotal: t.subtotal,
      discount: t.discount,
      tax: t.tax,
      tip: t.tip,
      restaurantIncome: t.restaurantIncome,
      covers: b.guests,
      // The payment chart is a projection of this; it needs no second read, and it is not
      // recomputed in the browser (Standard 7.4).
      paymentMode: b.paymentMode ?? '',
    };
  });

  const rangeExpenses: RangeExpense[] = expenses.map((e) => ({
    spentOn: e.spentOn,
    category: e.category,
    amount: e.amount,
  }));

  const summary = summarise({ bills: rangeBills, expenses: rangeExpenses });

  // What sold, over the range. Built from the same lines the totals came from, so the top
  // sellers add up to the sales figure above them rather than to a near-miss.
  const products = new Map<string, { name: string; qty: number; revenue: number }>();
  /* What sold, by the category it sold under. The same walk as the products map below and in
     the same loop on purpose: two walks over the same lines is how a category total ends up
     disagreeing with the dishes listed inside it. */
  const categories = new Map<string, { category: string; qty: number; revenue: number; dishes: Set<string> }>();
  for (const b of bills) {
    for (const k of b.kots) {
      if (k.status === 'cancelled') continue;
      for (const i of k.items) {
        if (i.cancelledAt) continue;
        const line = i.unitPrice * i.qty;
        // A round placed before the category was snapshotted still sold something.
        const catKey = i.category || 'Uncategorised';
        const cat = categories.get(catKey) ?? { category: catKey, qty: 0, revenue: 0, dishes: new Set<string>() };
        cat.qty += i.qty;
        cat.revenue += line;
        cat.dishes.add(i.name);
        categories.set(catKey, cat);
        const seen = products.get(i.name) ?? { name: i.name, qty: 0, revenue: 0 };
        seen.qty += i.qty;
        // The price the round was PLACED at, not today's menu price. A dish repriced mid-month
        // would otherwise make every earlier line in this report wrong.
        seen.revenue += i.unitPrice * i.qty;
        products.set(i.name, seen);
      }
    }
  }

  return ok({
    range: { from, to },
    taxRate,
    summary: {
      ...summary,
      salesLabel: rupees(summary.sales),
      purchasesLabel: rupees(summary.purchases),
      netLabel: rupees(summary.net),
      tipsLabel: rupees(summary.tips),
      discountsLabel: rupees(summary.discounts),
      taxLabel: rupees(summary.tax),
      averageBillLabel: rupees(summary.averageBill),
      byCategory: summary.byCategory.map((c) => ({ ...c, amountLabel: rupees(c.amount) })),
      gstSplit: {
        gst: { ...summary.gstSplit.gst, ...sideLabels(summary.gstSplit.gst) },
        nonGst: { ...summary.gstSplit.nonGst, ...sideLabels(summary.gstSplit.nonGst) },
      },
      byPaymentMode: summary.byPaymentMode.map((m) => ({
        ...m,
        amountLabel: rupees(m.amount),
        // The share each mode took, for the chart. Guarded, because a range with no bills
        // would otherwise divide by zero and print NaN% on a screen that reconciles cash.
        share: summary.sales > 0 ? Math.round((m.amount / summary.sales) * 100) : 0,
      })),
    },
    // The "Sales by day" chart (item 39): the same bills, the same summarise, per day.
    daily: dailySeries(from, to, rangeBills, rangeExpenses),
    dailyTruncated: dailyTruncated(from, to),
    dailyLimit: MAX_DAILY_POINTS,
    products: [...products.values()].sort((a, b) => b.revenue - a.revenue),
    categories: [...categories.values()]
      .map((c) => ({ category: c.category, qty: c.qty, revenue: c.revenue, dishes: c.dishes.size }))
      .sort((a, b) => b.revenue - a.revenue),
    orders: bills.map((b, i) => {
      const t = rangeBills[i]!;
      const payable = billTotals(b).payable;
      return {
        id: b.id,
        code: b.code,
        tables: b.tables.join(', '),
        captain: b.captain,
        guests: b.guests,
        rounds: b.kots.length,
        sources: [...new Set(b.kots.map((k) => KOT_SOURCE_LABEL[k.source]))].join(', '),
        closedOn: t.closedOn,
        payable,
        payableLabel: rupees(payable),
      };
    }),
    expenses,
    lastBillBefore: lastBefore
      ? {
          code: lastBefore.code,
          closedOn: dayIn(new Date(lastBefore.closedAt)),
          closedOnLabel: shortDayLabel(dayIn(new Date(lastBefore.closedAt))),
        }
      : null,
  });
});
