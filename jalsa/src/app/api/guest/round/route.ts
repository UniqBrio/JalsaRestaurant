import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { freshState } from '@/lib/db/guest-echo';
import { attachBillToSession, currentGuestSession } from '@/lib/db/guest';
import { clearCart, ensureOpenBill, GUEST_ACTOR, placeRound, readCart } from '@/lib/db/mutations';
import { openBillForTable, readSettings } from '@/lib/db/queries';
import { NEW_TABLES_CLOSED } from '@/lib/queue-closed';

/**
 * Send this cart to the kitchen as a round.
 *
 * THE BILL IS OPENED HERE, NOT AT THE SCAN
 *   A guest who scans and reads the menu without ordering has not occupied the table on the
 *   captain's floor, and owes nothing. The first round is the first moment either becomes true,
 *   so it is the moment the bill exists.
 *
 * A ROUND THAT LOSES ITEMS SAYS SO
 *   Availability is checked at THIS moment, not when the menu was drawn, so a dish that sold out
 *   while it sat in the cart is refused. The refusal is returned by name — the guest finds out
 *   at the one moment they can still order something else (Product Plan §7).
 */
export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const session = await currentGuestSession();
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'Scan the code on your table again — this phone is not attached to a table right now.',
    });
  }

  const input = await body<{ note?: string }>(req);
  const lines = await readCart(session.id);
  if (lines.length === 0) {
    return fail(400, { code: 'validation', message: 'There is nothing in your order yet.' });
  }

  /* The queue's closed switch stops NEW tables (24-Sep list, F3). A table that already has its
     bill - seated by staff, from the queue, or by an earlier round - keeps ordering; one nobody
     has seated is refused here as well as shown the closed screen, so a phone that loaded the
     menu before the switch flipped cannot open a bill through it. */
  const [existing, queue] = await Promise.all([
    openBillForTable(session.tableId),
    readSettings('queue', { open: true }),
  ]);
  if (!existing && queue.open === false) {
    return fail(409, { code: 'conflict', message: NEW_TABLES_CLOSED });
  }
  const bill = existing ?? (await ensureOpenBill(session.tableId));

  /**
   * TWO WRITES THAT DO NOT READ EACH OTHER.
   *
   * `attachBillToSession` updates one column on `guest_session`. `placeRound` reads `menu_item`
   * and inserts `kot`, `kot_item`, `print_job` and `audit_entry` — it takes the bill id and the
   * table id as ARGUMENTS, both already in hand, and never reads the session row. Neither
   * observes the other's write, so serialising them bought nothing but a round trip.
   *
   * Both are still awaited before the response: the round is never reported placed until the
   * bill, its table link, the KOT, its items and the session's attachment have all landed.
   * A throw from either still fails the request, exactly as before — and if `placeRound` throws,
   * the attachment is already written, which is the same end state the serial version produced.
   */
  const [, result] = await Promise.all([
    attachBillToSession(session.id, bill.id),
    placeRound({
      billId: bill.id,
      tableId: session.tableId,
      lines: lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
      source: 'guest',
      actor: GUEST_ACTOR,
      ...(input.note ? { note: input.note.slice(0, 400) } : {}),
    }),
  ]);

  if (!result.kotId) {
    // Everything in the cart had gone. The cart is deliberately NOT cleared: the guest still
    // has their choices in front of them, which is what they need to swap one out.
    return fail(409, {
      code: 'conflict',
      message:
        result.refused.length === 1
          ? `${result.refused[0]} has just sold out, so nothing was sent. Choose something else and try again.`
          : 'Everything in your order has just sold out, so nothing was sent. Have another look at the menu.',
    });
  }

  await clearCart(session.id);
  // The echo is handed the session this request already read, with the `bill_id` that
  // `attachBillToSession` has just written — so it neither re-reads the row nor re-writes the
  // pointer. `clearCart` stays AHEAD of it deliberately: the payload reports `inCart` and the
  // cart badge, so an echo racing the clear would show the round that was just sent still
  // sitting in the cart.
  return ok({
    kotCode: result.kotCode,
    refused: result.refused,
    state: await freshState({ ...session, billId: bill.id }),
  });
});
