'use client';
/**
 * useListControls - the state half of CP-23: holds the search / filter / date / sort state
 * for one list view and returns the derived rows. All rules live in ../lib/list-controls.ts;
 * this hook only stores state and calls them.
 */
import { useMemo, useState } from 'react';
import {
  type DateFilterState, type ListConfig, type ListState, type Row,
  applyListControls, emptyListState, toggleFilterValue, toggleSort,
} from '../lib/list-controls';

export function useListControls<T extends Row>(rows: readonly T[], config: ListConfig) {
  const [state, setState] = useState<ListState>(() => ({
    ...emptyListState(),
    date: config.dateField ? { preset: 'all' } : undefined,
  }));

  const result = useMemo(() => applyListControls(rows, state, config), [rows, state, config]);

  return {
    state,
    result, // { rows, matching, total }
    setQuery: (query: string) => setState((s) => ({ ...s, query })),
    toggleFilter: (field: string, value: string) =>
      setState((s) => ({ ...s, filters: toggleFilterValue(s.filters, field, value) })),
    setDate: (date: DateFilterState) => setState((s) => ({ ...s, date })),
    sortBy: (key: string) => setState((s) => ({ ...s, sort: toggleSort(s.sort, key) })),
    clearAll: () => setState({ ...emptyListState(), date: config.dateField ? { preset: 'all' } : undefined }),
  };
}
