import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/supabase/server';
import { bearerFrom, hashToken } from '@/lib/bridge-token';

/**
 * bridge-auth — the credential a print bridge carries, and the whole of what it buys.
 *
 * WHY NOT THE STAFF COOKIE
 *   `readStaffSession` authenticates a PERSON holding a phone, through an HMAC cookie the browser
 *   replays. A bridge is an unattended process on a kitchen PC: no browser, no cookie jar, and
 *   nobody to sign it in after a reboot. It needs a bearer credential it can read from disk at
 *   start-up, which is a different thing and is therefore a different function — not a widened
 *   version of the staff one. Widening that would have put a cookie path on a machine nobody logs
 *   into.
 *
 * WHY NOT `SUPABASE_SECRET_KEY`
 *   That key bypasses RLS on every table. Handing it to a PC on a restaurant counter, to print
 *   tickets, would put the menu, the bills, the staff PINs and the audit log on that counter too.
 *   Guardrail 3 already says the browser never speaks to Supabase, for the same reason and with
 *   the same remedy: go through this application's own routes, where the permission model lives
 *   in one place. A bridge is just another client of that rule.
 *
 * WHAT THE TOKEN BUYS
 *   One restaurant, three verbs — list, claim, report — and nothing else. It cannot read a bill,
 *   a guest, a menu or a staff record, because no route it can reach does those things.
 *
 * WHY ONLY THE HASH IS STORED
 *   `bridge_token.token_hash` is the SHA-256 of the token; the token is shown once, at issue. A
 *   dump of that table therefore yields no working credential. Revocation is a timestamp rather
 *   than a redeploy, which matters when the thing to revoke is a PC somebody took home.
 */

export interface Bridge {
  /** `bridge_token.id`. */
  id: string;
  restaurantId: string;
  /** What a person calls the machine — "Kitchen PC". This is what lands in `claimed_by`. */
  label: string;
  /**
   * Came from a pairing code rather than a hand-issued token (20260923090000). A paired bridge
   * is served ONLY the printers mapped to it in `bridge_printer`, enforced here on the server —
   * not merely by the bridge asking politely for the right machine ids.
   */
  paired: boolean;
}

/* The pure halves — hashing and header parsing — live in `bridge-token.ts`, outside the
   server-only boundary, so a unit spec can execute them. Re-exported so callers have one import. */
export { bearerFrom, hashToken };

/**
 * Resolve a request to the bridge that sent it, or null.
 *
 * FAILS CLOSED, INCLUDING WHEN THE LOOKUP ITSELF FAILS. An unreachable database returning null
 * here means "not authenticated"; returning a bridge would turn an outage into an authorisation
 * bypass, which is the one failure mode a credential check must not have.
 */
export async function authenticateBridge(req: Request): Promise<Bridge | null> {
  const token = bearerFrom(req);
  if (!token) return null;

  const { data, error } = await db()
    .from('bridge_token')
    .select('id,restaurant_id,label,token_hash,revoked_at,source')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at !== null) return null;

  // The lookup is already by hash, so this compares two values that must match. It is here for
  // the property the index cannot give: a constant-time final check, so no future refactor to a
  // scan-and-compare shape reintroduces a timing signal.
  const stored = Buffer.from(data.token_hash as string, 'utf8');
  const offered = Buffer.from(hashToken(token), 'utf8');
  if (stored.length !== offered.length || !timingSafeEqual(stored, offered)) return null;

  return {
    id: data.id as string,
    restaurantId: data.restaurant_id as string,
    label: data.label as string,
    paired: (data.source as string | null) === 'paired',
  };
}

/** Last contact, for the owner's console. Best effort: a failed touch must never fail a print. */
export async function touchBridge(bridgeId: string): Promise<void> {
  await db().from('bridge_token').update({ last_seen_at: new Date().toISOString() }).eq('id', bridgeId);
}
