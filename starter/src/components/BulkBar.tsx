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
 */
import React from 'react';

export interface BulkResult { succeeded: string[]; failed: { id: string; reason: string }[] }

export function BulkBar({
  selectedIds, visibleCount, onClear, onAction, testId = 'bulk',
}: {
  selectedIds: string[];
  /** The count currently in view — what "select all" actually covers. */
  visibleCount: number;
  onClear: () => void;
  onAction: (action: string, ids: string[]) => Promise<BulkResult>;
  testId?: string;
}) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions" data-testid={testId}>
      <span className="bulk-bar__count" data-testid={`${testId}-count`}>
        {selectedIds.length} of {visibleCount} shown selected
      </span>

      <div className="bulk-bar__actions">
        <button type="button" data-testid={`${testId}-clear`} onClick={onClear} className="bulk-bar__action">
          Clear
        </button>
        {/* Peers share one treatment. The destructive action is separated and outlined, never
            sitting next to the primary one where it can be mistapped. */}
        <button
          type="button"
          data-testid={`${testId}-archive`}
          onClick={() => void onAction('archive', selectedIds)}
          className="bulk-bar__action bulk-bar__action--primary"
        >
          Archive
        </button>
        <button
          type="button"
          data-testid={`${testId}-delete`}
          onClick={() => void onAction('delete', selectedIds)}
          className="bulk-bar__action bulk-bar__action--destructive"
        >
          Delete
        </button>
      </div>
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
