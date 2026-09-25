'use client';

import * as React from 'react';
import { todayIn } from '@/lib/restaurant-time';
import { cn } from '@/lib/cn';
import { SearchField } from './field';
import { Button } from './button';
import { NoMatchesState, FirstRunState } from './states';
import { ColumnFilterControl, OptionsFilterBody, RangeFilterBody, TextFilterBody } from './column-filter';
import {
  activeColumnFilterCount,
  applyColumnFilters,
  clearColumnFilter,
  type ColumnFilter,
  type ColumnFilters,
} from '@/lib/list-controls';

/**
 * data-table — the ONE table on the owner's surface (Standard 10.4).
 *
 * It is parameterised rather than duplicated because the four obligations it carries are
 * obligations of EVERY table, and a second table is a second place to forget one:
 *
 *   4.1  Columns sort, and the active column and direction are VISIBLE. Hidden sort state
 *        makes people doubt what they are reading.
 *   4.2  One search box across every meaningful field, with a live result count and a Clear —
 *        because users search for the fragment they remember, not the field it lives in.
 *   4.3  Every screen presenting figures exports what is ON SCREEN, filters and all. Without
 *        it people screenshot or re-key, and the numbers stop matching.
 *   5.2  "Nothing yet" and "nothing found" are different states with different actions.
 *
 * The export is a client-side CSV of the CURRENT rows. That is the whole point: an export that
 * silently returns everything, ignoring the filter the user just set, is worse than none —
 * they will reconcile against it.
 */

export interface Column<Row> {
  key: string;
  header: string;
  /** The cell. Anything React can render. */
  cell: (row: Row) => React.ReactNode;
  /** The value sorting and searching use. Absent means the column does neither. */
  value?: (row: Row) => string | number;
  align?: 'left' | 'right';
  /** Hidden below `sm`. Use for columns that are useful but never the answer someone came for. */
  secondary?: boolean;
  /**
   * A filter control in THIS column's header. Absent means the column does not filter.
   *
   * Declared per column rather than switched on for the whole table, because the useful filter
   * differs by what the column holds: a name wants "contains", a category wants a closed list, a
   * price wants two ends. A table that filtered every column the same way would offer a text box
   * for Available, which is worse than offering nothing.
   *
   * `options` is derived from the rows on screen, so a category with nothing in it never offers
   * a filter that returns an empty table.
   */
  filter?:
    { kind: 'text'; placeholder?: string } | { kind: 'options'; order?: readonly string[] } | { kind: 'range' };
}

export interface DataTableProps<Row> {
  rows: readonly Row[];
  columns: ReadonlyArray<Column<Row>>;
  rowKey: (row: Row) => string;
  /** The column sorted on first load. The most useful order is the default, never insertion order. */
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  searchPlaceholder?: string;
  /** Shown when the underlying list is genuinely empty. */
  emptyTitle: string;
  emptyNote: string;
  exportName?: string;
  onRowClick?: (row: Row) => void;
  testId: string;
  toolbarExtra?: React.ReactNode;
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  defaultSort,
  searchPlaceholder = 'Search every column',
  emptyTitle,
  emptyNote,
  exportName,
  onRowClick,
  testId,
  toolbarExtra,
}: DataTableProps<Row>) {
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<{ key: string; direction: 'asc' | 'desc' } | null>(defaultSort ?? null);
  /* One entry per narrowed column. Independent of each other and of the sort — the two are
     deliberately different mechanisms on the same header. */
  const [colFilters, setColFilters] = React.useState<ColumnFilters>({});

  const searchable = React.useMemo(() => columns.filter((c) => c.value), [columns]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...rows];
    return rows.filter((row) =>
      searchable.some((c) =>
        String(c.value?.(row) ?? '')
          .toLowerCase()
          .includes(q)
      )
    );
  }, [rows, query, searchable]);

  /* Search first, then the columns, then sort. Columns are ANDed with each other and with the
     search box: "biryani" + Type = Non-veg narrows twice, which is what combinable means. */
  const narrowed = React.useMemo(
    () =>
      applyColumnFilters<Row>(filtered, colFilters, (row: Row, key: string) => {
        const col = columns.find((c) => c.key === key);
        return col?.value?.(row);
      }),
    [filtered, colFilters, columns]
  );

  const activeFilters = activeColumnFilterCount(colFilters);

  const clearEverything = () => {
    // "Restore the full Menu list" — so the search box goes too. A box still holding text while
    // the list ignores it is worse than either half on its own.
    setColFilters({});
    setQuery('');
  };

  const sorted = React.useMemo(() => {
    const filtered = narrowed;
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.value) return filtered;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.value!(a);
      const bv = col.value!(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), 'en') * dir;
    });
  }, [narrowed, sort, columns]);

  /** The right dropdown for the shape of the column. See Column.filter for why it varies. */
  const filterBody = (c: Column<Row>): React.ReactNode => {
    if (!c.filter) return null;
    const current = colFilters[c.key];
    const set = (next: ColumnFilter) => setColFilters((cur) => ({ ...cur, [c.key]: next }));
    const bodyTestId = `${testId}-filter-${c.key}`;

    if (c.filter.kind === 'text') {
      return (
        <TextFilterBody
          value={current?.kind === 'text' ? current.text : ''}
          placeholder={c.filter.placeholder ?? `Filter ${c.header.toLowerCase()}`}
          onChange={(text) => set({ kind: 'text', text })}
          testId={bodyTestId}
        />
      );
    }

    if (c.filter.kind === 'range') {
      const r = current?.kind === 'range' ? current : undefined;
      return (
        <RangeFilterBody
          min={r?.min}
          max={r?.max}
          onChange={(next) => set({ kind: 'range', ...next })}
          testId={bodyTestId}
        />
      );
    }

    /* Built from the rows ACTUALLY in the table — not a list typed at the call site. A category
       the owner adds tonight is in the dropdown tonight, and one with nothing in it never offers
       a filter that returns an empty screen. */
    const seen = new Set<string>();
    for (const row of rows) {
      const v = c.value?.(row);
      if (v !== undefined && String(v) !== '') seen.add(String(v));
    }
    const order = c.filter.order;
    const options = order ? order.filter((o) => seen.has(o)) : [...seen].sort((a, b) => a.localeCompare(b, 'en'));

    return (
      <OptionsFilterBody
        options={options}
        chosen={current?.kind === 'options' ? current.values : []}
        onChange={(values) => set({ kind: 'options', values })}
        testId={bodyTestId}
      />
    );
  };

  const toggleSort = (key: string) => {
    setSort((cur) =>
      cur?.key === key ? { key, direction: cur.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
    );
  };

  const exportCsv = () => {
    const header = columns.map((c) => c.header);
    const body = sorted.map((row) => columns.map((c) => String(c.value?.(row) ?? '')));
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName ?? testId}-${todayIn()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={searchPlaceholder}
          resultCount={filtered.length}
          testId={`${testId}-search`}
          className="min-w-[14rem] flex-1"
        />
        {/* Only when something is actually narrowed. A permanent "Clear all" on an unfiltered
            table is a control that does nothing, sitting where the eye goes first. */}
        {activeFilters > 0 ? (
          <span className="flex items-center gap-2">
            <span
              data-testid={`${testId}-filter-count`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-surface)] px-2.5 py-1 type-caption font-semibold text-[var(--on-primary-surface)]"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden
              >
                <path d="M3 5h18l-7 8v6l-4 2v-8z" />
              </svg>
              {activeFilters}
              <span className="sr-only">{activeFilters === 1 ? 'column filtered' : 'columns filtered'}</span>
            </span>
            <Button data-testid={`${testId}-clear-filters`} variant="ghost" size="sm" onClick={clearEverything}>
              Clear all
            </Button>
          </span>
        ) : null}
        {toolbarExtra}
        {exportName ? (
          <Button data-testid={`${testId}-export`} variant="secondary" size="sm" onClick={exportCsv}>
            Export {sorted.length === 1 ? '1 row' : `${sorted.length} rows`}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <FirstRunState title={emptyTitle} note={emptyNote} testId={`${testId}-empty`} />
      ) : sorted.length === 0 ? (
        // Clearing from here drops the column filters as well. Offering "clear the search" on a
        // table that is empty because of a COLUMN filter is a button that does not fix it.
        <NoMatchesState query={query} onClear={clearEverything} testId={`${testId}-nomatch`} />
      ) : (
        // Only the TABLE scrolls sideways, never the page (Standard 10.1).
        <div className="j-scroll-x rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse type-caption">
            <thead>
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={cn(
                        'border-b border-[var(--border)] px-3 py-2.5 type-eyebrow tracking-[0.07em] text-[var(--text-muted)]',
                        // The header stays while the rows move. A 57-row menu scrolls its
                        // column names off the top within one flick, and after that every
                        // figure in the Amount column is an unlabelled number. The background
                        // is explicit because a sticky cell paints over the rows sliding
                        // beneath it and would otherwise be transparent.
                        'sticky top-0 z-10 bg-[var(--surface)]',
                        c.align === 'right' ? 'text-right' : 'text-left',
                        c.secondary && 'hidden sm:table-cell'
                      )}
                    >
                      {c.value ? (
                        <button
                          data-testid={`${testId}-sort-${c.key}`}
                          type="button"
                          onClick={() => toggleSort(c.key)}

                          className="inline-flex items-center gap-1 rounded-sm font-bold uppercase tracking-[0.07em] transition-colors hover:text-[var(--text-body)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                        >
                          {c.header}
                          <span aria-hidden className={cn(active ? 'text-[var(--primary)]' : 'opacity-30')}>
                            {active ? (sort.direction === 'asc' ? '▲' : '▼') : '▲'}
                          </span>
                        </button>
                      ) : (
                        c.header
                      )}
                      {c.filter ? (
                        <ColumnFilterControl
                          label={c.header}
                          filter={colFilters[c.key]}
                          onChange={(next) => setColFilters((cur) => ({ ...cur, [c.key]: next }))}
                          onClear={() => setColFilters((cur) => clearColumnFilter(cur, c.key))}
                          testId={`${testId}-filter-${c.key}`}
                        >
                          {filterBody(c)}
                        </ColumnFilterControl>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-[var(--border)] last:border-0',
                    onRowClick && 'cursor-pointer transition-colors hover:bg-[var(--surface-sunken)]'
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-3 py-2.5 align-top leading-snug',
                        c.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                        c.secondary && 'hidden sm:table-cell'
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
