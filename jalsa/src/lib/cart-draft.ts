/**
 * cart-draft — what the phone believes is in the cart, before the server has said so.
 *
 * WHY THE PHONE IS ALLOWED AN OPINION HERE AND NOWHERE ELSE
 *   Every other number on the guest surface is the server's: prices, GST, the tip rule, the
 *   payable. This one is not a number the restaurant charges, it is a number the guest just
 *   typed with their thumb — and a quantity that will not change until Hosur → Vercel →
 *   Supabase ap-southeast-2 → back has completed is a quantity that looks broken. Reported
 *   12-Sep-2026: "for adding an item, it is taking time... the order should be added
 *   immediately."
 *
 *   The draft is an OVERLAY, never a source: the moment the server answers, its entry is
 *   dropped and the payload is the truth again. A draft that outlived its write would be a
 *   phantom item on someone's bill, which is far worse than the wait it removes.
 *
 * Kept pure, and out of React, so the merge rule can be tested without a browser.
 */

export type CartDraft = Readonly<Record<string, number>>;

/** What to show for one row: the phone's unconfirmed intention, else the server's answer. */
export function effectiveQty(draft: CartDraft, itemId: string, serverQty: number): number {
  const pending = draft[itemId];
  return pending === undefined ? serverQty : pending;
}

/**
 * How many things are in the cart, counting the drafts.
 *
 * The bottom bar appears at all only when this is above zero, so taking it from the server
 * alone means the first add of the evening leaves the guest looking at a screen that has not
 * reacted. Counting is not pricing: no rupee is decided here.
 */
export function draftedCount(draft: CartDraft, menu: ReadonlyArray<{ id: string; inCart: number }>): number {
  return menu.reduce((n, m) => n + effectiveQty(draft, m.id, m.inCart), 0);
}

/** Put one intention into the draft. Quantities never go below zero. */
export function withDraft(draft: CartDraft, itemId: string, qty: number): CartDraft {
  return { ...draft, [itemId]: Math.max(0, Math.floor(qty)) };
}

/**
 * Drop one intention, because the server has now spoken — whether it agreed or not.
 *
 * Called on success AND on failure, deliberately. On failure the row snapping back to what the
 * server says is the whole point: the guest sees the truth, and the toast says why.
 */
export function withoutDraft(draft: CartDraft, itemId: string): CartDraft {
  if (!(itemId in draft)) return draft;
  const next: Record<string, number> = { ...draft };
  delete next[itemId];
  return next;
}
