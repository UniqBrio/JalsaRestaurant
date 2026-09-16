import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import { billTotals, listClosedBillsBetween, listExpensesBetween, readAllSettings } from '@/lib/db/queries';
import { rupees } from '@/lib/money';
import { checkRange, summarise, type RangeBill, type RangeExpense } from '@/lib/report-range';

/* The same three words the console uses. Duplicated nowhere else: a fourth spelling of "guest
 * phone" is how a report and a bill detail end up disagreeing about where an order came from. */
const SOURCE_LABEL: Record<'guest' | 'captain' | 'owner', string> = {
  guest: 'Guest phone',
  captain: 'Captain',
  owner: 'Owner',
};

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
  const verdict = checkRange({ from, to }, new Date());
  if (verdict.problem) {
    return fail(400, { code: 'validation', message: verdict.problem });
  }

  const [bills, expenses, settings] = await Promise.all([
    listClosedBillsBetween(from, to),
    listExpensesBetween(from, to),
    readAllSettings(),
  ]);

  const tax = (settings.tax ?? {}) as { rate?: number };
  const taxRate = typeof tax.rate === 'number' ? tax.rate : 5;

  const rangeBills: RangeBill[] = bills.map((b) => {
    const t = billTotals(b);
    return {
      closedOn: (b.closedAt ?? '').slice(0, 10),
      subtotal: t.subtotal,
      discount: t.discount,
      tax: t.tax,
      tip: t.tip,
      restaurantIncome: t.restaurantIncome,
      covers: b.guests,
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
  for (const b of bills) {
    for (const k of b.kots) {
      if (k.status === 'cancelled') continue;
      for (const i of k.items) {
        if (i.cancelledAt) continue;
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
    },
    products: [...products.values()].sort((a, b) => b.revenue - a.revenue),
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
        sources: [...new Set(b.kots.map((k) => SOURCE_LABEL[k.source]))].join(', '),
        closedOn: t.closedOn,
        payable,
        payableLabel: rupees(payable),
      };
    }),
    expenses,
  });
});
