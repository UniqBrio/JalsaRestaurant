import 'server-only';
import { createHash } from 'node:crypto';
import { db, currentRestaurantId } from '@/lib/supabase/server';

/**
 * change-stamp — the one cheap question a polling screen asks: "has anything I show changed?"
 *
 * WHY (requests/2026-09-24-app-feels-slow-measure-first.md, fix 4)
 *   Every open screen used to re-read its whole world on a timer — 10–12 database calls a guest
 *   phone every 6 s, 12 for a captain, 29 for the owner every 8 s — to find, nearly every time,
 *   that nothing had happened. A screen now sends the stamp it last saw; the route compares it with
 *   this one and answers `{ unchanged: true }` without building anything when they match.
 *
 * WHERE THE STAMPS COME FROM
 *   Counters the database keeps itself (migration 20260924120000_jalsa_change_versions): 'floor'
 *   for anything a captain or the owner sees, 'catalog' for what every guest sees, and each bill's
 *   own `version` for one table's story. A write anywhere moves the right counter in the same
 *   transaction, so a stamp cannot say "unchanged" about a change that has committed.
 *
 * READ BEFORE THE SCREEN, NEVER BESIDE IT
 *   A route reads the stamp FIRST and builds the screen after. A write landing in between is then
 *   IN the screen but not in the stamp, so the next poll sees a newer stamp and reads once more —
 *   harmless. Read the other way round, the stamp could include a write the screen missed, and the
 *   phone would be told "unchanged" about a screen that is out of date.
 *
 * WHEN IT CANNOT ANSWER
 *   Any failure — including a database the migration has not reached yet — returns null, and null
 *   means "no stamp": the route builds the full screen exactly as it did before this existed.
 */

/**
 * Everything a captain or the owner sees — the floor, as seen BY THIS PERSON.
 *
 * The screen is built for who is asking (their name, their grants, which sections they may open),
 * so the stamp carries a fingerprint of that too. Without it, a tablet whose shared cookie changed
 * from the owner to a cashier was told "unchanged" and kept rendering the owner's console
 * (review of fix 4, 25-Sep-2026). Signing in writes nothing, so no counter could have caught it.
 */
export function staffStamp(
  floor: string | null,
  staff: { staffId: string; provisional: boolean; grants: { list(): string[] } }
): string | null {
  if (!floor) return null;
  const who = createHash('sha1')
    .update([staff.staffId, String(staff.provisional), ...[...staff.grants.list()].sort()].join('|'))
    .digest('base64url')
    .slice(0, 16);
  return `${floor}.${who}`;
}

/** The floor counter alone; `staffStamp` binds it to the person asking. */
export async function floorStamp(): Promise<string | null> {
  try {
    const { data, error } = await db().from('change_version').select('version').eq('scope', 'floor').maybeSingle();
    if (error || !data) return null;
    return `f${String(data.version)}`;
  } catch {
    return null;
  }
}

/**
 * What one table's guest sees: the shared catalog (menu, settings, tables, staff names), the
 * table's open bill and its version, the latest answer the owner wrote to this table, and THIS
 * PHONE's session and cart. One round — two reads side by side.
 *
 * The session is in the stamp because staff can delete it ("free this table" clears the phones on
 * it) and a second tab can change the cart; neither moves a counter this phone watches, and a phone
 * told "unchanged" about a session that no longer exists answers every tap with "scan again"
 * (review of fix 4, 25-Sep-2026). A full read re-creates the session, as it always did.
 */
export async function guestStamp(tableName: string, token: string | null): Promise<string | null> {
  try {
    const restaurantId = await currentRestaurantId();
    // The phone's session hangs off its table, so it rides in the table's query: a session on
    // ANOTHER table (a phone that moved) simply does not match, the stamp differs, and the full
    // read that follows handles the move — as it always has. Two reads, one round.
    const [catalog, table] = await Promise.all([
      db().from('change_version').select('version').eq('scope', 'catalog').maybeSingle(),
      db()
        .from('dining_table')
        .select(
          'id, active, bill_table (bill:bill_id (id, version)), suggestion (replied_at), ' +
            'guest_session (id, bill_id, heard_about, guest_cart_line (menu_item_id, qty))'
        )
        .eq('restaurant_id', restaurantId)
        .ilike('name', tableName)
        .is('bill_table.released_at', null)
        .not('suggestion.replied_at', 'is', null)
        .order('replied_at', { referencedTable: 'suggestion', ascending: false })
        .limit(1, { referencedTable: 'suggestion' })
        .eq('guest_session.token', token ?? '')
        .maybeSingle(),
    ]);
    if (catalog.error || !catalog.data || table.error || !table.data) return null;
    const row = table.data as unknown as {
      active: boolean;
      bill_table?: Array<{ bill?: { id: string; version: number } | null }>;
      suggestion?: Array<{ replied_at: string | null }>;
      guest_session?: Array<{
        id: string;
        bill_id: string | null;
        heard_about: string | null;
        guest_cart_line?: Array<{ menu_item_id: string; qty: number }>;
      }>;
    };
    const bill = row.bill_table?.[0]?.bill ?? null;
    const mine = row.guest_session?.[0] ?? null;
    const cart = (mine?.guest_cart_line ?? []).map((l) => `${l.menu_item_id}:${l.qty}`).sort();
    return JSON.stringify([
      String(catalog.data.version),
      row.active,
      bill?.id ?? '',
      bill ? String(bill.version) : '',
      row.suggestion?.[0]?.replied_at ?? '',
      mine ? [mine.id, mine.bill_id ?? '', mine.heard_about ?? '', ...cart] : 'no-session',
    ]);
  } catch {
    return null;
  }
}

/** The response header a full screen carries its stamp in. The phone sends it back as `?since=`. */
export const STAMP_HEADER = 'x-change-stamp';

/** The answer when the phone's stamp is still current: nothing to rebuild, nothing to send. */
export const UNCHANGED = { unchanged: true } as const;
