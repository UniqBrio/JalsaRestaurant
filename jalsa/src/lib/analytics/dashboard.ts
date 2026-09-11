/**
 * analytics/dashboard - the dashboard configuration model (CP-24).
 *
 * THE WHOLE POINT: A DASHBOARD IS DATA, NOT CODE
 *   A restaurant, a gym, a badminton court and an arts academy differ in their metrics, filters
 *   and breakdowns - not in their dashboard. So the components are business-agnostic and the
 *   business ships a config object. Adding a domain must never mean editing a component; if it
 *   does, the config model is missing a field and that is the defect to fix.
 *
 * ROLE VISIBILITY IS RESOLVED HERE, NOT RENDERED AWAY
 *   `resolveDashboard` REMOVES what a role may not see, so a hidden metric is never computed,
 *   never fetched, and never present in the DOM. Hiding with CSS leaves the number in the page
 *   for anyone who opens the inspector - that is a permission bug wearing a stylesheet.
 *   Absent `visibleTo` means visible to all: analytics is a read of the user's OWN data, and
 *   deny-by-default here would blank the dashboard the moment someone adds a role.
 *   (Row-level access is the data layer's job - RLS - never this file's.)
 */
import type { MetricDefinition } from './metrics';
import type { FormatOptions } from './format';

export type SectionKind = 'metrics' | 'chart' | 'table' | 'insights' | 'activity';

export interface DashboardSection {
  id: string;
  kind: SectionKind;
  title?: string;
  /** Metric ids (kind 'metrics'), or an opaque key the host resolves for other kinds. */
  items?: readonly string[];
  /** The question this section answers. If it cannot be written, the section is decoration. */
  question?: string;
  visibleTo?: readonly string[];
  /** Lower sorts first. Sections without an order keep their declared position. */
  order?: number;
}

export interface FilterDefinition {
  field: string;
  label: string;
  kind: 'select' | 'multiselect' | 'date';
  options?: readonly { value: string; label: string }[];
}

export interface DashboardConfig {
  id: string;
  title: string;
  subtitle?: string;
  formatDefaults?: FormatOptions;
  metrics: readonly MetricDefinition[];
  filters?: readonly FilterDefinition[];
  sections: readonly DashboardSection[];
  /** Ordered breakdown ladder used when a metric declares none of its own. */
  defaultBreakdown?: readonly string[];
}

const visible = (visibleTo: readonly string[] | undefined, role: string | undefined): boolean =>
  !visibleTo || visibleTo.length === 0 || (role !== undefined && visibleTo.includes(role));

/**
 * The config this role actually gets: metrics and sections they may not see are removed, and
 * sections left with no visible items are dropped rather than rendered empty (an empty section
 * reads as broken data, not as a permission boundary).
 */
export function resolveDashboard(config: DashboardConfig, role?: string): DashboardConfig {
  const metrics = config.metrics.filter((m) => visible(m.visibleTo, role));
  const allowed = new Set(metrics.map((m) => m.id));
  const sections = config.sections
    .filter((s) => visible(s.visibleTo, role))
    .map((s) => (s.kind === 'metrics' && s.items ? { ...s, items: s.items.filter((id) => allowed.has(id)) } : s))
    .filter((s) => !(s.kind === 'metrics' && (s.items?.length ?? 0) === 0))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  return { ...config, metrics, sections };
}

export const metricById = (config: DashboardConfig, id: string): MetricDefinition | undefined =>
  config.metrics.find((m) => m.id === id);

/** The breakdown ladder for a metric: its own, else the dashboard default, else empty. */
export function breakdownPath(config: DashboardConfig, metricId: string): readonly string[] {
  return metricById(config, metricId)?.breakdown ?? config.defaultBreakdown ?? [];
}

export interface DrillState {
  metricId: string;
  /** One entry per level already chosen: { dimension, value, label }. */
  crumbs: readonly { dimension: string; value: string; label: string }[];
}

/** The dimension to break down by next, or null at the end of the ladder. */
export function nextDimension(config: DashboardConfig, state: DrillState): string | null {
  const path = breakdownPath(config, state.metricId);
  return path[state.crumbs.length] ?? null;
}

export function drillInto(state: DrillState, dimension: string, value: string, label: string): DrillState {
  return { ...state, crumbs: [...state.crumbs, { dimension, value, label }] };
}

/** Step back to a level; -1 returns to the top. Never mutates. */
export function drillUpTo(state: DrillState, level: number): DrillState {
  return { ...state, crumbs: state.crumbs.slice(0, Math.max(0, level + 1)) };
}

/** Crumbs as filters the data layer can apply: { dimension: value }. */
export function drillFilters(state: DrillState): Record<string, string> {
  return Object.fromEntries(state.crumbs.map((c) => [c.dimension, c.value]));
}
