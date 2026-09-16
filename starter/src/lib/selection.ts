/**
 * selection — the row checkbox, the header checkbox, and the one question they disagree about.
 *
 * WHAT "SELECT ALL" MEANS, DECIDED ONCE
 *   It means the rows CURRENTLY IN VIEW. The other reading — every record matching the filter,
 *   including the 11,800 below the fold — is how a user deletes a year of data intending to
 *   delete a page of it. The scope is the visible set, and the bar says so in words.
 *
 * THE HEADER CHECKBOX IS THREE-STATE, NOT TWO
 *   none · some · all. `some` renders indeterminate — a half-filled box is the only honest
 *   picture of a partial selection, and a checkbox that shows plain "off" over four selected
 *   rows is actively misleading.
 *   Clicking it while `some` SELECTS the rest. The other choice — clear — throws away work the
 *   user did click by click, and there is no undo for a selection.
 *
 * SELECTION DOES NOT SURVIVE A FILTER CHANGE SILENTLY
 *   Rows that leave the view leave the selection, and `reconcile` returns what it dropped so
 *   the screen can SAY so. Keeping invisible rows selected means the next bulk action reaches
 *   records the user cannot see — the same defect as the greedy select-all, arrived at slowly.
 *
 * Pure set arithmetic. No component, no store: the part that can be wrong is testable alone.
 */

export type HeaderSelectionState = 'none' | 'some' | 'all';

const clone = (ids: Iterable<string>) => new Set<string>(ids);

export function toggleRow(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = clone(selected);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

export function headerState(selected: ReadonlySet<string>, visibleIds: readonly string[]): HeaderSelectionState {
  if (visibleIds.length === 0) return 'none';
  let hit = 0;
  for (const id of visibleIds) if (selected.has(id)) hit++;
  if (hit === 0) return 'none';
  return hit === visibleIds.length ? 'all' : 'some';
}

/** `all` clears the visible rows; `none` and `some` select every visible row. */
export function toggleAll(selected: ReadonlySet<string>, visibleIds: readonly string[]): Set<string> {
  const next = clone(selected);
  if (headerState(selected, visibleIds) === 'all') {
    for (const id of visibleIds) next.delete(id);
  } else {
    for (const id of visibleIds) next.add(id);
  }
  return next;
}

export interface ReconcileResult {
  selected: Set<string>;
  /** Ids dropped because their row left the view. The screen says how many, never nothing. */
  dropped: string[];
}

export function reconcileSelection(selected: ReadonlySet<string>, visibleIds: readonly string[]): ReconcileResult {
  const visible = new Set(visibleIds);
  const kept = new Set<string>();
  const dropped: string[] = [];
  for (const id of selected) {
    if (visible.has(id)) kept.add(id);
    else dropped.push(id);
  }
  return { selected: kept, dropped };
}

/**
 * Shift-select over the VISIBLE order — never over the underlying data order, which the user
 * cannot see and did not sort. Both ends are inclusive; direction does not matter.
 */
export function selectRange(
  selected: ReadonlySet<string>,
  visibleIds: readonly string[],
  anchorId: string,
  targetId: string,
): Set<string> {
  const a = visibleIds.indexOf(anchorId);
  const b = visibleIds.indexOf(targetId);
  if (a < 0 || b < 0) return clone(selected);
  const [from, to] = a <= b ? [a, b] : [b, a];
  const next = clone(selected);
  for (let i = from; i <= to; i++) { const id = visibleIds[i]; if (id !== undefined) next.add(id); }
  return next;
}

/**
 * The count, worded so it cannot be read as a claim about the whole table. "3 selected" over a
 * filtered view is exactly the ambiguity that makes a bulk delete a surprise.
 */
export function selectionSummary(selectedCount: number, visibleCount: number): string {
  const n = Number.isFinite(selectedCount) && selectedCount > 0 ? Math.floor(selectedCount) : 0;
  const of = Number.isFinite(visibleCount) && visibleCount > 0 ? Math.floor(visibleCount) : 0;
  if (n === 0) return 'None selected';
  return `${n} of ${of} shown selected`;
}

/** What to tell the user when a filter change took rows out of their selection. */
export function droppedSummary(dropped: readonly string[]): string | null {
  if (dropped.length === 0) return null;
  if (dropped.length === 1) return '1 selected row is no longer shown, so it was deselected.';
  return `${dropped.length} selected rows are no longer shown, so they were deselected.`;
}
