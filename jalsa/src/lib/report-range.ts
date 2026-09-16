/**
 * report-range — the one date range every report panel is read through.
 *
 * `Jalsa Navigation Flowchart.dc.html`, section three, Reports: *"Sales, purchases and expenses,
 * final report, all-orders ledger. **One date range governs every panel**; each exports."*
 *
 * WHY ONE RANGE AND NOT FOUR
 *   Four panels with four ranges is four answers to "how did last week go", and somebody will
 *   read the sales from one and the purchases from another and subtract them. The net would be
 *   wrong and nothing on the screen would say so. So the range is state held above the tabs, and
 *   every panel is a projection of the SAME rows.
 *
 * WHY THIS MODULE IS PURE
 *   Resolving a preset to two dates, validating a hand-typed pair, and rolling bills and
 *   expenses into a net are all decisions with edges — a range that ends before it starts, a
 *   range that reaches into tomorrow, a net computed from a tip. Each is testable without a
 *   database, and each is the kind of arithmetic that is wrong quietly.
 *
 * THE NET EXCLUDES TIPS ON BOTH SIDES. A tip is money the guest owed and the restaurant did not
 * earn (`money.ts` says so, and there is deliberately no field called "total"). A final report
 * that counted tips as income would overstate the business by the staff's own money.
 */

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export interface DateRange {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, inclusive. */
  to: string;
}

export const PRESET_LABEL: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  thisMonth: 'This month',
  custom: 'Custom',
};

const iso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * A preset, resolved against a given day.
 *
 * `today` is passed in rather than read from the clock so this is a function of its arguments —
 * a report that changes answer depending on when the test runs is a report nobody can pin.
 *
 * Every preset is INCLUSIVE at both ends, and "last 7 days" includes today: a restaurant asking
 * for the last seven days means the week it has just worked, not the week before this one.
 */
export function resolvePreset(preset: RangePreset, today: Date): DateRange {
  const day = (offset: number): Date => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() + offset);
    return d;
  };

  switch (preset) {
    case 'yesterday':
      return { from: iso(day(-1)), to: iso(day(-1)) };
    case 'last7':
      return { from: iso(day(-6)), to: iso(day(0)) };
    case 'last30':
      return { from: iso(day(-29)), to: iso(day(0)) };
    case 'thisMonth':
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(day(0)) };
    case 'today':
    case 'custom':
    default:
      return { from: iso(day(0)), to: iso(day(0)) };
  }
}

export interface RangeVerdict {
  range: DateRange;
  /** Null when the range is usable. A sentence when it is not — never a silent correction. */
  problem: string | null;
}

/**
 * A hand-typed range, checked.
 *
 * REVERSED DATES ARE REFUSED, NOT SWAPPED. Somebody who typed the end date into the start box
 * has made a mistake about which figures they are about to read, and quietly swapping them hands
 * back a correct-looking report for a question they did not ask.
 *
 * A range reaching into the future is allowed and says so instead: it is how a restaurant looks
 * at "this month" on the 3rd, and the rows simply do not exist yet.
 */
export function checkRange(range: DateRange, today: Date): RangeVerdict {
  const shape = /^\d{4}-\d{2}-\d{2}$/;
  if (!shape.test(range.from) || !shape.test(range.to)) {
    return { range, problem: 'Both dates are needed before a report can be read.' };
  }
  if (range.from > range.to) {
    return { range, problem: 'The range ends before it starts — check which date went in which box.' };
  }
  if (range.from > iso(today)) {
    return { range, problem: 'That range has not happened yet, so every panel will be empty.' };
  }
  return { range, problem: null };
}

/** The sentence under the range control. It names the days, because "7 days" hides an off-by-one. */
export function rangeLabel(range: DateRange): string {
  if (range.from === range.to) return range.from;
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1;
  return `${range.from} to ${range.to} · ${days} ${days === 1 ? 'day' : 'days'}`;
}

/* ── The roll-up ───────────────────────────────────────────────────────── */

export interface RangeBill {
  /** `YYYY-MM-DD` the bill was CLOSED on. A bill belongs to the day it was settled. */
  closedOn: string;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  /** What the restaurant earned. Excludes the tip. */
  restaurantIncome: number;
  covers: number;
}

export interface RangeExpense {
  spentOn: string;
  category: string;
  amount: number;
}

export interface RangeSummary {
  bills: number;
  covers: number;
  /** Sum of `restaurantIncome`. Tips are not in it, and the screen says so. */
  sales: number;
  discounts: number;
  tax: number;
  /** Collected on the restaurant's behalf and owed to the staff. Never income. */
  tips: number;
  purchases: number;
  /** Sales minus purchases. The figure the books are closed on. */
  net: number;
  averageBill: number;
  byCategory: Array<{ category: string; amount: number }>;
}

export function summarise(input: { bills: readonly RangeBill[]; expenses: readonly RangeExpense[] }): RangeSummary {
  const sales = input.bills.reduce((a, b) => a + b.restaurantIncome, 0);
  const purchases = input.expenses.reduce((a, e) => a + e.amount, 0);
  const covers = input.bills.reduce((a, b) => a + b.covers, 0);

  const byCategory = new Map<string, number>();
  input.expenses.forEach((e) => {
    const key = e.category || 'Uncategorised';
    byCategory.set(key, (byCategory.get(key) ?? 0) + e.amount);
  });

  return {
    bills: input.bills.length,
    covers,
    sales,
    discounts: input.bills.reduce((a, b) => a + b.discount, 0),
    tax: input.bills.reduce((a, b) => a + b.tax, 0),
    tips: input.bills.reduce((a, b) => a + b.tip, 0),
    purchases,
    net: sales - purchases,
    // Rounded, because an average is a summary figure and nobody reconciles against it. It is
    // the ONE rounded number here, and it is rounded once.
    averageBill: input.bills.length ? Math.round(sales / input.bills.length) : 0,
    byCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
