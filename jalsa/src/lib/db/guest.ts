import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { newGuestToken, readGuestToken, writeGuestToken } from '@/lib/sessions';
import { findTableByName, getBill, lastClosedBillForTable, openBillForTable, readSettings } from './queries';
import type { Bill } from './types';

/**
 * guest - resolving what a scanned QR should show.
 *
 * Reusable Design Standard 6.5: the session is anchored to a DURABLE thing (the table), and its
 * state is resolved SERVER-SIDE from that key. The phone holds an opaque token and nothing else.
 * That single decision answers all four of the awkward scan cases the design set names:
 *
 *   scanned, bill open      → the same bill, restored to wherever they were
 *   scanned, bill just closed, inside the rescan window → the paid screen and the receipt
 *   scanned, window passed  → a fresh welcome, and a new bill when they order
 *   scanned by a SECOND phone at the same table → the FIRST phone's bill, not a rival one
 *
 * None of those need the phone to have remembered anything, which is the point: guests close
 * tabs, lose signal and hand the phone to whoever is paying.
 */

export type GuestPhase = 'welcome' | 'live' | 'recently_paid' | 'table_inactive';

export interface GuestContext {
  phase: GuestPhase;
  sessionId: string | null;
  table: { id: string; name: string; zone: string; seats: number };
  bill: Bill | null;
  /** Set on `recently_paid`: how long the receipt stays reachable after closure. */
  rescanMinutes: number;
}

/**
 * Resolve the guest context for a table, creating the session row if this phone is new.
 *
 * Deliberately does NOT open a bill. A guest who scans and reads the menu without ordering must
 * not occupy the table on the captain's floor - the bill starts at the first round, which is
 * also the first moment anything is owed.
 */
/**
 * Persist a freshly minted token, where the runtime allows it.
 *
 * `cookies().set()` is legal in a Route Handler and forbidden during a server render. This is
 * called only for a token this request invented, which on the guest page cannot happen -
 * middleware always got there first. If it ever does, a failure to persist is not worth failing
 * the guest's whole screen over: they get a working session for this request, and the next one
 * mints again. The throw is swallowed deliberately and narrowly, and nothing else is.
 */
async function persistGuestToken(token: string): Promise<void> {
  try {
    await writeGuestToken(token);
  } catch {
    // Server render: middleware owns the cookie here. Nothing to do.
  }
}

export async function resolveGuest(tableName: string): Promise<GuestContext | null> {
  const table = await findTableByName(tableName);
  if (!table) return null;

  const restaurantId = await currentRestaurantId();
  const { minutes } = await readSettings('rescan', { minutes: 15 });
  const rescanMinutes = typeof minutes === 'number' ? minutes : 15;

  if (!table.active) {
    return { phase: 'table_inactive', sessionId: null, table, bill: null, rescanMinutes };
  }

  // The cookie is minted by `src/middleware.ts` before this render begins, so on the guest page
  // it is always already here. The fallback covers a direct hit on /api/guest/state, which
  // middleware does not match.
  const carried = await readGuestToken();
  const token = carried ?? newGuestToken();

  const { data: existing } = await db()
    .from('guest_session')
    .select('id,table_id,bill_id')
    .eq('token', token)
    .maybeSingle();

  let sessionId: string;
  if (existing && existing.table_id === table.id) {
    sessionId = existing.id as string;
    await db().from('guest_session').update({ last_seen_at: new Date().toISOString() }).eq('id', sessionId);
  } else {
    // A phone that walks to a different table gets a different SESSION - reusing the row would
    // carry the old table's cart onto the new table's bill. It keeps the same TOKEN, though:
    // rotating the token would mean writing a cookie, and this function runs inside a server
    // component where Next.js forbids that. Dropping the old row frees the token (it is unique)
    // and takes its cart with it, which is the whole point of the rotation.
    if (existing) await db().from('guest_session').delete().eq('id', existing.id);

    const { data: created, error } = await db()
      .from('guest_session')
      .insert({ restaurant_id: restaurantId, token, table_id: table.id })
      .select('id')
      .single();
    if (error) throw error;
    sessionId = created.id as string;
  }

  // Only ever for a token this request invented, and only where writing is legal. On the page
  // `carried` is set, so nothing is attempted; in a route handler it persists the new key.
  if (!carried) await persistGuestToken(token);

  const open = await openBillForTable(table.id);
  if (open) {
    await db().from('guest_session').update({ bill_id: open.id }).eq('id', sessionId);
    return { phase: 'live', sessionId, table, bill: open, rescanMinutes };
  }

  const closed = await lastClosedBillForTable(table.id);
  if (closed?.closedAt) {
    const ageMinutes = (Date.now() - new Date(closed.closedAt).getTime()) / 60000;
    if (ageMinutes <= rescanMinutes) {
      return { phase: 'recently_paid', sessionId, table, bill: closed, rescanMinutes };
    }
  }

  return { phase: 'welcome', sessionId, table, bill: null, rescanMinutes };
}

/** The bill a guest session is allowed to act on - and no other. */
export async function billForSession(sessionId: string): Promise<Bill | null> {
  const { data } = await db().from('guest_session').select('bill_id').eq('id', sessionId).maybeSingle();
  const billId = data?.bill_id as string | undefined;
  return billId ? getBill(billId) : null;
}

export async function attachBillToSession(sessionId: string, billId: string): Promise<void> {
  await db().from('guest_session').update({ bill_id: billId }).eq('id', sessionId);
}

/**
 * The session behind the cookie on THIS request, with the table it belongs to.
 *
 * Every guest write goes through this rather than trusting a table name in the request body -
 * otherwise a phone could order onto a table it never scanned.
 */
export async function currentGuestSession(): Promise<{ id: string; tableId: string; billId: string | null } | null> {
  const token = await readGuestToken();
  if (!token) return null;
  const { data } = await db().from('guest_session').select('id,table_id,bill_id').eq('token', token).maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    tableId: data.table_id as string,
    billId: (data.bill_id as string) ?? null,
  };
}
