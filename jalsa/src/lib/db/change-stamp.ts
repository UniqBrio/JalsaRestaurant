import 'server-only';
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

/** Everything a captain or the owner sees. */
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
 * What one table's guest sees: the shared catalog (menu, settings, tables), the table's open bill
 * and its version, and the latest answer the owner wrote to this table. One round — two reads side
 * by side.
 */
export async function guestStamp(tableName: string): Promise<string | null> {
  try {
    const restaurantId = await currentRestaurantId();
    const [catalog, table] = await Promise.all([
      db().from('change_version').select('version').eq('scope', 'catalog').maybeSingle(),
      db()
        .from('dining_table')
        .select('id, active, bill_table (bill:bill_id (id, version)), suggestion (replied_at)')
        .eq('restaurant_id', restaurantId)
        .ilike('name', tableName)
        .is('bill_table.released_at', null)
        .not('suggestion.replied_at', 'is', null)
        .order('replied_at', { referencedTable: 'suggestion', ascending: false })
        .limit(1, { referencedTable: 'suggestion' })
        .maybeSingle(),
    ]);
    if (catalog.error || !catalog.data || table.error || !table.data) return null;
    const row = table.data as unknown as {
      active: boolean;
      bill_table?: Array<{ bill?: { id: string; version: number } | null }>;
      suggestion?: Array<{ replied_at: string | null }>;
    };
    const bill = row.bill_table?.[0]?.bill ?? null;
    return JSON.stringify([
      String(catalog.data.version),
      row.active,
      bill?.id ?? '',
      bill ? String(bill.version) : '',
      row.suggestion?.[0]?.replied_at ?? '',
    ]);
  } catch {
    return null;
  }
}

/** The response header a full screen carries its stamp in. The phone sends it back as `?since=`. */
export const STAMP_HEADER = 'x-change-stamp';

/** The answer when the phone's stamp is still current: nothing to rebuild, nothing to send. */
export const UNCHANGED = { unchanged: true } as const;
