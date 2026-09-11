/**
 * AuditLogTable — the audit trail, as a table anyone can search, filter and sort (CP-27).
 *
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT CONTAIN
 *   No search box, no filter chips, no date presets, no sort handling and no column picker.
 *   Every one of those already exists: `useListControls` + `ListControls` are CP-23, and
 *   `useColumnPrefs` + `ColumnControl` are CP-21. A second implementation of a registered
 *   concern is a defect, not a preference — and a table whose search behaves differently from
 *   the next screen's is the inconsistency users stop trusting first.
 *
 *   This file is therefore mostly composition, and that is the point: it is the shortest it
 *   can be because the shared parts were reused.
 *
 * WHY SEVEN COLUMNS NEEDS THE COLUMN CONTROL
 *   CP-21: past three columns the user chooses what shows and in what order. Seven columns of
 *   before-and-after values on a laptop is exactly the table that degrades into unusability one
 *   column at a time, with no single change ever being the one that broke it. `at` and
 *   `action` are marked required — a log entry with no time and no action is not a log entry,
 *   so they may be reordered and never hidden.
 *
 * READ-ONLY, STRUCTURALLY
 *   There is no row menu, no edit control and no delete control, and there is nowhere to add
 *   one without changing this file. An audit trail with an edit affordance answers "what
 *   happened" with "whatever the last editor preferred" (CP-27 rule 4).
 */
import { useMemo } from 'react';
import { useListControls } from '../hooks/useListControls';
import { useColumnPrefs, type ColumnDef } from '../hooks/useColumnPrefs';
import { ListControls } from './ListControls';
import { ColumnControl } from './ColumnControl';
import { modulesIn, newestFirst, toRow, isUnattributed, type AuditEntry } from '../lib/audit';

/** Column identity is a stable key, never an index — an inserted column renumbers the rest. */
const COLUMNS: ColumnDef[] = [
  { key: 'action', label: 'What changed', required: true },
  { key: 'module', label: 'Screen / module' },
  { key: 'previousValue', label: 'Previous value' },
  { key: 'newValue', label: 'New value' },
  { key: 'modifiedBy', label: 'Modified by' },
  { key: 'at', label: 'Modified at', required: true },
  { key: 'remarks', label: 'Remarks' },
];

/** Every column is sortable except the two free-text value columns, where sorting means little. */
const SORTABLE = COLUMNS
  .filter((c) => !['previousValue', 'newValue', 'remarks'].includes(c.key))
  .map((c) => ({ key: c.key, label: c.label }));

/**
 * One canonical display format, from an ISO string (CP-15: entry through the picker, display in
 * one format, storage always ISO). Never `toLocaleString()` with no arguments — that renders a
 * different string per visitor, so two people reading the same row disagree about when it
 * happened, which is precisely the question an audit log exists to settle.
 */
export function formatAuditTime(iso: string, locale = 'en-GB'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export function AuditLogTable({
  entries,
  storageKey = 'audit-log',
  testId = 'audit',
  emptyMessage = 'No changes recorded yet.',
  noMatchMessage = 'No changes match these filters.',
  locale = 'en-GB',
}: {
  entries: readonly AuditEntry[];
  /** Column preferences persist per table; two logs on one screen need two keys. */
  storageKey?: string;
  testId?: string;
  emptyMessage?: string;
  noMatchMessage?: string;
  locale?: string;
}) {
  // Newest first before anything else: the most recent change is the one being asked about.
  const rows = useMemo(() => newestFirst(entries).map(toRow), [entries]);
  const unattributed = useMemo(() => entries.filter(isUnattributed).length, [entries]);

  // Memoised because the hook memoises on `config` BY IDENTITY. A literal passed inline is a
  // new object every render, which silently defeats that memo and re-filters the whole log on
  // every keystroke - invisible at ten rows and the reason the box feels heavy at ten thousand.
  const config = useMemo(() => ({
    // One box across every field a person would actually search by, including the values -
    // "who changed the fee to 500" is a real question, and 500 is in newValue.
    searchFields: ['action', 'module', 'previousValue', 'newValue', 'modifiedBy', 'remarks'],
    dateField: 'at',
  }), []);
  const list = useListControls(rows, config);

  const prefs = useColumnPrefs(COLUMNS, storageKey);
  const visible = prefs.order
    .map((k) => COLUMNS.find((c) => c.key === k))
    .filter((c): c is ColumnDef => Boolean(c) && !prefs.hidden.has(c!.key));

  const moduleOptions = useMemo(
    () => modulesIn(entries).map((m) => ({ value: m, label: m })),
    [entries],
  );

  return (
    <section data-testid={`${testId}-log`} aria-label="Audit log">
      <ListControls
        state={list.state}
        matching={list.result.matching}
        total={list.result.total}
        onQuery={list.setQuery}
        onToggleFilter={list.toggleFilter}
        onDate={list.setDate}
        onSort={list.sortBy}
        onClear={list.clearAll}
        filters={[{ field: 'module', label: 'Module', options: moduleOptions }]}
        sortable={SORTABLE}
        searchPlaceholder="Search the audit log"
        testId={testId}
      />

      <ColumnControl columns={COLUMNS} prefs={prefs} testId={testId} />

      {/*
        An unresolved actor is a defect in identity resolution, not a curiosity. Surfacing the
        count here is what makes it get fixed; a row quietly reading "Unknown" among hundreds
        never does. Rendered only when there is something to report — a permanent zero-count
        banner is furniture people stop seeing.
      */}
      {unattributed > 0 && (
        <p data-testid={`${testId}-unattributed`} role="status">
          {unattributed === 1
            ? '1 entry has no identified author. Identity resolution needs attention.'
            : `${unattributed} entries have no identified author. Identity resolution needs attention.`}
        </p>
      )}

      {list.result.total === 0 ? (
        <p data-testid={`${testId}-empty`}>{emptyMessage}</p>
      ) : list.result.matching === 0 ? (
        // A filtered-to-nothing table and an empty log are different facts, and telling the
        // user "no changes recorded" when a filter is hiding them is simply untrue.
        <p data-testid={`${testId}-no-match`}>{noMatchMessage}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table data-testid={`${testId}-table`}>
            <thead>
              <tr>
                {visible.map((c) => (
                  <th key={c.key} scope="col" data-testid={`${testId}-th-${c.key}`}>
                    {SORTABLE.some((s) => s.key === c.key) ? (
                      // A real button: Tab reaches it and Enter activates it for free (CP-22).
                      <button
                        type="button"
                        data-testid={`${testId}-sort-${c.key}`}
                        onClick={() => list.sortBy(c.key)}
                        aria-label={`Sort by ${c.label}`}
                      >
                        {c.label}
                        {list.state.sort?.key === c.key ? (list.state.sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.result.rows.map((r) => (
                <tr key={String(r.id)} data-testid={`${testId}-row-${String(r.id)}`}>
                  {visible.map((c) => (
                    <td key={c.key} data-testid={`${testId}-cell-${c.key}-${String(r.id)}`}>
                      {c.key === 'at' ? formatAuditTime(String(r.at), locale) : String(r[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
