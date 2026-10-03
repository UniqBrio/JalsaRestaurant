import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { currentGuestSession } from '@/lib/db/guest';
import { freshState } from '@/lib/db/guest-echo';
import { FavouriteRefused, setFavourite } from '@/lib/db/mutations';
import { readAllSettings } from '@/lib/db/queries';
import { resolveFeatures } from '@/lib/guest-features';

/** A real uuid - anything else is refused here rather than meeting Postgres as a 500. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The heart on "See my order" - kept against the party's bill (03-Oct-2026).
 *
 * WHAT A GUEST MAY WRITE, AND ONLY THAT
 *   A dish id and loved / not loved, on their OWN session's bill, found by the token in their own
 *   cookie. No bill id is read from the request: a guest cannot heart on another party's bill,
 *   because they are never asked to name one. Whether the dish was served on that bill is checked
 *   in `setFavourite`, not trusted from the phone.
 *
 * THE OWNER'S SWITCH IS ENFORCED HERE, NOT ONLY DRAWN. With Settings → What the customer sees →
 * heart off, the phone shows no heart - and a heart posted anyway is refused, so a report the
 * owner switched off cannot fill up behind their back. Taking a heart back is always allowed.
 *
 * It answers with the fresh state, like every guest write: the heart the guest sees is the one
 * the server holds, without a second read that a poll already in flight could swallow.
 */
export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const session = await currentGuestSession();
  if (!session) {
    return fail(401, {
      code: 'unauthenticated',
      message: 'Scan the code on your table again — this phone is not attached to a table right now.',
    });
  }
  if (!session.billId) {
    return fail(409, { code: 'no_bill', message: 'Order something first — the heart is for food on your table.' });
  }

  const input = await body<{ menuItemId?: unknown; loved?: unknown }>(req);
  const menuItemId = typeof input.menuItemId === 'string' ? input.menuItemId : '';
  if (!UUID.test(menuItemId) || typeof input.loved !== 'boolean') {
    return fail(400, { code: 'validation', message: 'That heart could not be read. Try again.' });
  }

  if (input.loved) {
    const features = resolveFeatures((await readAllSettings()).customerFeatures);
    if (!features.heart) {
      return fail(409, { code: 'heart_off', message: 'Hearts are switched off here at the moment.' });
    }
  }

  try {
    const saved = await setFavourite({ billId: session.billId, sessionId: session.id, menuItemId, loved: input.loved });
    return ok({ ...saved, state: await freshState(session) });
  } catch (err) {
    if (err instanceof FavouriteRefused) return fail(409, { code: 'not_served', message: err.message });
    throw err;
  }
});
