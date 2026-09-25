import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { newGuestToken, readGuestToken, writeGuestToken } from '@/lib/sessions';
import {
  findTableByName,
  getBill,
  lastClosedBillForTable,
  listGuestReplies,
  listHeardSources,
  listMenu,
  openBillForTable,
  readAllSettings,
} from './queries';
import { readCart } from './mutations';
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
 * The reads a guest payload needs, started AS SOON AS THEIR KEYS ARE KNOWN rather than after the
 * context is settled.
 *
 * WHY THIS EXISTS (requests/2026-09-24-app-feels-slow-measure-first.md, fix 2)
 *   The guest page and its 6-second poll used to wait for eight database round trips in a row.
 *   The menu and the settings need nothing; the cart needs only the session; the owner's replies
 *   need only the table. None of them needs the bill. So whoever resolves the context starts them
 *   the moment it can, and `assembleGuestPayload` awaits the same promises instead of issuing the
 *   reads again. A live poll now waits for two rounds, never more than three.
 *
 * `heard` is filled only when the phase is known to be `welcome` — it is an unbounded scan and
 * the one screen that shows it is the welcome screen (see `assembleGuestPayload`).
 */
export interface GuestPrefetch {
  menu?: ReturnType<typeof listMenu>;
  settings?: ReturnType<typeof readAllSettings>;
  cart?: ReturnType<typeof readCart>;
  replies?: ReturnType<typeof listGuestReplies>;
  heard?: ReturnType<typeof listHeardSources>;
}

/**
 * Start a read now and await it later. The no-op catch only stops a read that is never awaited —
 * because an earlier step returned or threw — from surfacing as an unhandled rejection; whoever
 * awaits the promise still receives the error.
 */
export function early<T>(p: Promise<T>): Promise<T> {
  p.catch(() => undefined);
  return p;
}

/** The menu and the settings: needed on every guest screen, keyed on nothing. */
export function startGuestReads(): GuestPrefetch {
  return { menu: early(listMenu()), settings: early(readAllSettings()) };
}

function rescanFrom(settings: Record<string, Record<string, unknown>>): number {
  const minutes = (settings.rescan ?? {}).minutes;
  return typeof minutes === 'number' ? minutes : 15;
}

/** The phase a table's bills put a guest in — one rule for both ways of building the context. */
function phaseFor(
  open: Bill | null,
  closed: Bill | null,
  rescanMinutes: number
): Exclude<GuestPhase, 'table_inactive'> {
  if (open) return 'live';
  if (closed?.closedAt) {
    const ageMinutes = (Date.now() - new Date(closed.closedAt).getTime()) / 60000;
    if (ageMinutes <= rescanMinutes) return 'recently_paid';
  }
  return 'welcome';
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

export async function resolveGuest(tableName: string, prefetch: GuestPrefetch = {}): Promise<GuestContext | null> {
  // The cookie is minted by `src/middleware.ts` before this render begins, so on the guest page
  // it is always already here. The fallback covers a direct hit on /api/guest/state, which
  // middleware does not match. Reading it costs no round trip.
  const carried = await readGuestToken();
  const token = carried ?? newGuestToken();
  const settings = (prefetch.settings ??= early(readAllSettings()));

  // ROUND 1 — the table, the settings and this phone's session need nothing from each other.
  const [table, allSettings, { data: existing }] = await Promise.all([
    findTableByName(tableName),
    settings,
    db().from('guest_session').select('id,table_id,bill_id,heard_about').eq('token', token).maybeSingle(),
  ]);
  if (!table) return null;
  const rescanMinutes = rescanFrom(allSettings);

  if (!table.active) {
    return { phase: 'table_inactive', sessionId: null, table, bill: null, rescanMinutes, heardAbout: '' };
  }

  const restaurantId = await currentRestaurantId();
  /* A phone that moves to another table gets a fresh session, so the answer below does not
     follow onto someone else's table. Carried only where the session is. */
  const reuse = existing !== null && existing.table_id === table.id;

  // Keyed on the table and the session, both known now: issued into round 2, awaited by the
  // assembler. A brand-new session has no cart lines, so there is nothing to read.
  prefetch.replies ??= early(listGuestReplies(table.id));
  prefetch.cart ??= early(reuse ? readCart(existing.id as string) : Promise.resolve([]));

  // ROUND 2 — the table's open bill and its last closed one (each ONE query now, see
  // `openBillForTable`), beside the session's own housekeeping.
  const [open, closed] = await Promise.all([
    openBillForTable(table.id),
    lastClosedBillForTable(table.id),
    reuse
      ? db().from('guest_session').update({ last_seen_at: new Date().toISOString() }).eq('id', existing.id)
      : // A phone that walks to a different table gets a different SESSION - reusing the row would
        // carry the old table's cart onto the new table's bill. It keeps the same TOKEN, though:
        // rotating the token would mean writing a cookie, and this function runs inside a server
        // component where Next.js forbids that. Dropping the old row frees the token (it is
        // unique) and takes its cart with it, which is the whole point of the rotation.
        existing
        ? db().from('guest_session').delete().eq('id', existing.id)
        : null,
  ]);

  const phase = phaseFor(open, closed, rescanMinutes);
  if (phase === 'welcome') prefetch.heard ??= early(listHeardSources());
  const bill = phase === 'live' ? open : phase === 'recently_paid' ? closed : null;

  // ROUND 3, only when needed — the session row is created with its bill pointer already set, and
  // an existing one is corrected only when it is wrong (it used to be rewritten on every poll).
  let sessionId: string;
  let heardAbout = '';
  if (reuse) {
    sessionId = existing.id as string;
    heardAbout = (existing.heard_about as string) ?? '';
    if (open && existing.bill_id !== open.id) {
      await db().from('guest_session').update({ bill_id: open.id }).eq('id', sessionId);
    }
  } else {
    const { data: created, error } = await db()
      .from('guest_session')
      .insert({ restaurant_id: restaurantId, token, table_id: table.id, bill_id: open?.id ?? null })
      .select('id')
      .single();
    if (error) throw error;
    sessionId = created.id as string;
  }

  // Only ever for a token this request invented, and only where writing is legal. On the page
  // `carried` is set, so nothing is attempted; in a route handler it persists the new key.
  if (!carried) await persistGuestToken(token);

  return { phase, sessionId, table, bill, rescanMinutes, heardAbout };
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
export async function contextForSession(
  session: GuestSession,
  prefetch: GuestPrefetch = {}
): Promise<GuestContext | null> {
  const settings = (prefetch.settings ??= early(readAllSettings()));
  // Everything below is keyed on the session the caller holds, so it is all one round.
  prefetch.cart ??= early(readCart(session.id));
  prefetch.replies ??= early(listGuestReplies(session.tableId));

  const [{ data: row }, allSettings, open, closed] = await Promise.all([
    db().from('dining_table').select('id,name,zone,seats,active').eq('id', session.tableId).maybeSingle(),
    settings,
    openBillForTable(session.tableId),
    lastClosedBillForTable(session.tableId),
  ]);
  if (!row) return null;

  const table = {
    id: row.id as string,
    name: row.name as string,
    zone: row.zone as string,
    seats: row.seats as number,
  };
  const rescanMinutes = rescanFrom(allSettings);

  if (!row.active) {
    return { phase: 'table_inactive', sessionId: null, table, bill: null, rescanMinutes, heardAbout: '' };
  }

  const phase = phaseFor(open, closed, rescanMinutes);
  if (phase === 'welcome') prefetch.heard ??= early(listHeardSources());

  // Only when it is actually wrong. After `attachBillToSession` it is already right, so the
  // common path costs nothing.
  if (open && session.billId !== open.id) {
    await db().from('guest_session').update({ bill_id: open.id }).eq('id', session.id);
  }
  const bill = phase === 'live' ? open : phase === 'recently_paid' ? closed : null;
  return { phase, sessionId: session.id, table, bill, rescanMinutes, heardAbout: session.heardAbout };
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
