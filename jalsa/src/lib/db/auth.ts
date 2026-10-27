import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { serverConfig } from '@/lib/config';
import { networkKey } from '@/lib/network-key';
import { Grants } from '@/lib/permissions';
import { clientAddress, readStaffSession, writeStaffSession, type StaffSession, type Surface } from '@/lib/sessions';
import { isSharedSetupCode } from '@/lib/setup-pins';
import { grantsFor } from './queries';
import type { Actor } from './mutations';

/**
 * auth - who is signed in, and what they may do.
 *
 * A PIN IS VERIFIED IN THE DATABASE, NEVER HERE
 *   `verify_staff_pin` compares against the stored bcrypt hash inside Postgres. The hash never
 *   crosses the wire, the application needs no hashing dependency, and a wrong PIN returns no
 *   row — there is deliberately no way to learn that a person exists separately from learning
 *   their PIN, which is what makes four digits survivable.
 *
 * WHY GRANTS ARE READ PER REQUEST AND NOT PUT IN THE COOKIE
 *   An owner who revokes a permission mid-service expects it gone now, not at the end of the
 *   captain's shift. Grants in a signed cookie would be stale for up to fourteen hours, and
 *   the revocation that matters most is always the urgent one.
 */

export interface SignedInStaff extends StaffSession {
  grants: Grants;
}

/** Too many PINs that did not work: refused before (or regardless of) the PIN, with the wait. */
export class SignInThrottled extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many sign-in attempts');
  }
}

/**
 * A PIN, checked. Throws `SignInThrottled` when this network (or, for a network the restaurant has
 * not used tonight, everyone together) has spent its allowance of PINs that did not work — the
 * same answer whether this one was right or wrong. Rules: migration 20261027100000.
 */
export async function signInWithPin(pin: string, surface: Surface): Promise<StaffSession | null> {
  if (!/^\d{4}$/.test(pin)) return null;
  // The shared setup code opens nothing (26-Oct-2026 audit, SEC-01; see setup-pins.ts). Refused
  // with the same "no session" as any wrong PIN, so the keypad still names no account.
  if (isSharedSetupCode(pin)) return null;
  const restaurantId = await currentRestaurantId();
  const row = await checkPin(restaurantId, pin, surface);
  if (!row) return null;

  const session: StaffSession = {
    staffId: row.id,
    name: row.name,
    role: row.role,
    initials: row.initials,
    provisional: row.provisional === true,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  await writeStaffSession(surface, session);
  return session;
}

interface PinHolder {
  id: string;
  name: string;
  role: string;
  initials: string;
  provisional: boolean;
}

/**
 * The database's throttled check, one call (27-Oct-2026, P-5). Where the migration has not run
 * yet, the function is missing: the old per-process limit and `verify_staff_pin` take over, the
 * log says so, and the database is asked again five minutes later — so merging this code cannot
 * break sign-in on a database that is behind.
 */
let throttleMissingUntil = 0;

async function checkPin(restaurantId: string, pin: string, surface: Surface): Promise<PinHolder | null> {
  if (Date.now() >= throttleMissingUntil) {
    const { data, error } = await db().rpc('sign_in_with_pin', {
      p_restaurant: restaurantId,
      p_pin: pin,
      p_net: await clientNetwork(),
      p_surface: surface,
    });
    if (!error) {
      const answer = data as { result: string; retry_after?: number; staff?: PinHolder } | null;
      if (answer?.result === 'throttled') throw new SignInThrottled(answer.retry_after ?? 60);
      return answer?.result === 'ok' && answer.staff ? answer.staff : null;
    }
    if (!isMissingFunction(error)) throw error;
    throttleMissingUntil = Date.now() + 5 * 60_000;
    console.warn('[auth] sign_in_with_pin is missing (migration 20261027100000): using the per-process limit');
  }
  legacyLimit();
  const { data, error } = await db().rpc('verify_staff_pin', { p_restaurant: restaurantId, p_pin: pin });
  if (error) throw error;
  return (data as PinHolder[] | null)?.[0] ?? null;
}

/** PostgREST's "no such function", or Postgres's own. */
function isMissingFunction(error: { code?: string }): boolean {
  return error.code === 'PGRST202' || error.code === '42883';
}

/** The network this request came from, as the throttle's key (network-key.ts). */
async function clientNetwork(): Promise<string> {
  return networkKey(await clientAddress(), serverConfig().sessionSecret);
}

/**
 * The limit that ran before the migration, kept for a database without it: ten attempts a minute
 * per server process, everyone together. A speed bump, and only until the migration runs.
 */
const LEGACY_WINDOW_MS = 60_000;
const LEGACY_MAX_ATTEMPTS = 10;
const legacyAttempts: number[] = [];

function legacyLimit(now: number = Date.now()): void {
  while (legacyAttempts.length && now - (legacyAttempts[0] ?? 0) > LEGACY_WINDOW_MS) legacyAttempts.shift();
  if (legacyAttempts.length >= LEGACY_MAX_ATTEMPTS) {
    throw new SignInThrottled(Math.max(1, Math.ceil(((legacyAttempts[0] ?? now) + LEGACY_WINDOW_MS - now) / 1000)));
  }
  legacyAttempts.push(now);
}

/** The person signed in on this surface, with their live grants. Null when nobody is. */
export async function currentStaff(surface: Surface): Promise<SignedInStaff | null> {
  const session = await readStaffSession(surface);
  if (!session) return null;

  // A person removed or deactivated mid-shift must lose access on their next request, not on
  // their next sign-in. The cookie proves who they were, never that they still work here.
  //
  // The row and the grants are read TOGETHER: both are keyed on the id the signed cookie already
  // carries, and this runs at the start of every staff and owner request, so reading them one
  // after the other put a whole round trip in front of everything (requests/2026-09-24-…, fix 3).
  // For a person who has been removed, the grants read is simply discarded.
  const [{ data }, keys] = await Promise.all([
    db().from('staff').select('id,active,removed_at,pin_provisional').eq('id', session.staffId).maybeSingle(),
    grantsFor(session.staffId),
  ]);
  if (!data || data.removed_at !== null || data.active !== true) return null;

  // Re-read from the ROW, not from the cookie. A PIN chosen in another tab must take effect here
  // on the next request, and an owner reissuing a PIN mid-shift must put that person back in
  // front of the prompt rather than leaving them working behind a code they no longer own.
  const provisional = data.pin_provisional === true;

  return { ...session, provisional, grants: new Grants(keys) };
}

/** What an issued (provisional) PIN is told by every action route: it opens one screen only (rule 5). */
export const PROVISIONAL_REFUSAL = 'Choose your own PIN first — an issued PIN opens that screen and nothing else.';

/** The signed-in person as an Actor, for the mutation layer. */
export function actorFor(staff: SignedInStaff): Actor {
  return { staffId: staff.staffId, label: staff.name, grants: staff.grants };
}

/**
 * Replace an issued PIN with one the person chose.
 *
 * The CURRENT pin is required even though they are already signed in. A handset left unlocked on
 * a counter is the realistic threat here, and without this check anyone passing it could lock
 * its owner out of their own name — which is the one thing the whole attribution story rests on.
 *
 * Returns false for a wrong current PIN; the database function refuses a new PIN that is a
 * sequence, a repeat, or the shared setup code, and that refusal surfaces as a thrown error with
 * a sentence the screen can print.
 */
export async function chooseOwnPin(input: { staffId: string; current: string; next: string }): Promise<boolean> {
  const { data, error } = await db().rpc('set_own_pin', {
    p_staff: input.staffId,
    p_current: input.current,
    p_new: input.next,
  });
  if (error) throw error;
  return data === true;
}
