/**
 * sub-menus - a category may sit under ONE top-level category (24-Sep list, I3).
 *
 * The rule lives in the database (`menu_category_one_level`, migration 20260925090000); this is
 * the same rule, in the same words, so the Menu screen offers only the choices the database will
 * accept and the owner reads a sentence rather than a trigger's error. Pure, so it runs in a unit
 * test and on both sides of the route.
 */

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
}

export const SUB_MENU_REFUSALS = {
  missing: 'That category is not on this menu.',
  self: 'A category cannot sit under itself.',
  deep: 'A sub-menu cannot have its own sub-menus. Choose a top-level category.',
  hasChildren: 'This category has sub-menus of its own, so it cannot go under another.',
} as const;

/** Why `categoryId` cannot be put under `parentId` (null = back to the top), or null when it can. */
export function subMenuProblem(
  all: readonly CategoryNode[],
  categoryId: string,
  parentId: string | null
): string | null {
  if (!all.some((c) => c.id === categoryId)) return SUB_MENU_REFUSALS.missing;
  if (parentId === null) return null;
  if (parentId === categoryId) return SUB_MENU_REFUSALS.self;
  const parent = all.find((c) => c.id === parentId);
  if (!parent) return SUB_MENU_REFUSALS.missing;
  if (parent.parentId !== null) return SUB_MENU_REFUSALS.deep;
  if (all.some((c) => c.parentId === categoryId)) return SUB_MENU_REFUSALS.hasChildren;
  return null;
}

/** The top-level categories `categoryId` may be put under - none when it has sub-menus itself. */
export function parentChoices<T extends CategoryNode>(all: readonly T[], categoryId: string): T[] {
  if (all.some((c) => c.parentId === categoryId)) return [];
  return all.filter((c) => c.id !== categoryId && c.parentId === null);
}
