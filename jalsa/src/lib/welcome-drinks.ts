/**
 * welcome-drinks — a quick way to add the house's welcome drinks to a table's FIRST order
 * (24-Sep list, D1).
 *
 * WHERE IT LIVES
 *   One settings key, `welcomeDrinks`, in the `setting` table every other owner switch uses:
 *   whether it is on, and which MENU ITEMS are the welcome drinks. The drinks are ordinary menu
 *   items - priced, available or sold out, printed and billed exactly like anything else - so
 *   there is no second menu and no new column. Complimentary means the owner prices them at ₹0.
 *
 * WHEN IT IS OFFERED
 *   Only while the table has no round yet: no bill, or a bill with no KOT (a party seated from
 *   the queue has a bill before its first order). Never on a later round - that is the rule the
 *   request underlined.
 *
 * NOTHING IS ADDED BY ITSELF. The screen offers a button; the person taps it; the drinks go into
 * the round they are building, where they can be seen and removed before it is sent.
 */

export interface WelcomeDrinksConfig {
  enabled: boolean;
  /** Menu item ids, in the order the owner chose them. */
  itemIds: string[];
}

export const NO_WELCOME_DRINKS: WelcomeDrinksConfig = { enabled: false, itemIds: [] };

/** The stored value, read defensively: anything malformed is "off", never an exception. */
export function readWelcomeDrinks(raw: unknown): WelcomeDrinksConfig {
  const v = (raw ?? {}) as { enabled?: unknown; itemIds?: unknown };
  return {
    enabled: v.enabled === true,
    itemIds: Array.isArray(v.itemIds) ? v.itemIds.filter((x): x is string => typeof x === 'string') : [],
  };
}

/** A table's first order: no bill yet, or a bill with no round on it. */
export function isFirstOrder(bill: { kots: readonly unknown[] } | null): boolean {
  return bill === null || bill.kots.length === 0;
}

/**
 * The drinks to offer right now, or none.
 *
 * Only configured items that are on the menu and AVAILABLE: a welcome drink that has sold out is
 * not offered, rather than offered and then refused when the round is sent.
 */
export function welcomeDrinksToOffer<M extends { id: string; available: boolean }>(
  config: WelcomeDrinksConfig,
  firstOrder: boolean,
  menu: readonly M[]
): M[] {
  if (!config.enabled || !firstOrder) return [];
  const byId = new Map(menu.map((m) => [m.id, m]));
  return config.itemIds.map((id) => byId.get(id)).filter((m): m is M => !!m && m.available);
}

/** The cart with each welcome drink set to `perDrink` (one per guest, typically). */
export function withWelcomeDrinks(
  cart: Record<string, number>,
  drinks: readonly { id: string }[],
  perDrink: number
): Record<string, number> {
  const next = { ...cart };
  const qty = Math.max(1, Math.floor(perDrink));
  for (const d of drinks) next[d.id] = Math.max(next[d.id] ?? 0, qty);
  return next;
}

/** Whether every offered drink is already in the round - the "added" state the screen shows. */
export function welcomeDrinksAdded(cart: Record<string, number>, drinks: readonly { id: string }[]): boolean {
  return drinks.length > 0 && drinks.every((d) => (cart[d.id] ?? 0) > 0);
}
