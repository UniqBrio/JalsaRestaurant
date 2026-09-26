import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { Grants } from '@/lib/permissions';
import { readStaffSession, writeStaffSession, type StaffSession, type Surface } from '@/lib/sessions';
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

export async function signInWithPin(pin: string, surface: Surface): Promise<StaffSession | null> {
  if (!/^\d{4}$/.test(pin)) return null;
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db().rpc('verify_staff_pin', { p_restaurant: restaurantId, p_pin: pin });
  if (error) throw error;

  const row = (
    data as Array<{ id: string; name: string; role: string; initials: string; provisional: boolean }> | null
  )?.[0];
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

/** The person signed in on this surface, with their live grants. Null when nobody is. */
export async function currentStaff(surface: Surface): Promise<SignedInStaff | null> {
  const session = await readStaffSession(surface);
  if (!session) return null;

  // A person removed or deactivated mid-shift must lose access on their next request, not on
  // their next sign-in. The cookie proves who they were, never that they still work here.
  const { data } = await db()
    .from('staff')
    .select('id,active,removed_at,pin_provisional')
    .eq('id', session.staffId)
    .maybeSingle();
  if (!data || data.removed_at !== null || data.active !== true) return null;

  // Re-read from the ROW, not from the cookie. A PIN chosen in another tab must take effect here
  // on the next request, and an owner reissuing a PIN mid-shift must put that person back in
  // front of the prompt rather than leaving them working behind a code they no longer own.
  const provisional = data.pin_provisional === true;

  const keys = await grantsFor(session.staffId);
  return { ...session, provisional, grants: new Grants(keys) };
}

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
