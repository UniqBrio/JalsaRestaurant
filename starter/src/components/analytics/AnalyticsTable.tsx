'use client';
/**
 * AnalyticsTable - the exact-values surface beneath every chart, and the drill-down destination.
 *
 * IT DOES NOT REINVENT SEARCH, FILTERS OR SORT
 *   Those are CP-23, and they already exist as `useListControls` + `ListControls`. This composes
 *   them. A second search box with slightly different behaviour is precisely the inconsistency
 *   CP-23 was written to end, and building one here would be the framework violating its own
 *   first rule inside its own component library.
 *
 * MOBILE IS A DIFFERENT LAYOUT, NOT A SMALLER TABLE
 *   Below the breakpoint each row renders as a card built from the PRIORITY columns; the rest
 *   move into an expandable detail. Squeezing eight columns into 360px produces a table that is
 *   technically responsive and practically unreadable, which is how horizontal scroll becomes
 *   every mobile user's permanent state.
 *
 * FORMATTING IS DECLARED, NEVER INLINE
 *   Each column names its format, so currency, percentage and date look identical here and on
 *   every tile above. A column that formats itself is a column that drifts.
 */
import React, { useState } from 'react';
import { formatValue, type FormatKind, type FormatOptions } from '../../lib/analytics/format';
import { useListControls } from '../../hooks/useListControls';
import { ListControls, type FilterGroup, type SortableColumn } from '../ListControls';
import type { ListConfig, Row } from '../../lib/list-controls';

export interface TableColumn {
  key: string;
  label: string;
  format?: FormatKind;
  formatOptions?: FormatOptions;
  /** Shown on the mobile card face. Everything else goes behind "More". */
  priority?: boolean;
  align?: 'start' | 'end';
}

export function AnalyticsTable<T extends Row>({
  rows,
  columns,
  listConfig,
  filters = [],
  rowId = (r: T) => String((r as Row).id ?? ''),
  onRowAction,
  rowActionLabel = 'View',
  loading = false,
  error,
  emptyMessage = 'No records match these filters.',
  testId = 'atable',
}: {
  rows: readonly T[];
  columns: readonly TableColumn[];
  listConfig: ListConfig;
  filters?: FilterGroup[];
  rowId?: (row: T) => string;
  /** Present = each row offers the drill-down into its next level. */
  onRowAction?: (row: T) => void;
  rowActionLabel?: string;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  testId?: string;
}) {
  const list = useListControls(rows, listConfig);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const sortable: SortableColumn[] = columns.map((c) => ({ key: c.key, label: c.label }));
  const priority = columns.filter((c) => c.priority);
  const secondary = columns.filter((c) => !c.priority);

  const cell = (row: T, col: TableColumn) =>
    formatValue((row as Row)[col.key], col.format ?? 'number', col.formatOptions);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  if (error) {
    return <p className="atable__error" data-testid={`${testId}-error`}>{error}</p>;
  }

  return (
    <div className="atable" data-testid={testId}>
      <ListControls
        state={list.state}
        matching={list.result.matching}
        total={list.result.total}
        onQuery={list.setQuery}
        onToggleFilter={list.toggleFilter}
        onDate={list.setDate}
        onSort={list.sortBy}
        onClear={list.clearAll}
        filters={filters}
        sortable={sortable}
        testId={`${testId}-controls`}
      />

      {loading ? (
        <p className="atable__loading" aria-busy="true" data-testid={`${testId}-loading`}>Loading…</p>
      ) : list.result.rows.length === 0 ? (
        <p className="atable__empty" data-testid={`${testId}-empty`}>{emptyMessage}</p>
      ) : (
        <>
          {/* Wide layout: a real table, scrolling inside its own container if it must. */}
          <div className="atable__scroll">
            <table className="atable__table">
              <thead>
                <tr>
                  {columns.map((c) => <th key={c.key} scope="col" className={`atable__th atable__th--${c.align ?? 'start'}`}>{c.label}</th>)}
                  {onRowAction && <th scope="col" className="atable__th"><span className="atable__sr">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {list.result.rows.map((row) => {
                  const id = rowId(row);
                  return (
                    <tr key={id} className="atable__tr" data-testid={`${testId}-row-${id}`}>
                      {columns.map((c) => (
                        <td key={c.key} className={`atable__td atable__td--${c.align ?? 'start'}`}>{cell(row, c)}</td>
                      ))}
                      {onRowAction && (
                        <td className="atable__td atable__td--end">
                          <button
                            type="button"
                            className="atable__action"
                            data-testid={`${testId}-action-${id}`}
                            onClick={() => onRowAction(row)}
                          >
                            {rowActionLabel}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Narrow layout: cards built from the priority columns, detail on demand. */}
          <ul className="atable__cards">
            {list.result.rows.map((row) => {
              const id = rowId(row);
              const open = expanded.has(id);
              return (
                <li key={id} className="atable__card" data-testid={`${testId}-card-${id}`}>
                  {priority.map((c) => (
                    <span key={c.key} className="atable__card-line">
                      <span className="atable__card-label">{c.label}</span>
                      <span className="atable__card-value">{cell(row, c)}</span>
                    </span>
                  ))}
                  {secondary.length > 0 && (
                    <button
                      type="button"
                      className="atable__more"
                      aria-expanded={open}
                      data-testid={`${testId}-more-${id}`}
                      onClick={() => toggle(id)}
                    >
                      {open ? 'Less' : 'More'}
                    </button>
                  )}
                  {open && secondary.map((c) => (
                    <span key={c.key} className="atable__card-line">
                      <span className="atable__card-label">{c.label}</span>
                      <span className="atable__card-value">{cell(row, c)}</span>
                    </span>
                  ))}
                  {onRowAction && (
                    <button
                      type="button"
                      className="atable__action"
                      data-testid={`${testId}-card-action-${id}`}
                      onClick={() => onRowAction(row)}
                    >
                      {rowActionLabel}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
