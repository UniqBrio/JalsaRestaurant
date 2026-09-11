'use client';
/**
 * CP-18 — bulk selection.
 *
 * THREE RULES, each from a distinct failure
 *
 *   1. OPT-IN MODE. Selection is entered deliberately. A list where every row is always
 *      selectable turns an ordinary tap into a selection, and the user does not find out until
 *      they act on it.
 *
 *   2. SCOPE IS THE VISIBLE SET. "Select all" means the rows currently filtered into view, and
 *      the bar SAYS SO. The version that silently means "all 12,000 matching records" is how a
 *      user deletes a year of data intending to delete a page of it.
 *
 *   3. THE WRITE SHAPE FOLLOWS THE FAILURE SHAPE. A bulk action over N items can fail for
 *      three of them. If the API returns one boolean, that outcome is unrepresentable, and the
 *      UI must either lie or discard the result. Design the response to carry per-item status
 *      BEFORE building the button.
 *
 * THE DESTRUCTIVE ACTION CONFIRMS; THE REVERSIBLE ONE DOES NOT (amended 10-Sep-2026, CP-28)
 *   This bar shipped with a one-click bulk delete over a selection the user may have built by
 *   shift-clicking — which is the single highest-consequence control in the whole starter, and
 *   it had no confirmation at all. Delete now routes through `ConfirmDialog`, and the message
 *   names the COUNT and the SCOPE, because "Are you sure?" over a selection nobody can see
 *   from inside a modal is not a question anyone can answer. Archive stays one click: it is
 *   reversible, so its safety net is Undo in the toast, not a dialog. Confirming the
 *   reversible one too is how a user learns to click through the dialog that matters.
 *
 * WHERE THE SELECTION ITSELF COMES FROM (amended 10-Sep-2026)
 *   The checkboxes that feed this bar are `SelectionColumn`, and the set arithmetic behind them
 *   is `lib/selection`. The count sentence below is `selectionSummary` from that module rather
 *   than a string built here: the bar and the header checkbox describing one selection in two
 *   slightly different wordings is exactly the drift the shared module exists to stop.
 */
import React, { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { selectionSummary } from '../lib/selection';
import './components.css';

export interface BulkResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

export function BulkBar({
  selectedIds,
  visibleCount,
  onClear,
  onAction,
  subject = { one: 'record', many: 'records' },
  testId = 'bulk',
}: {
  selectedIds: string[];
  /** The count currently in view — what "select all" actually covers. */
  visibleCount: number;
  onClear: () => void;
  onAction: (action: string, ids: string[]) => Promise<BulkResult>;
  /** What the rows ARE, for the confirmation sentence: { one: 'invoice', many: 'invoices' }. */
  subject?: { one: string; many: string };
  testId?: string;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  if (selectedIds.length === 0) return null;

  const n = selectedIds.length;
  const noun = n === 1 ? subject.one : subject.many;

  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions" data-testid={testId}>
      <span className="bulk-bar__count" data-testid={`${testId}-count`}>
        {selectionSummary(selectedIds.length, visibleCount)}
      </span>

      <div className="bulk-bar__actions">
        <button data-testid={`${testId}-clear`} type="button" onClick={onClear} className="bulk-bar__action">
          Clear
        </button>
        {/* Peers share one treatment. The destructive action is separated and outlined, never
            sitting next to the primary one where it can be mistapped. */}
        <button
          data-testid={`${testId}-archive`}
          type="button"

          onClick={() => void onAction('archive', selectedIds)}
          className="bulk-bar__action bulk-bar__action--primary"
        >
          Archive
        </button>
        <button
          data-testid={`${testId}-delete`}
          type="button"

          onClick={() => setConfirmingDelete(true)}
          className="bulk-bar__action bulk-bar__action--destructive"
        >
          Delete
        </button>
      </div>

      {/* The confirm names the number and the scope, and the button names the verb — never
          "OK", which tells the user nothing about what they are agreeing to. */}
      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${n} ${noun}?`}
        message={`${n} of the ${visibleCount} ${subject.many} shown will be deleted. This cannot be undone.`}
        confirmLabel={`Delete ${n} ${noun}`}
        tone="destructive"
        testId={`${testId}-confirm-delete`}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void onAction('delete', selectedIds);
        }}
      />
    </div>
  );
}

/**
 * Report a partial outcome truthfully. "3 of 12 could not be archived" plus the reasons is a
 * usable answer; "Archived" when three failed is a lie the user acts on.
 */
export function summarizeBulk(r: BulkResult): string {
  if (r.failed.length === 0) return `${r.succeeded.length} updated.`;
  if (r.succeeded.length === 0) return `None could be updated. ${r.failed[0]?.reason ?? ''}`.trim();
  return `${r.succeeded.length} updated. ${r.failed.length} could not be — see the details below.`;
}
