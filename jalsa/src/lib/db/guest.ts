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

/**
 * The session row a request is holding, once it has read it.
 *
 * Named rather than repeated inline because it is now passed BETWEEN modules: a write route reads
 * it to authorise the write and hands the same value to `freshState`, so the echo does not read
 * it again. A shape spelled out in three places is a shape that grows a fourth field in two.
 */
export interface GuestSession {
  id: string;
  tableId: string;
  billId: string | null;
  /** How this party says they found Jalsa. Empty until they answer; they need not. */
  heardAbout: string;
}

export interface GuestContext {
  phase: GuestPhase;
  sessionId: string | null;
  table: { id: string; name: string; zone: string; seats: number };
  bill: Bill | null;
  /** Set on `recently_paid`: how long the receipt stays reachable after closure. */
  rescanMinutes: number;
  /**
   * How this party said they found Jalsa — '' until they answer, and they need not.
   *
   * On the SESSION rather than the bill because the question is asked on the landing screen,
   * where no bill exists yet: a bill opens at the first round. See the migration's own note.
   */
  heardAbout: string;
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
    return { phase: 'table_inactive', sessionId: null, table, bill: null, rescanMinutes, heardAbout: '' };
  }

  // The cookie is minted by `src/middleware.ts` before this render begins, so on the guest page
  // it is always already here. The fallback covers a direct hit on /api/guest/state, which
  // middleware does not match.
  const carried = await readGuestToken();
  const token = carried ?? newGuestToken();

  const { data: existing } = await db()
    .from('guest_session')
    .select('id,table_id,bill_id,heard_about')
    .eq('token', token)
    .maybeSingle();

  let sessionId: string;
  /* A phone that moves to another table gets a fresh session, so the answer below does not
     follow onto someone else's table. Carried only where the session is. */
  let heardAbout = '';
  if (existing && existing.table_id === table.id) {
    sessionId = existing.id as string;
    heardAbout = (existing.heard_about as string) ?? '';
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
    return { phase: 'live', sessionId, table, bill: open, rescanMinutes, heardAbout };
  }

  const closed = await lastClosedBillForTable(table.id);
  if (closed?.closedAt) {
    const ageMinutes = (Date.now() - new Date(closed.closedAt).getTime()) / 60000;
    if (ageMinutes <= rescanMinutes) {
      return { phase: 'recently_paid', sessionId, table, bill: closed, rescanMinutes, heardAbout };
    }
  }

  return { phase: 'welcome', sessionId, table, bill: null, rescanMinutes, heardAbout };
}

/**
 * The same context, for a session this request has ALREADY resolved.
 *
 * WHY THIS EXISTS
 *   A write route looks the session up to authorise the write, then answers with the new state
 *   (`guest-echo.ts`) — and `resolveGuest` then re-derived, from a table NAME, everything the
 *   route was already holding: the session row read a second time by token, the table row read a
 *   second time (once by id to get its name, once by name to get the row), and the session's
 *   `bill_id` written again moments after `attachBillToSession` wrote it. Measured on the CI
 *   runner at ~590ms a round trip, that redundancy was most of four seconds between a guest
 *   tapping Send and their confirmation appearing.
 *
 * WHAT IT DELIBERATELY STILL DOES
 *   - Reads the bill FRESH, from the table, exactly as `resolveGuest` does. The caller's bill
 *     object predates the round it just placed; handing that back would show a confirmation
 *     screen with no round on it.
 *   - Derives the bill from `bill_table`, NOT from `guest_session.bill_id` — the table is the
 *     source of truth (JP-4), which is how a second phone at the same table joins the first
 *     phone's bill rather than opening a rival one.
 *   - Computes `phase` the same way, `recently_paid` and the rescan window included. Assuming
 *     `live` would be wrong the moment a member of staff closes the bill, which is precisely
 *     when the guest is looking at the screen.
 *   - Keeps `guest_session.bill_id` current, because `/api/guest/bill` uses `billForSession()`
 *     to decide which bill this phone may act on at all. The write is skipped only when the
 *     pointer is already correct, which after `attachBillToSession` it is.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   - It does not create or rotate a session: it is only ever called where the caller already
 *     holds one, so the creating branch of `resolveGuest` is unreachable from here.
 *   - It does not stamp `last_seen_at`. Nothing in this application or its migrations READS that
 *     column — it is written in exactly one place and consumed nowhere — and the 6-second poll
 *     goes through `resolveGuest` and stamps it regardless, so session liveness is unchanged.
 *     If a consumer is ever added, this is the second place that has to stamp it.
 */
export async function contextForSession(session: GuestSession): Promise<GuestContext | null> {
  // The table row and the rescan window need nothing from each other.
  const [{ data: row }, { minutes }] = await Promise.all([
    db().from('dining_table').select('id,name,zone,seats,active').eq('id', session.tableId).maybeSingle(),
    readSettings('rescan', { minutes: 15 }),
  ]);
  if (!row) return null;

  const table = {
    id: row.id as string,
    name: row.name as string,
    zone: row.zone as string,
    seats: row.seats as number,
  };
  const rescanMinutes = typeof minutes === 'number' ? minutes : 15;

  if (!row.active) {
    return { phase: 'table_inactive', sessionId: null, table, bill: null, rescanMinutes, heardAbout: '' };
  }

  const open = await openBillForTable(table.id);
  if (open) {
    // Only when it is actually wrong. After `attachBillToSession` it is already right, so the
    // common path costs nothing.
    if (session.billId !== open.id) {
      await db().from('guest_session').update({ bill_id: open.id }).eq('id', session.id);
    }
    return { phase: 'live', sessionId: session.id, table, bill: open, rescanMinutes, heardAbout: session.heardAbout };
  }

  const closed = await lastClosedBillForTable(table.id);
  if (closed?.closedAt) {
    const ageMinutes = (Date.now() - new Date(closed.closedAt).getTime()) / 60000;
    if (ageMinutes <= rescanMinutes) {
      return {
        phase: 'recently_paid',
        sessionId: session.id,
        table,
        bill: closed,
        rescanMinutes,
        heardAbout: session.heardAbout,
      };
    }
  }

  return {
    phase: 'welcome',
    sessionId: session.id,
    table,
    bill: null,
    rescanMinutes,
    heardAbout: session.heardAbout,
  };
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
export async function currentGuestSession(): Promise<GuestSession | null> {
  const token = await readGuestToken();
  if (!token) return null;
  const { data } = await db()
    .from('guest_session')
    .select('id,table_id,bill_id,heard_about')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    tableId: data.table_id as string,
    billId: (data.bill_id as string) ?? null,
    heardAbout: (data.heard_about as string) ?? '',
  };
}

/*
 * `tableNameForSession` was here. It existed for one caller — `freshState()` — which turned a
 * table id into a NAME so that `buildGuestPayload` could turn the name back into the same row.
 * `contextForSession` reads that row once, by id, so the round trip and the function are both
 * gone. Removed rather than left exported: an export nobody calls is a rule nobody applies.
 */
