import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { freshState } from '@/lib/db/guest-echo';
import { currentGuestSession } from '@/lib/db/guest';
import { setCartLine } from '@/lib/db/mutations';

/**
 * Add to, or take from, this phone's cart.
 *
 * The session is read from the COOKIE, never from the request body. A table name in a payload
 * is a claim; the cookie is a key the server issued when this phone scanned that table's code.
 * Trusting the claim would let any phone build a cart on any table.
 */
export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const session = await currentGuestSession();
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'Scan the code on your table again — this phone is not attached to a table right now.',
    });
  }

  const input = await body<{ itemId?: string; qty?: number }>(req);
  if (!input.itemId || typeof input.qty !== 'number') {
    return fail(400, { code: 'validation', message: 'An item and a quantity are both needed.' });
  }

  await setCartLine({ sessionId: session.id, menuItemId: input.itemId, qty: Math.max(0, Math.floor(input.qty)) });
  return ok({ done: true, state: await freshState() });
});
