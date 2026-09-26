import type { FoodType } from '@/lib/status';

/**
 * new-dish - adding a dish to the menu from the ordering screen (24-Sep list, E1).
 *
 * A guest asks for something the menu does not list yet. The captain's Add items screen and the
 * owner's New round sheet offer a "+" that creates the menu item and puts it in the round - through
 * the SAME write the Menu section uses (`upsertMenuItem`), under its grant (`menu.item_edit`) plus
 * `menu.price_edit`, so there is one way a dish reaches the menu and one audit line for it.
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

/**
 * Both grants: adding the item, and setting its price. A new dish IS a price, so a person who may
 * add items but not set prices must not be able to create "Chicken Biryani (L)" at ₹1 from the
 * floor and order it (review, 25-Sep-2026).
 */
/** What saving answers: the dish's id, whether it was already on the menu, and whether it can be ordered. */
export interface NewDishSaved {
  id: string;
  existed: boolean;
  available: boolean;
}

/**
 * What the ordering screen does with a saved dish: put one in the round, or - a dish that was
 * already on the menu and is sold out - leave the round alone and say why.
 */
export function afterDishSaved(
  cart: Record<string, number>,
  saved: NewDishSaved,
  name: string
): { cart: Record<string, number>; message: string; tone: 'success' | 'neutral' } {
  if (!saved.available) {
    return { cart, message: `${name} is already on the menu and sold out - nothing was added`, tone: 'neutral' };
  }
  return {
    cart: { ...cart, [saved.id]: (cart[saved.id] ?? 0) + 1 },
    message: saved.existed
      ? `${name} was already on the menu - added to this round at its menu price`
      : `${name} added to the menu and to this round`,
    tone: 'success',
  };
}

export const NEW_DISH_GRANTS = ['menu.item_edit', 'menu.price_edit'] as const;

/** May this person add a dish from the ordering screen? */
export function canAddDish(grants: readonly string[]): boolean {
  return NEW_DISH_GRANTS.every((g) => grants.includes(g));
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
