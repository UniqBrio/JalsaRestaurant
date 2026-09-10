/**
 * analytics unit spec - the branches behind CP-24 (metrics, formatting, dashboard resolution).
 *
 * FAIL-FIRST EVIDENCE (06-Sep-2026): every assertion below was executed against the
 * esbuild-compiled ACTUAL libs. The role-visibility assertion was OBSERVED FAILING and caught a
 * real defect - the academy example gated the fee SECTION but not the fee METRICS, so an
 * instructor's resolved config still contained them. The config was fixed, not the assertion.
 */
import { test, expect } from '@playwright/test';
import { formatCompact, formatValue } from '../../src/lib/analytics/format';
import {
  aggregate, buildResult, computeMetric, directionOf, growth, statusOf, targetProgress,
  type MetricDefinition,
} from '../../src/lib/analytics/metrics';
import {
  breakdownPath, drillFilters, drillInto, drillUpTo, nextDimension, resolveDashboard,
  type DashboardConfig,
  type DrillState,
} from '../../src/lib/analytics/dashboard';
import { academyDashboard, exampleDashboards } from '../../src/lib/analytics/examples';

test('an absent value never renders as zero', () => {
  expect(formatValue(null, 'currency')).toBe('—');
  expect(formatValue(NaN, 'number')).toBe('—');
  expect(formatValue('not-a-date', 'date')).toBe('—');
  expect(formatValue(0, 'count')).toBe('0'); // a real zero is still zero
});

test('compact formatting follows the configured convention, both ladders', () => {
  expect(formatCompact(245000, { compactStyle: 'in' })).toBe('2.45L');
  expect(formatCompact(120000000, { compactStyle: 'in' })).toBe('12Cr');
  expect(formatCompact(-245000, { compactStyle: 'in' })).toBe('-2.45L');
  expect(formatCompact(2450000, { compactStyle: 'intl' })).toBe('2.45M');
  expect(formatValue(18.42, 'percent', { decimals: 1, signed: true })).toBe('+18.4%');
  expect(formatValue(80, 'duration')).toBe('1h 20m');
});

test('aggregations ignore blanks and refuse impossible denominators', () => {
  const rows = [{ a: 100, c: 'x' }, { a: 250, c: 'y' }, { a: null, c: 'x' }, { a: 50, c: '' }];
  expect(aggregate(rows, 'sum', 'a')).toBe(400);
  expect(aggregate(rows, 'avg', 'a')).toBe(400 / 3); // divides by present values, not row count
  expect(aggregate(rows, 'distinct', 'c')).toBe(2);  // blank excluded
  expect(aggregate([], 'sum', 'a')).toBeNull();      // no rows = no value, not 0
  expect(aggregate([{ p: 1, s: 0 }], 'percentage', 'p', 's')).toBeNull(); // never Infinity
});

test('growth from zero is undefined, and direction is never sentiment', () => {
  expect(growth(118, 100)).toBe(0.18);
  expect(growth(100, 0)).toBeNull();
  expect(directionOf(0.0001)).toBe('flat');
  expect(statusOf('up', true)).toBe('good');   // revenue up
  expect(statusOf('up', false)).toBe('bad');   // expenses up
  expect(statusOf('down', false)).toBe('good'); // churn down
  expect(targetProgress(100, 0)).toBeNull();
});

test('buildResult reports an unknown comparison as unknown, not neutral', () => {
  const expenses: MetricDefinition = { id: 'e', label: 'Expenses', dataSource: 'x', aggregation: 'sum', higherIsBetter: false };
  expect(buildResult(expenses, 120, 100).status).toBe('bad');
  const revenue: MetricDefinition = { id: 'r', label: 'Revenue', dataSource: 'x', aggregation: 'sum' };
  expect(buildResult(revenue, 100, 0).status).toBe('unknown');
  expect(computeMetric(revenue, [{ amount: 1 }], [{ amount: 1 }]).value).toBe(null); // no `field` -> no value
});

const cfg: DashboardConfig = {
  id: 'd', title: 'T',
  metrics: [
    { id: 'm1', label: 'Owner only', dataSource: 'x', aggregation: 'count', visibleTo: ['owner'] },
    { id: 'm2', label: 'Everyone', dataSource: 'x', aggregation: 'count' },
  ],
  sections: [
    { id: 's1', kind: 'metrics', items: ['m1', 'm2'], order: 2 },
    { id: 's2', kind: 'metrics', items: ['m1'], order: 1 },
  ],
};

test('a restricted metric is REMOVED from the resolved config, not hidden in it', () => {
  const staff = resolveDashboard(cfg, 'staff');
  expect(staff.metrics.map((m) => m.id)).toEqual(['m2']);
  expect(staff.sections.map((s) => s.id)).toEqual(['s1']); // s2 emptied -> dropped
  expect(staff.sections[0]!.items).toEqual(['m2']);
  expect(resolveDashboard(cfg, 'owner').sections.map((s) => s.id)).toEqual(['s2', 's1']); // ordered
});

test('drill-down walks its ladder and stops honestly at the end', () => {
  const c: DashboardConfig = { ...cfg, defaultBreakdown: ['a', 'b'],
    metrics: [{ id: 'm1', label: 'x', dataSource: 'x', aggregation: 'count', breakdown: ['course', 'student'] }] };
  let s: DrillState = { metricId: 'm1', crumbs: [] };
  expect(nextDimension(c, s)).toBe('course');
  s = drillInto(s, 'course', 'c1', 'Piano');
  s = drillInto(s, 'student', 's9', 'Asha');
  expect(nextDimension(c, s)).toBeNull();
  expect(drillFilters(s)).toEqual({ course: 'c1', student: 's9' });
  expect(drillUpTo(s, -1).crumbs).toHaveLength(0);
  expect(breakdownPath(c, 'unknown-metric')).toEqual(['a', 'b']); // falls back to the default
});

test('every example dashboard is internally consistent', () => {
  for (const [name, dash] of Object.entries(exampleDashboards)) {
    for (const s of dash.sections) {
      if (s.kind === 'metrics') {
        for (const id of s.items ?? []) {
          expect(dash.metrics.some((m) => m.id === id), `${name}/${s.id} -> ${id}`).toBe(true);
        }
      } else {
        expect(s.question, `${name}/${s.id} must state the question it answers`).toBeTruthy();
      }
    }
    for (const m of dash.metrics) {
      if (/outstanding|cancel|pending|expiring|unpaid|due/i.test(m.label)) {
        expect(m.higherIsBetter, `${name}/${m.id} is a cost-like metric`).toBe(false);
      }
    }
  }
});

test('role scoping holds for the academy example: money is removed, teaching stays', () => {
  const ids = resolveDashboard(academyDashboard, 'instructor').metrics.map((m) => m.id);
  expect(ids).not.toContain('fees_collected');
  expect(ids).not.toContain('fees_outstanding');
  expect(ids).toContain('attendance_rate');
});
