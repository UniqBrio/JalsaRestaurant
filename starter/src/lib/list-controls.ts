/**
 * list-controls - the PURE logic behind the standard search / filter / sort every list and
 * table view carries (CP-23).
 *
 * WHY ONE SHARED IMPLEMENTATION
 *   A list that searches names but not phone numbers, a date filter whose "this week" starts
 *   on a different day than the one on the next screen, a sort that puts blanks first here and
 *   last there - each is small, and together they are why users stop trusting lists. One
 *   implementation, configured per module, gives every list the same behaviour and every
 *   user one thing to learn.
 *
 * THE RULES
 *   1. Search is one box across ALL the module's key fields (name, course, phone, email, ...).
 *      Matching is case-insensitive substring; values that look like phone numbers are
 *      compared digit-to-digit so "98765 43210", "9876543210" and "+91 98765-43210" match.
 *   2. Filters are multi-select per field (a record passes if its value is among the chosen).
 *      Date filters offer the standard presets - Today, This week, Last week, This month,
 *      plus Last month, All time and a Custom range - computed in LOCAL time, weeks starting
 *      Monday unless configured otherwise. Ranges are inclusive of both ends.
 *   3. Sort is stable, per column, ascending or descending; strings compare by locale, numbers
 *      and dates by value; blanks sort LAST in both directions so "missing" never pretends to
 *      be "smallest".
 *   4. Composition order is fixed: search -> filters -> sort. The count shown to the user is
 *      "matching / total", so a filtered-down list never reads as missing data.
 *
 * No React here: every branch is exported and unit-testable without a browser.
 */

export type Row = Record<string, unknown>;
export type SortDir = 'asc' | 'desc';

export type DatePreset =
  | 'all' | 'today' | 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

export const DATE_PRESETS: readonly DatePreset[] =
  ['all', 'today', 'this-week', 'last-week', 'this-month', 'last-month', 'custom'];

export const DATE_PRESET_LABELS: Readonly<Record<DatePreset, string>> = {
  all: 'All time',
  today: 'Today',
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  'last-month': 'Last month',
  custom: 'Custom',
};

export interface DateRange { from: Date; to: Date }

export interface DateFilterState {
  preset: DatePreset;
  /** Only read when preset === 'custom'. ISO date strings (yyyy-mm-dd) or Dates. */
  from?: string | Date;
  to?: string | Date;
}

export interface ListState {
  query: string;
  /** field -> chosen values. An absent field or an empty set means "no filter on this field". */
  filters: Readonly<Record<string, ReadonlySet<string>>>;
  date?: DateFilterState;
  sort?: { key: string; dir: SortDir };
}

export interface ListConfig {
  /** Fields the single search box looks in. */
  searchFields: readonly string[];
  /** The field the date filter applies to, if the data is dated. */
  dateField?: string;
  /** 0 = Sunday ... 1 = Monday (default). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export const emptyListState = (): ListState => ({ query: '', filters: {} });

// ---------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------

const DIGITS = /\d/g;
/** "Looks like a phone number": at least 5 digits and nothing alphabetic. */
const isPhoneLike = (s: string) => (s.match(DIGITS)?.length ?? 0) >= 5 && !/[a-z]/i.test(s);
const digitsOf = (s: string) => s.replace(/\D/g, '');

function fieldMatches(value: unknown, needle: string): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value);
  if (isPhoneLike(needle) && isPhoneLike(text)) return digitsOf(text).includes(digitsOf(needle));
  return text.toLowerCase().includes(needle);
}

export function searchRows<T extends Row>(rows: readonly T[], query: string, fields: readonly string[]): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((r) => fields.some((f) => fieldMatches(r[f], needle)));
}

// ---------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------

export function filterRows<T extends Row>(
  rows: readonly T[],
  filters: Readonly<Record<string, ReadonlySet<string>>>,
): T[] {
  const active = Object.entries(filters).filter(([, set]) => set.size > 0);
  if (active.length === 0) return [...rows];
  return rows.filter((r) => active.every(([field, set]) => set.has(String(r[field] ?? ''))));
}

export function toggleFilterValue(
  filters: Readonly<Record<string, ReadonlySet<string>>>,
  field: string,
  value: string,
): Record<string, ReadonlySet<string>> {
  const next = new Set(filters[field] ?? []);
  next.has(value) ? next.delete(value) : next.add(value);
  return { ...filters, [field]: next };
}

// ---------------------------------------------------------------------------------------
// Date presets - local time, inclusive ends
// ---------------------------------------------------------------------------------------

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function startOfWeek(now: Date, weekStartsOn: number): Date {
  const diff = (now.getDay() - weekStartsOn + 7) % 7;
  return startOfDay(addDays(now, -diff));
}

function toDate(v: string | Date | undefined, fallback: Date): Date {
  if (v === undefined || v === '') return fallback;
  if (v instanceof Date) return v;
  // yyyy-mm-dd is parsed as UTC by the Date constructor; build a LOCAL date instead so the
  // day the user picked is the day the range covers.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(v);
}

/** null means "no date constraint" (preset 'all', or a custom range with neither end). */
export function resolveDateRange(state: DateFilterState, now: Date, weekStartsOn = 1): DateRange | null {
  switch (state.preset) {
    case 'all': return null;
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'this-week': {
      const from = startOfWeek(now, weekStartsOn);
      return { from, to: endOfDay(addDays(from, 6)) };
    }
    case 'last-week': {
      const thisStart = startOfWeek(now, weekStartsOn);
      const from = addDays(thisStart, -7);
      return { from, to: endOfDay(addDays(from, 6)) };
    }
    case 'this-month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    case 'last-month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from, to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
    }
    case 'custom': {
      if (!state.from && !state.to) return null;
      const from = startOfDay(toDate(state.from, new Date(0)));
      const to = endOfDay(toDate(state.to, new Date(8640000000000000)));
      return { from, to };
    }
  }
}

export function inDateRange(value: unknown, range: DateRange | null): boolean {
  if (!range) return true;
  if (value === null || value === undefined || value === '') return false;
  const t = (value instanceof Date ? value : new Date(String(value))).getTime();
  if (Number.isNaN(t)) return false;
  return t >= range.from.getTime() && t <= range.to.getTime();
}

// ---------------------------------------------------------------------------------------
// Sort - stable, blanks last in both directions
// ---------------------------------------------------------------------------------------

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

function compareValues(a: unknown, b: unknown): number {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a as Date).getTime() - new Date(b as Date).getTime();
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows<T extends Row>(rows: readonly T[], key: string, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      const a = x.row[key], b = y.row[key];
      const ab = isBlank(a), bb = isBlank(b);
      if (ab && bb) return x.i - y.i;
      if (ab) return 1;          // blanks last, regardless of direction
      if (bb) return -1;
      const c = compareValues(a, b) * sign;
      return c !== 0 ? c : x.i - y.i; // stable
    })
    .map(({ row }) => row);
}

/** Click-the-header behaviour: none -> asc -> desc -> asc ... ; a new column starts asc. */
export function toggleSort(current: ListState['sort'], key: string): { key: string; dir: SortDir } {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
}

// ---------------------------------------------------------------------------------------
// Composition: search -> filters -> date -> sort
// ---------------------------------------------------------------------------------------

export function applyListControls<T extends Row>(
  rows: readonly T[],
  state: ListState,
  config: ListConfig,
  now: Date = new Date(),
): { rows: T[]; matching: number; total: number } {
  let out = searchRows(rows, state.query, config.searchFields);
  out = filterRows(out, state.filters);
  if (config.dateField && state.date) {
    const range = resolveDateRange(state.date, now, config.weekStartsOn ?? 1);
    const field = config.dateField;
    out = out.filter((r) => inDateRange(r[field], range));
  }
  if (state.sort) out = sortRows(out, state.sort.key, state.sort.dir);
  return { rows: out, matching: out.length, total: rows.length };
}
