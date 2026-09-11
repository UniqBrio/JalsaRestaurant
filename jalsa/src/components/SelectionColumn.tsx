'use client';
/**
 * SelectionColumn — the row checkbox and the header checkbox, as one pair.
 *
 * WHY THEY SHIP TOGETHER
 *   They are one control split across two places, and every defect in this area comes from
 *   implementing one without the other: a row checkbox with no select-all makes "nearly all"
 *   a twenty-tap job; a select-all with a two-state header lies about a partial selection.
 *
 * THE HEADER IS INDETERMINATE WHEN IT SHOULD BE
 *   `indeterminate` is a DOM property, not an attribute — React cannot set it from JSX, so it
 *   is set through a ref. Skipping that leaves a checkbox showing plain "off" over four
 *   selected rows, which is not a cosmetic problem: it is the screen telling the user
 *   something false about what their next click will act on.
 *
 * A REAL CHECKBOX INPUT, ALWAYS (CP-22)
 *   Tab reaches it, Space toggles it, the label is clickable and screen readers announce the
 *   state — all for free. A styled `div` with a click handler gets none of that and has to
 *   re-earn every part of it by hand.
 *
 * SELECTION IS OPT-IN AT THE TABLE LEVEL (CP-18), not per row: a table where every row is
 * always selectable turns an ordinary tap into a selection, and the user finds out when they
 * act on it.
 */
import React, { useEffect, useRef } from 'react';
import { headerState, selectionSummary, type HeaderSelectionState } from '../lib/selection';
import './components.css';

export function SelectAllCheckbox({
  selected,
  visibleIds,
  onToggleAll,
  testId = 'select-all',
}: {
  selected: ReadonlySet<string>;
  /** The rows IN VIEW. This is the scope of "all", and the label says so. */
  visibleIds: readonly string[];
  onToggleAll: () => void;
  testId?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const state: HeaderSelectionState = headerState(selected, visibleIds);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);

  const count = visibleIds.reduce((n, id) => n + (selected.has(id) ? 1 : 0), 0);

  return (
    <label className="select-all">
      {/* `data-testid` sits ahead of every arrow-function prop deliberately: the addressability
          audit reads the opening tag with a `[^>]` scan, which stops at the first `>` — and the
          `>` of an arrow function is a `>`. Attributes after one are invisible to it. That is a
          limitation of the floor, recorded in KNOWN_LIMITATIONS; the convention costs nothing
          and every component in this starter follows it. */}
      <input
        data-testid={testId}
        ref={ref}

        data-state={state}
        type="checkbox"
        className="select-all__box"
        checked={state === 'all'}
        disabled={visibleIds.length === 0}
        // The accessible name states the scope; the visible label is an icon-free box in a
        // header cell, where a visible "Select all 12 shown" would not fit.
        aria-label={`Select all ${visibleIds.length} shown`}
        onChange={onToggleAll}
      />
      <span className="select-all__count" data-testid={`${testId}-count`}>
        {selectionSummary(count, visibleIds.length)}
      </span>
    </label>
  );
}

export function RowSelectCheckbox({
  id,
  label,
  selected,
  onToggle,
  testId = 'row-select',
}: {
  /** The DATABASE id. A list index renames itself on every sort — exactly when a test needs it. */
  id: string;
  /** What this row IS, for the accessible name: "Asha Rao", "Invoice 4021". */
  label: string;
  selected: boolean;
  onToggle: (id: string, shiftKey: boolean) => void;
  testId?: string;
}) {
  return (
    <input
      data-testid={`${testId}-${id}`}
      type="checkbox"
      className="row-select"
      checked={selected}
      aria-label={`Select ${label}`}
      // Shift-click extends from the last row touched — over the VISIBLE order, which is the
      // only order the user can see (see selectRange in lib/selection).
      onClick={(e) => onToggle(id, e.shiftKey)}
      onChange={() => {
        /* onClick owns it: onChange cannot see the shift key. */
      }}
    />
  );
}
