/**
 * favourites - the rules behind the guest's heart and the owner's "People loved items", with no
 * database in them, so each is a function with an answer (03-Oct-2026).
 */

/** One stored heart, as read from `guest_favourite`. */
export interface FavouriteRow {
  menuItemId: string | null;
  name: string;
  billId: string;
  createdAt: string;
}

export interface LovedTally {
  menuItemId: string | null;
  name: string;
  /** Parties (bills) that hearted the dish. */
  parties: number;
  lastLovedAt: string;
}

/**
 * Hearts counted per dish: the most-loved first, then the most recently loved, then by name.
 *
 * Counted in PARTIES, not rows: the table's unique rule already allows one heart per dish per
 * bill, and counting distinct bills here as well means a report can never be inflated by a
 * duplicate that slipped past it. A deleted dish (no id) is kept under its own name.
 */
export function tallyFavourites(rows: readonly FavouriteRow[]): LovedTally[] {
  const by = new Map<string, { menuItemId: string | null; name: string; bills: Set<string>; last: string }>();
  for (const r of rows) {
    const key = r.menuItemId ?? `name:${r.name.trim().toLowerCase()}`;
    const cur = by.get(key) ?? { menuItemId: r.menuItemId, name: r.name.trim(), bills: new Set<string>(), last: '' };
    cur.bills.add(r.billId);
    if (r.createdAt > cur.last) {
      cur.last = r.createdAt;
      // The newest snapshot of the name wins, so a renamed dish reads as it is called now.
      cur.name = r.name.trim() || cur.name;
    }
    by.set(key, cur);
  }
  return [...by.values()]
    .map((v) => ({ menuItemId: v.menuItemId, name: v.name, parties: v.bills.size, lastLovedAt: v.last }))
    .sort((a, b) => b.parties - a.parties || b.lastLovedAt.localeCompare(a.lastLovedAt) || a.name.localeCompare(b.name));
}

/**
 * Whether a heart is shown filled: what the phone has just asked for while the write is in
 * flight, otherwise what the server holds.
 *
 * The pending entry is dropped the moment the write answers - on failure too - so a heart whose
 * save failed snaps back to the truth instead of showing a favourite that was never kept.
 */
export function shownLoved(
  menuItemId: string | null,
  saved: readonly string[],
  pending: Readonly<Record<string, boolean>>
): boolean {
  if (!menuItemId) return false;
  if (menuItemId in pending) return pending[menuItemId] === true;
  return saved.includes(menuItemId);
}
