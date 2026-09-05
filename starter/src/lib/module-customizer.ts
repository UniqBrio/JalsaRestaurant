/**
 * module-customizer - the PURE logic behind "choose what your app contains, and in what
 * order": per-module enable/disable and reordering, with locked always-on modules.
 *
 * THE MODEL
 *   A flat, ordered list of top-level modules, each optionally carrying ordered children.
 *   Order is meaning: the enabled top-level modules ARE the app's main navigation, in this
 *   order, so the customizer edits navigation itself - which is why every rule here is
 *   conservative.
 *
 * THE RULES
 *   1. alwaysOn locks the TOGGLE, not the position - a module the app cannot run without
 *      (the settings/manage area itself) can still be placed where the user wants it.
 *   2. Disabling a parent hides its children with it, but their enabled flags are KEPT -
 *      re-enabling the parent restores exactly what the user had, not a reset.
 *   3. Reorder moves within siblings only, one step per action (mirrors reconcileOrder /
 *      CP-21: buttons, never drag-only).
 *   4. Position badges are computed from the ENABLED order ("Main tab 3" counts only what
 *      will actually render) - a badge that counts hidden modules points at the wrong tab.
 *
 * No React here: everything with branches is exported and unit-testable without a browser.
 */

export interface ModuleItem {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  /** The toggle is locked ON; reordering stays available (rule 1). */
  alwaysOn?: boolean;
  children?: ModuleItem[];
}

const guardAlwaysOn = (item: ModuleItem, enabled: boolean): boolean =>
  item.alwaysOn ? true : enabled;

/** Toggle one item by id, anywhere in the tree. alwaysOn items ignore the request. */
export function setEnabled(items: readonly ModuleItem[], id: string, enabled: boolean): ModuleItem[] {
  return items.map((it) => {
    if (it.id === id) return { ...it, enabled: guardAlwaysOn(it, enabled) };
    if (it.children) return { ...it, children: setEnabled(it.children, id, enabled) };
    return it;
  });
}

/**
 * Move an item one step among its SIBLINGS. Returns the same reference when the move is
 * impossible (already at the edge, or id absent) so callers can cheaply detect a no-op.
 */
export function moveItem(items: readonly ModuleItem[], id: string, dir: 'up' | 'down'): ModuleItem[] {
  const i = items.findIndex((it) => it.id === id);
  if (i >= 0) {
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= items.length) return items as ModuleItem[];
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }
  let changed = false;
  const next = items.map((it) => {
    if (changed || !it.children) return it;
    const moved = moveItem(it.children, id, dir);
    if (moved === it.children) return it;
    changed = true;
    return { ...it, children: moved };
  });
  return changed ? next : (items as ModuleItem[]);
}

/**
 * Position labels for the ENABLED items only (rule 4): top level -> "<topLabel> N",
 * children of an enabled parent -> "<childLabel> N". Disabled items get no badge - they
 * have no position, and pretending otherwise misnumbers every badge after them.
 */
export function positionBadges(
  items: readonly ModuleItem[],
  topLabel = 'Main tab',
  childLabel = 'Tab',
): Map<string, string> {
  const badges = new Map<string, string>();
  let top = 0;
  for (const it of items) {
    if (!it.enabled) continue;
    badges.set(it.id, `${topLabel} ${++top}`);
    let child = 0;
    for (const c of it.children ?? []) {
      if (c.enabled) badges.set(c.id, `${childLabel} ${++child}`);
    }
  }
  return badges;
}
