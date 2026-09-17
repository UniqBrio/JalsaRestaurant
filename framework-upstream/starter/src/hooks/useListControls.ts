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
    ...(config.dateField ? { date: { preset: 'all' as const } } : {}),
  }));

  const result = useMemo(() => applyListControls(rows, state, config), [rows, state, config]);

  return {
    state,
    result, // { rows, matching, total }
    setQuery: (query: string) => setState((s) => ({ ...s, query })),
    toggleFilter: (field: string, value: string) =>
      setState((s) => ({ ...s, filters: toggleFilterValue(s.filters, field, value) })),
    /* REFINE, v2.11.0: the shared state gained a per-FIELD clear because DR-7's column-header
     * control needs "Clear this filter" for one column, and only `clearAll` existed. Adding it
     * here rather than looping toggleFilter in the caller is the runbook's rule: a local
     * workaround leaves the gap in place for every other app and forks this one. */
    clearField: (field: string) =>
      setState((s) => ({ ...s, filters: { ...s.filters, [field]: new Set<string>() } })),
    setDate: (date: DateFilterState) => setState((s) => ({ ...s, date })),
    sortBy: (key: string) => setState((s) => ({ ...s, sort: toggleSort(s.sort, key) })),
    clearAll: () => setState({ ...emptyListState(), ...(config.dateField ? { date: { preset: 'all' as const } } : {}) }),
  };
}
