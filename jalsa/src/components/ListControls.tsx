'use client';
/**
 * ListControls - the standard bar above EVERY list or table view (CP-23): one search box
 * across the module's key fields, contextual multi-select filters, the date presets, and
 * per-column ascending/descending sort. One component, configured per module, so every list
 * in the application behaves the same way and the user learns it once.
 *
 * WHAT THE HOST PROVIDES
 *   - the rows and a ListConfig (which fields are searchable, which field is the date)
 *   - `filters`: the contextual filter groups for this module (e.g. course, status, plan)
 *   - `sortable`: the columns a user may sort by
 *   The host renders the list from `result.rows` and shows its OWN empty state when
 *   `matching === 0` - one that names the active search/filters and offers "Clear".
 *
 * HONESTY RULES IN THE RENDER
 *   - The count reads "matching / total" so a filtered list never looks like missing data.
 *   - Active filter chips are real toggles (aria-pressed), announced by state - not by colour.
 *   - Custom range reveals two date inputs INLINE; no dialog, no round trip.
 *   - Clear all is always visible once anything is active: one action back to the full list.
 *
 * KEYBOARD (CP-22): search is a real input (Enter is harmless - filtering is live), every chip
 * and control is a native button element, Tab order is search -> date -> filters -> sort.
 */
import React from 'react';
import { type DateFilterState, type DatePreset, type ListState, DATE_PRESET_LABELS } from '../lib/list-controls';

export interface FilterGroup {
  field: string;
  label: string;
  /** The choices offered, in display order. */
  options: readonly { value: string; label: string }[];
}

export interface SortableColumn {
  key: string;
  label: string;
}

export function ListControls({
  state,
  matching,
  total,
  onQuery,
  onToggleFilter,
  onDate,
  onSort,
  onClear,
  filters = [],
  sortable = [],
  datePresets = ['all', 'today', 'this-week', 'last-week', 'this-month', 'custom'],
  searchPlaceholder = 'Search',
  autoFocusSearch = false,
  testId = 'list',
}: {
  state: ListState;
  matching: number;
  total: number;
  onQuery: (q: string) => void;
  onToggleFilter: (field: string, value: string) => void;
  onDate: (d: DateFilterState) => void;
  onSort: (key: string) => void;
  onClear: () => void;
  filters?: FilterGroup[];
  sortable?: SortableColumn[];
  /** Which presets this module offers; omit `date` entirely in ListConfig for undated data. */
  datePresets?: readonly DatePreset[];
  searchPlaceholder?: string;
  autoFocusSearch?: boolean;
  testId?: string;
}) {
  const anyActive =
    state.query.trim() !== '' ||
    Object.values(state.filters).some((s) => s.size > 0) ||
    (state.date && state.date.preset !== 'all') ||
    !!state.sort;
  const dated = state.date !== undefined;

  return (
    <div className="list-controls" data-testid={testId}>
      {/* 1. Search - one box, all key fields */}
      <input
        data-testid={`${testId}-search`}
        type="search"
        className="list-controls__search"
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        value={state.query}
        autoFocus={autoFocusSearch}

        onChange={(e) => onQuery(e.target.value)}
      />

      {/* 2. Date presets - only when the data is dated */}
      {dated && (
        <div className="list-controls__dates" role="group" aria-label="Date range">
          {datePresets.map((p) => (
            <button
              data-testid={`${testId}-date-${p}`}
              key={p}
              type="button"
              className="list-controls__chip"
              aria-pressed={state.date!.preset === p}

              onClick={() => onDate({ ...state.date!, preset: p })}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          ))}
          {state.date!.preset === 'custom' && (
            <span className="list-controls__custom">
              <input
                data-testid={`${testId}-date-from`}
                type="date"
                aria-label="From date"
                value={typeof state.date!.from === 'string' ? state.date!.from : ''}

                onChange={(e) => onDate({ ...state.date!, from: e.target.value })}
              />
              <input
                data-testid={`${testId}-date-to`}
                type="date"
                aria-label="To date"
                value={typeof state.date!.to === 'string' ? state.date!.to : ''}

                onChange={(e) => onDate({ ...state.date!, to: e.target.value })}
              />
            </span>
          )}
        </div>
      )}

      {/* 3. Contextual filters - multi-select per field */}
      {filters.map((g) => (
        <div key={g.field} className="list-controls__group" role="group" aria-label={g.label}>
          <span className="list-controls__group-label">{g.label}</span>
          {g.options.map((o) => {
            const on = state.filters[g.field]?.has(o.value) ?? false;
            return (
              <button
                data-testid={`${testId}-filter-${g.field}-${o.value}`}
                key={o.value}
                type="button"
                className="list-controls__chip"
                aria-pressed={on}

                onClick={() => onToggleFilter(g.field, o.value)}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ))}

      {/* 4. Sort - per column, direction shown as a WORD */}
      {sortable.length > 0 && (
        <div className="list-controls__sort" role="group" aria-label="Sort by">
          {sortable.map((c) => {
            const active = state.sort?.key === c.key;
            const dir = active ? state.sort!.dir : undefined;
            return (
              <button
                data-testid={`${testId}-sort-${c.key}`}
                key={c.key}
                type="button"
                className="list-controls__chip"
                aria-pressed={active}
                aria-label={`Sort by ${c.label}${dir ? `, ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}

                onClick={() => onSort(c.key)}
              >
                {c.label}
                {dir ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* 5. The honest count + one way back */}
      <div className="list-controls__status" role="status" aria-live="polite">
        <span data-testid={`${testId}-count`}>
          {matching} of {total}
        </span>
        {anyActive && (
          <button
            data-testid={`${testId}-clear`}
            type="button"
            className="list-controls__clear"

            onClick={onClear}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
