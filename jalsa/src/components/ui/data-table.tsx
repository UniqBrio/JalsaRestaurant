'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { SearchField } from './field';
import { Button } from './button';
import { NoMatchesState, FirstRunState } from './states';

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

  const sorted = React.useMemo(() => {
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
  }, [filtered, sort, columns]);

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
    a.download = `${exportName ?? testId}-${new Date().toISOString().slice(0, 10)}.csv`;
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
        <NoMatchesState query={query} onClear={() => setQuery('')} testId={`${testId}-nomatch`} />
      ) : (
        // Only the TABLE scrolls sideways, never the page (Standard 10.1).
        <div className="j-scroll-x rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[12.5px]">
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
                        'border-b border-[var(--border)] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]',
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
