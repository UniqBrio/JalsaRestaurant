import 'server-only';
import { contextForSession, currentGuestSession } from './guest';
import { assembleGuestPayload, type GuestPayload } from './guest-view';

/**
 * The fresh guest payload, attached to the answer of the write that changed it.
 *
 * WHY A WRITE ANSWERS WITH THE STATE
 *   A guest taps "+ ₹20". The phone posts it, waits, then goes and FETCHES the new state, and —
 *   because a read a person caused is never dropped and one may already be on the wire — it can
 *   fetch it twice. Three serial round trips to a database in another region, with the screen
 *   frozen for all of them, for a tap that changed one integer. That is what "adding or removing
 *   a tip takes too long" was, reported 12-Sep-2026.
 *
 *   The server already knows the new state; it has just written it, and it is sitting next to
 *   the database. Sending it back with the answer costs one query set on the fast side of the
 *   wire and removes one or two slow ones. The phone applies it directly.
 *
 * WHY IT IS BEST-EFFORT AND NEVER THROWS
 *   The write SUCCEEDED. If rebuilding the view then fails, turning that into a failed response
 *   would tell the guest their tip did not go through when it did — the worst possible lie for
 *   this screen to tell. On a null, the phone falls back to fetching, which is exactly what it
 *   did before this existed.
 *
 * WHY IT BUILDS THE CONTEXT RATHER THAN RE-RESOLVING IT
 *   It used to look the session up, turn the table id into a NAME, and hand that name to
 *   `buildGuestPayload`, which resolved the session all over again from scratch — thirteen serial
 *   round trips, six of them re-reading rows this request was already holding. It now builds the
 *   context from the session directly (`contextForSession`) and runs the SAME assembler. The
 *   payload is identical; what is gone is the second lookup of things already known.
 */
export async function freshState(): Promise<GuestPayload | null> {
  try {
    const session = await currentGuestSession();
    if (!session) return null;
    const ctx = await contextForSession(session);
    if (!ctx) return null;
    return await assembleGuestPayload(ctx);
  } catch {
    return null;
  }
}
