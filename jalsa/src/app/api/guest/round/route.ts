import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { freshState } from '@/lib/db/guest-echo';
import { attachBillToSession, currentGuestSession } from '@/lib/db/guest';
import { clearCart, ensureOpenBill, GUEST_ACTOR, placeRound, readCart } from '@/lib/db/mutations';

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

  const bill = await ensureOpenBill(session.tableId);
  await attachBillToSession(session.id, bill.id);

  const result = await placeRound({
    billId: bill.id,
    tableId: session.tableId,
    lines: lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
    source: 'guest',
    actor: GUEST_ACTOR,
    ...(input.note ? { note: input.note.slice(0, 400) } : {}),
  });

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
  return ok({ kotCode: result.kotCode, refused: result.refused, state: await freshState() });
});
