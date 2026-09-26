import { summarise, type RangeBill, type RangeExpense } from './report-range';
import { shiftDay, shortDayLabel } from './restaurant-time';

/**
 * Sales per day over a report range - the series behind the "Sales by day" chart (item 39,
 * 25-Sep-2026).
 *
 * Every day of the range is present, a day with no bill at zero, so the chart's gaps are real
 * gaps and not missing bars. Each day's figure is `summarise` over that day's bills - the same
 * function, the same definition of Sales (tips out) as the headline tile - so the bars add up to
 * the Sales figure above them, by construction.
 */
export interface DailyPoint {
  day: string;
  label: string;
  sales: number;
  bills: number;
}

/** Ranges longer than this are drawn for their first days only, and the screen says so. */
export const MAX_DAILY_POINTS = 92;

export function dailySeries(
  from: string,
  to: string,
  bills: readonly RangeBill[],
  expenses: readonly RangeExpense[] = []
): DailyPoint[] {
  const out: DailyPoint[] = [];
  if (!from || !to || from > to) return out;
  for (let day = from, i = 0; day <= to && i < MAX_DAILY_POINTS; day = shiftDay(day, 1), i += 1) {
    const s = summarise({
      bills: bills.filter((b) => b.closedOn === day),
      expenses: expenses.filter((e) => e.spentOn === day),
    });
    out.push({ day, label: shortDayLabel(day), sales: s.sales, bills: s.bills });
  }
  return out;
}

/** Whether a range is longer than the chart draws - so the screen can say it shows only part. */
export function dailyTruncated(from: string, to: string): boolean {
  if (!from || !to || from > to) return false;
  let day = from;
  for (let i = 0; i < MAX_DAILY_POINTS; i += 1) {
    if (day === to) return false;
    day = shiftDay(day, 1);
  }
  return true;
}
