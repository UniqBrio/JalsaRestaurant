'use client';
/**
 * CP-21 — the control that makes a wide table configurable.
 *
 * WHY ↑/↓ BUTTONS AND NOT DRAG-AND-DROP
 *   Dragging needs pointer heuristics, an autoscroll for a list taller than its popup, and a
 *   keyboard alternative anyway to be operable at all. Two buttons are none of that, and they
 *   behave identically by mouse, keyboard and touch. The fancier affordance is more code, more
 *   failure modes, and worse for the people most likely to need this feature.
 *
 * WHY THE TRIGGER SHOWS A COUNT
 *   `Columns · 9/15` says, without opening anything, that six columns are hidden. A control that
 *   silently changes what a table contains is how someone concludes the data is missing and
 *   re-enters a record that was there all along.
 *
 * ACCESSIBILITY
 *   The popup closes on Escape and on an outside click — a popup that only closes by selecting
 *   something traps whoever opened it by mistake. State is carried by a real checkbox, never by
 *   colour alone.
 *
 * Colours and spacing come from the token system (see `theme-toggle.css` for the same approach).
 * No literal ever appears here — `scripts/audits/check-hardcoded-colors.mjs` enforces it.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { ColumnDef, ColumnPrefs } from '../hooks/useColumnPrefs';

export function ColumnControl({
  columns,
  prefs,
  testId = 'table',
}: {
  columns: ColumnDef[];
  prefs: ColumnPrefs;
  /** Table identity, so several tables on one screen stay addressable apart. */
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const byKey = new Map(columns.map((c) => [c.key, c]));
  const shown = prefs.order.filter((k) => !prefs.hidden.has(k)).length;

  return (
    <div className="column-control" ref={rootRef}>
      <button
        type="button"
        className={`column-control__trigger${prefs.customised ? ' column-control__trigger--customised' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid={`${testId}-columns`}
        onClick={() => setOpen((o) => !o)}
      >
        {/* The count is text, not a dot: status is never carried by colour alone. */}
        Columns · {shown}/{columns.length}
      </button>

      {open && (
        <div className="column-control__panel" role="dialog" aria-label="Choose and reorder columns">
          <ul className="column-control__list">
            {prefs.order.map((key, i) => {
              const col = byKey.get(key);
              if (!col) return null; // reconcileOrder should prevent this; render nothing if not
              return (
                <li key={key} className="column-control__row">
                  <label className="column-control__label">
                    <input
                      type="checkbox"
                      checked={!prefs.hidden.has(key)}
                      disabled={col.required}
                      data-testid={`${testId}-columns-toggle-${key}`}
                      onChange={() => prefs.toggle(key)}
                    />
                    <span>{col.label}</span>
                    {col.required && <span className="column-control__note">always shown</span>}
                  </label>
                  <span className="column-control__move">
                    <button
                      type="button"
                      className="column-control__step"
                      aria-label={`Move ${col.label} earlier`}
                      disabled={i === 0}
                      data-testid={`${testId}-columns-up-${key}`}
                      onClick={() => prefs.move(key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="column-control__step"
                      aria-label={`Move ${col.label} later`}
                      disabled={i === prefs.order.length - 1}
                      data-testid={`${testId}-columns-down-${key}`}
                      onClick={() => prefs.move(key, 1)}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Reset is always reachable. Without it, a user who hides the column they needed has
              no way back except clearing site data. */}
          <button
            type="button"
            className="column-control__reset"
            data-testid={`${testId}-columns-reset`}
            onClick={prefs.reset}
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
