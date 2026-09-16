/**
 * analytics/metrics - the metric definition model and its calculation (CP-24).
 *
 * CALCULATION IS SEPARATE FROM PRESENTATION, ON PURPOSE
 *   Everything here is pure: rows in, numbers out. Components render what this returns and
 *   compute nothing. That is what lets the same metric be computed in the browser for 40 rows
 *   and delegated to the database for 400,000 - only `resolve` changes, never the definition.
 *
 * TWO RULES THAT KEEP A DASHBOARD HONEST
 *
 *   1. DIRECTION IS NOT SENTIMENT. Revenue up is good; expenses up, churn up, cancellations up
 *      are not. `higherIsBetter` (default true) is what separates the arrow from the judgement,
 *      and a dashboard that colours every rise green is actively misleading on half its tiles.
 *
 *   2. GROWTH FROM ZERO IS UNDEFINED, NOT INFINITE. With no prior period there is no percentage
 *      to state; `growth()` returns null and the UI says "no prior period". Rendering "+∞%" or
 *      silently "+100%" invents a fact the data does not contain.
 */
import type { FormatKind, FormatOptions } from './format';

export type Row = Record<string, unknown>;

export type Aggregation =
  | 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct' | 'ratio' | 'percentage';

export type MetricPriority = 'primary' | 'secondary' | 'detail';
export type TrendDirection = 'up' | 'down' | 'flat';
/** What the movement MEANS, once higherIsBetter is applied. Never inferred from direction. */
export type MetricStatus = 'good' | 'bad' | 'neutral' | 'unknown';

export interface MetricDefinition {
  id: string;
  label: string;
  description?: string;
  /** The entity/collection this reads. The app's data layer resolves it; this module never fetches. */
  dataSource: string;
  aggregation: Aggregation;
  /** Field to aggregate. Omitted for 'count'. For 'ratio'/'percentage', the numerator field. */
  field?: string;
  /** Denominator field for 'ratio' / 'percentage' (e.g. attended / scheduled). */
  denominatorField?: string;
  format?: FormatKind;
  formatOptions?: FormatOptions;
  unit?: string;
  /** Default true. False for expenses, churn, cancellations, outstanding amounts. */
  higherIsBetter?: boolean;
  comparisonPeriod?: 'previous_period' | 'previous_year' | 'none';
  target?: number;
  priority?: MetricPriority;
  visualization?: 'none' | 'sparkline' | 'progress' | 'comparison';
  /** Ordered drill-down path: ['course', 'student', 'transaction']. */
  breakdown?: readonly string[];
  /** Roles that may see this metric. Absent = visible to every role (deny nothing by default). */
  visibleTo?: readonly string[];
  actions?: readonly { id: string; label: string }[];
}

export interface MetricResult {
  id: string;
  value: number | null;
  previous?: number | null;
  /** Fractional change (0.18 = +18%), or null when there is no prior period to compare against. */
  growth: number | null;
  direction: TrendDirection;
  status: MetricStatus;
  /** 0..n fraction of target achieved, or null when no target is set. */
  targetProgress: number | null;
  series?: readonly number[];
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Sum / avg / min / max ignore blanks rather than treating them as zero (see honest-zero). */
export function aggregate(rows: readonly Row[], agg: Aggregation, field?: string, denominatorField?: string): number | null {
  if (agg === 'count') return rows.length;
  if (agg === 'distinct') {
    if (!field) return null;
    return new Set(rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined && v !== '')).size;
  }
  if (agg === 'ratio' || agg === 'percentage') {
    if (!field || !denominatorField) return null;
    const n = rows.reduce<number>((a, r) => a + (num(r[field]) ?? 0), 0);
    const d = rows.reduce<number>((a, r) => a + (num(r[denominatorField]) ?? 0), 0);
    if (d === 0) return null; // no denominator = no rate, not zero
    return agg === 'percentage' ? (n / d) * 100 : n / d;
  }
  if (!field) return null;
  const values = rows.map((r) => num(r[field])).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  switch (agg) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return null;
  }
}

/** Fractional growth, or null when it cannot honestly be stated. */
export function growth(current: number | null, previous: number | null | undefined): number | null {
  if (current === null || previous === null || previous === undefined) return null;
  if (previous === 0) return null; // undefined, not infinite
  return (current - previous) / Math.abs(previous);
}

export function directionOf(g: number | null, epsilon = 0.0005): TrendDirection {
  if (g === null || Math.abs(g) < epsilon) return 'flat';
  return g > 0 ? 'up' : 'down';
}

export function statusOf(direction: TrendDirection, higherIsBetter = true): MetricStatus {
  if (direction === 'flat') return 'neutral';
  const rising = direction === 'up';
  return rising === higherIsBetter ? 'good' : 'bad';
}

export function targetProgress(value: number | null, target?: number): number | null {
  if (value === null || target === undefined || target === 0) return null;
  return value / target;
}

/**
 * Assemble a result from values the app's data layer has already produced. Deliberately takes
 * numbers rather than rows as well, so a server-side aggregate needs no browser rows at all.
 */
export function buildResult(
  def: MetricDefinition,
  value: number | null,
  previous?: number | null,
  series?: readonly number[],
): MetricResult {
  const g = def.comparisonPeriod === 'none' ? null : growth(value, previous);
  const direction = directionOf(g);
  return {
    id: def.id,
    value,
    previous: previous ?? null,
    growth: g,
    direction,
    status: g === null ? 'unknown' : statusOf(direction, def.higherIsBetter ?? true),
    targetProgress: targetProgress(value, def.target),
    ...(series !== undefined ? { series } : {}),
  };
}

/** Browser-side convenience for small datasets; large ones aggregate at the source. */
export function computeMetric(
  def: MetricDefinition,
  rows: readonly Row[],
  previousRows?: readonly Row[],
  series?: readonly number[],
): MetricResult {
  const value = aggregate(rows, def.aggregation, def.field, def.denominatorField);
  const previous = previousRows
    ? aggregate(previousRows, def.aggregation, def.field, def.denominatorField)
    : undefined;
  return buildResult(def, value, previous, series);
}
