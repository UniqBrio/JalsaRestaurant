'use client';
/**
 * ColumnFilter - DR-7's control: a filter that sits in the column it filters.
 *
 * WHY IT EXISTS
 *   DR-7 says that on a multi-column data table the per-field filters belong in the column
 *   headers, and the toolbar keeps only what crosses columns - the search box and the date
 *   presets. A toolbar that grows a chip group per field pushes the data itself below the fold,
 *   and the data is the reason anyone filtered.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   It holds NO filter state. Selection, multi-select semantics (OR within a field, AND across
 *   fields), the active-filter display and Clear all already exist in `src/lib/list-controls.ts`
 *   and `useListControls`, and are covered by CP-23's rung. This component renders a control
 *   over that state and calls `onToggle`. A second filter model behind the headers is how one
 *   table starts filtering differently from the list beside it.
 *
 * SORT AND FILTER STAY SEPARATE (DR-7)
 *   This is a button of its own, beside the sort button, never the same affordance. One arrow
 *   that both sorts and opens a filter menu makes every attempt at either a coin-flip risk of
 *   the other, and the user stops using both.
 *
 * LIBRARY STATUS
 *   `COMPONENT_LIBRARY` carries "Column header filter (DR-7)" as a GAP. This is the smallest
 *   control that satisfies DR-7 for the one table in this repository that qualifies; it is NOT
 *   a finished general-purpose filter menu (see the row for what is still missing).
 */
import React, { useEffect, useId, useRef, useState } from 'react';

export interface ColumnFilterOption { value: string; label: string }

export interface ColumnFilterProps {
  /** The field this column shows - the same key the list state uses. */
  field: string;
  /** Column label, for the accessible name: "Filter by Screen / module". */
  label: string;
  options: readonly ColumnFilterOption[];
  /** Values currently selected for THIS field, from the shared list state. */
  selected: ReadonlySet<string>;
  /** Toggle one value. The shared state owns what that means. */
  onToggle: (field: string, value: string) => void;
  /** Clear every value for this field. */
  onClear: (field: string) => void;
  testId: string;
}

export function ColumnFilter({
  field, label, options, selected, onToggle, onClear, testId,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuId = useId();
  const active = selected.size > 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    /* Escape is taken in the CAPTURE phase: this control can sit inside a Dialog, which closes
     * on Escape from its own document listener, and one press would otherwise close the menu
     * AND the dialog around it. The same reasoning as SearchableSelect, for the same reason. */
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!rootRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>('[data-role="trigger"]')?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc, true);
    };
  }, [open]);

  return (
    <span className="colfilter" ref={rootRef}>
      <button
        type="button"
        data-role="trigger"
        data-testid={`${testId}-filter-${field}`}
        className={`colfilter__trigger${active ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? menuId : undefined}
        /* The count is in the accessible name, not only in the styling: "2 selected" is the
           part a screen-reader user needs, and colour alone never carries state here. */
        aria-label={active ? `Filter by ${label}, ${selected.size} selected` : `Filter by ${label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{active ? `▾ ${selected.size}` : '▾'}</span>
      </button>

      {open && (
        <div className="colfilter__menu" id={menuId} role="group" aria-label={`${label} filter`}>
          {options.length === 0 ? (
            <p className="colfilter__empty">Nothing to filter by yet.</p>
          ) : (
            options.map((o) => {
              const on = selected.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  className="colfilter__opt"
                  data-testid={`${testId}-filter-${field}-${o.value}`}
                  aria-pressed={on}
                  onClick={() => onToggle(field, o.value)}
                >
                  <span aria-hidden="true">{on ? '✓' : '○'}</span>
                  {o.label}
                </button>
              );
            })
          )}
          {active && (
            <button
              type="button"
              className="colfilter__clear"
              data-testid={`${testId}-filter-${field}-clear`}
              onClick={() => { onClear(field); setOpen(false); }}
            >
              Clear this filter
            </button>
          )}
        </div>
      )}
    </span>
  );
}
