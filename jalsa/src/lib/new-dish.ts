import type { FoodType } from '@/lib/status';

/**
 * new-dish - adding a dish to the menu from the ordering screen (24-Sep list, E1).
 *
 * A guest asks for something the menu does not list yet. The captain's Add items screen and the
 * owner's New round sheet offer a "+" that creates the menu item and puts it in the round - through
 * the SAME write the Menu section uses (`upsertMenuItem`), under the SAME grant (`menu.item_edit`),
 * so there is one way a dish reaches the menu and one audit line for it.
 *
 * NO DUPLICATES
 *   `menu_item_name_unique` is `(restaurant_id, lower(btrim(name)))`. The screen hides the offer
 *   when a dish of that name is already listed, and the server, on a duplicate it could not see,
 *   hands back the existing dish instead of a second one - it is added to the round at its own
 *   price, and the screen says so.
 *
 * Pure, so both screens and the route share it, and the rules run in a unit test.
 */

export interface NewDish {
  name: string;
  price: number;
  categoryId: string;
  foodType: FoodType;
}

export const NEW_DISH_GRANT = 'menu.item_edit';

/** May this person add a dish from the ordering screen? The grant the Menu section asks for. */
export function canAddDish(grants: readonly string[]): boolean {
  return grants.includes(NEW_DISH_GRANT);
}

/** The key the database's unique index compares on. */
export function dishKey(name: string): string {
  return name.trim().toLowerCase();
}

/** The listed dish this name already means, if any. */
export function existingDish<T extends { name: string }>(menu: readonly T[], name: string): T | null {
  const key = dishKey(name);
  if (!key) return null;
  return menu.find((m) => dishKey(m.name) === key) ?? null;
}

const FOOD_TYPES: readonly FoodType[] = ['veg', 'non_veg', 'egg'];

/**
 * Why this dish cannot be saved, as the sentence the screen prints - or null when it can.
 * The bounds are the columns' own check constraints, refused here so nobody meets a
 * constraint violation.
 */
export function newDishProblem(d: Partial<NewDish>): string | null {
  const name = (d.name ?? '').trim();
  if (name.length < 1) return 'Give the dish a name.';
  if (name.length > 120) return 'A dish name is at most 120 characters.';
  if (typeof d.price !== 'number' || !Number.isFinite(d.price) || d.price <= 0) {
    return 'Give the dish a price above ₹0.';
  }
  if (d.price > 99_999_999.99) return 'That price is too large.';
  if (!d.categoryId) return 'Choose a category.';
  if (!d.foodType || !FOOD_TYPES.includes(d.foodType)) return 'Choose veg, non-veg or egg.';
  return null;
}
