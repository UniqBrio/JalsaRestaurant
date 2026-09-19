/**
 * The KOT status workflow — three captain taps, and a guest who stops having to ask.
 *
 * WHAT WAS ACTUALLY MISSING, BECAUSE IT WAS NOT WHAT IT LOOKED LIKE
 *   Almost all of this shipped already. `kot.status` and the whole `kot_status` enum, the
 *   `started_at` / `ready_at` / `served_at` stamps, the `orders.status` permission, the audit
 *   line, and a guest payload carrying per-round status — every one of them was there.
 *
 *   What was missing was the OPERATION. `advance-kot` had exactly two call sites and both acted
 *   only on rounds that were ALREADY `ready` or `picked_up`, so nothing in the application could
 *   move a round out of `new`. A guest-placed round sat at "Order received" until the plates were
 *   cleared. The states existed and could not be reached.
 *
 *   And behind that, two defects worth their own cases: `advanceKot` validated no transition at
 *   all, so a served round could be sent back to preparing; and it stamped the timestamp
 *   unconditditionally while its own comment promised the opposite.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  canAdvanceKot,
  captainNextKot,
  guestSteps,
  GUEST_STEPS,
  KOT_STATUS,
  KOT_TRANSITIONS,
  type KotStatus,
} from '../../src/lib/status';

const MUTATIONS = 'src/lib/db/mutations.ts';
const ROUTE = 'src/app/api/staff/action/route.ts';
const GUEST_VIEW = 'src/lib/db/guest-view.ts';
const STAFF_TABLES = 'src/features/staff/StaffTables.tsx';
const GUEST_PROGRESS = 'src/features/guest/GuestProgress.tsx';

const read = (p: string): string => readFileSync(p, 'utf8');

/** `advanceKot`'s body, from its signature to the next top-level close. */
function advanceKotBody(): string {
  const src = read(MUTATIONS);
  const start = src.indexOf('export async function advanceKot');
  expect(start, 'advanceKot must exist').toBeGreaterThan(-1);
  const end = src.indexOf('\nexport ', start + 1);
  return src.slice(start, end > -1 ? end : undefined);
}

/* ── 1-3. The three moves the captain makes ────────────────────────────────────────────────── */

test('1. Placed → Preparing is the move that did not exist before', () => {
  expect(canAdvanceKot('new', 'preparing')).toBe(true);
  const next = captainNextKot('new');
  expect(next, 'a new round must offer an action — this is the whole bug').not.toBeNull();
  expect(next?.to).toBe('preparing');
  expect(next?.label).toBe('Start preparing');
});

test('2. Preparing → Ready', () => {
  expect(canAdvanceKot('preparing', 'ready')).toBe(true);
  expect(captainNextKot('preparing')).toEqual({ to: 'ready', label: 'Mark ready' });
});

test('3. Ready → Served, under the label that already ships', () => {
  expect(canAdvanceKot('ready', 'served')).toBe(true);
  // "Mark served" is the string this button shipped with. The freeze rule keeps it.
  expect(captainNextKot('ready')).toEqual({ to: 'served', label: 'Mark served' });
});

test('a served round offers nothing, so the row simply ends', () => {
  expect(captainNextKot('served')).toBeNull();
  expect(captainNextKot('cancelled')).toBeNull();
});

/* ── 4. Invalid transitions ────────────────────────────────────────────────────────────────── */

test('4. every move the requester called impossible is refused', () => {
  // Named one by one, in the requester's own words, rather than as a loop over a table — a loop
  // over the table would be asserting the table against itself.
  expect(canAdvanceKot('served', 'preparing'), 'a Served KOT cannot return to Preparing').toBe(false);
  expect(canAdvanceKot('ready', 'preparing'), 'a Ready KOT cannot be marked Preparing').toBe(false);
  expect(canAdvanceKot('new', 'served'), 'a Placed KOT cannot jump straight to Served').toBe(false);
  expect(canAdvanceKot('new', 'ready')).toBe(false);
  expect(canAdvanceKot('preparing', 'served')).toBe(false);
  expect(canAdvanceKot('served', 'served'), 'nor can it be re-served').toBe(false);
  expect(canAdvanceKot('cancelled', 'preparing')).toBe(false);
});

test('4b. cancelling is NOT reachable through the status verb', () => {
  // Cancellation has its own function, its own reason field and its own audit line. A status
  // verb that could also cancel would be a second way to do it, and a second way is a defect.
  for (const from of Object.keys(KOT_TRANSITIONS) as KotStatus[]) {
    expect(canAdvanceKot(from, 'cancelled'), `${from} → cancelled must not be a status move`).toBe(false);
  }
});

test('4c. the server refuses it too — the UI is the courtesy, not the boundary', () => {
  const body = advanceKotBody();
  expect(body, 'the transition is checked before anything is written').toContain(
    'if (!canAdvanceKot(from, input.to))'
  );
  const check = body.indexOf('canAdvanceKot');
  const update = body.indexOf(".from('kot')\n    .update(");
  expect(check, 'and it is checked BEFORE the update, not after').toBeLessThan(update);
});

/* ── 5+9. Authorisation and identity ───────────────────────────────────────────────────────── */

test('5. an unauthorized staff member is refused, server-side', () => {
  const body = advanceKotBody();
  expect(body).toContain("demand(input.actor, 'orders.status')");
  // First statement in the function: nothing is read or written before the grant is checked.
  const demandAt = body.indexOf('demand(');
  const readAt = body.indexOf("from('kot')");
  expect(demandAt).toBeLessThan(readAt);
});

test('9. the audit records who moved it, and between which two states', () => {
  const body = advanceKotBody();
  expect(body).toContain("action: 'Status'");
  expect(body).toContain('actor: input.actor');
  expect(body).toContain('billId:');
  expect(body).toContain('tableId:');
  // The KOT and the destination are both in the detail line.
  expect(body).toContain('kot.code');
});

test('9b. no second audit mechanism was invented', () => {
  const body = advanceKotBody();
  expect(body).toContain('await audit({');
  expect(body, 'no bespoke log table').not.toContain('status_history');
  expect(body).not.toContain('kot_status_log');
});

/* ── 6. The guest cannot mutate anything ───────────────────────────────────────────────────── */

test('6. advance-kot lives ONLY on the staff route, never the guest one', () => {
  expect(read(ROUTE)).toContain("case 'advance-kot':");
  // Every guest route, checked by name rather than by a glob that could quietly match nothing.
  for (const guestRoute of ['cart', 'round', 'bill', 'queue']) {
    const path = `src/app/api/guest/${guestRoute}/route.ts`;
    expect(read(path), `${guestRoute} must not carry a status verb`).not.toContain('advance-kot');
    expect(read(path)).not.toContain('advanceKot');
  }
});

test('6b. the guest timeline is a list, with no control in it', () => {
  const src = read(GUEST_PROGRESS);
  const start = src.indexOf('function RoundTimeline');
  const end = src.indexOf('\nexport function', start);
  const body = src.slice(start, end);
  expect(start, 'the timeline must exist').toBeGreaterThan(-1);
  expect(body, 'no button').not.toContain('<Button');
  expect(body, 'no handler').not.toContain('onClick');
  expect(body, 'and nothing is sent from it').not.toContain('send(');
});

/* ── 7. Persisted server-side ──────────────────────────────────────────────────────────────── */

test('7. the status is written to the row, not held in a component', () => {
  const body = advanceKotBody();
  expect(body).toContain("const patch: Record<string, unknown> = { status: input.to }");
  expect(body).toContain(".from('kot')");
  expect(body).toContain('.update(patch)');
});

test('7b. the stamp is written once, which its comment always claimed and the code did not', () => {
  const body = advanceKotBody();
  // The defect: `patch[stamp] = new Date().toISOString()` ran unconditionally, so a second tap
  // rewrote the minute the kitchen finished — the minute the timings report reads.
  expect(body).toContain('if (stamp && !kot[stamp as keyof typeof kot])');
});

test('8b. two captains at once cannot land an arbitrary state', () => {
  const body = advanceKotBody();
  // The status it READ is pinned in the WHERE clause, so the second write matches no row.
  expect(body).toContain(".eq('status', from)");
  expect(body).toContain('if (!updated?.length)');
});

/* ── 8. Rounds are independent ─────────────────────────────────────────────────────────────── */

test('8. the write is scoped to one round, so siblings cannot move with it', () => {
  const body = advanceKotBody();
  expect(body).toContain(".eq('id', input.kotId)");
  // Nothing in the update is keyed on the bill or the table — which is the whole of the
  // requester's "status belongs to the round, NOT the table, NOT the bill".
  const update = body.slice(body.indexOf('.update(patch)'));
  expect(update, 'never updated by bill').not.toContain("eq('bill_id'");
  expect(update, 'never updated by table').not.toContain("eq('table_id'");
});

test('8c. the guest payload carries a status PER round', () => {
  const src = read(GUEST_VIEW);
  // One object per kot, each with its own status — not one status on the bill.
  expect(src).toContain('const rounds: GuestRound[] = (bill?.kots ?? []).map((k) => ({');
  expect(src).toContain('status: k.status,');
  expect(src).toContain('statusWord: KOT_STATUS[k.status].guest,');
});

/* ── 10. What the guest reads ──────────────────────────────────────────────────────────────── */

test('10. the guest sees the latest persisted status, through the one polling idiom', () => {
  // `useLiveData` is the blessed idiom and the guest screen already uses it; this feature adds
  // no timer, no interval and no retry of its own.
  const progress = read(GUEST_PROGRESS);
  expect(progress).not.toContain('setInterval');
  expect(progress).not.toContain('setTimeout');
  expect(read(GUEST_VIEW)).not.toContain('setInterval');
});

test('the four steps are the design set\'s, in its order and its words', () => {
  expect(GUEST_STEPS.map((s) => s.label)).toEqual([
    'Order received',
    'In the kitchen',
    'Ready',
    'Served',
  ]);
});

test('the first step now reads as the design draws it', () => {
  // The one shipped string this feature changed, and it changed in the ONE vocabulary module so
  // every guest surface moved with it.
  expect(KOT_STATUS.new.guest).toBe('Order received');
  expect(KOT_STATUS.preparing.guest).toBe('In the kitchen');
  expect(KOT_STATUS.served.guest).toBe('Served');
});

test('a round in the kitchen shows one step done, one current, two to come', () => {
  expect(guestSteps('preparing').map((s) => s.state)).toEqual(['done', 'current', 'todo', 'todo']);
});

test('EDGE 1+2. opening the app late shows where the round actually is', () => {
  // The guest who opens after the kitchen started, and the one who opens after it is up. Neither
  // sees a round pretending to be new, because the step list is derived from the stored status.
  expect(guestSteps('preparing')[1]?.state).toBe('current');
  expect(guestSteps('ready')[2]?.state).toBe('current');
});

test('EDGE. picked up from the counter is still "Ready" to the guest, not a fifth step', () => {
  expect(guestSteps('picked_up').map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo']);
  expect(guestSteps('picked_up')).toHaveLength(4);
});

test('a served round reads as finished, all four ticked', () => {
  expect(guestSteps('served').map((s) => s.state)).toEqual(['done', 'done', 'done', 'current']);
});

test('EDGE. a cancelled round claims no progress at all', () => {
  expect(guestSteps('cancelled').every((s) => s.state === 'todo')).toBe(true);
});

/* ── The captain's control ─────────────────────────────────────────────────────────────────── */

test('the captain is offered exactly one action, and only with the grant', () => {
  const src = read(STAFF_TABLES);
  expect(src).toContain('const next = captainNextKot(k.status);');
  expect(src).toContain('{canServe && next ? (');
  expect(src).toContain("const canServe = data.grants.includes('orders.status');");
  // The destination comes from the helper, never from a status comparison in the component.
  expect(src).toContain("action: 'advance-kot', kotId: k.id, to: next.to");
});

test('the counter-pickup step that already ships was left alone', () => {
  // The requester chose to keep it. `picked_up` stays a legal move and StaffLists keeps its verb.
  expect(canAdvanceKot('ready', 'picked_up')).toBe(true);
  expect(canAdvanceKot('picked_up', 'served')).toBe(true);
  expect(read('src/features/staff/StaffLists.tsx')).toContain(
    "const to = kot.status === 'ready' ? 'picked_up' : 'served';"
  );
});

test('no migration was needed, and none was written', () => {
  // Every state already existed in the enum. A new status table would have been a duplicate
  // system, which the requester ruled out explicitly.
  const schema = read('supabase/migrations/20260910070000_jalsa_core_schema.sql');
  expect(schema).toContain(
    "create type public.kot_status as enum ('new', 'preparing', 'ready', 'picked_up', 'served', 'cancelled')"
  );
  expect(schema).toContain('started_at       timestamptz');
  expect(schema).toContain('ready_at         timestamptz');
  expect(schema).toContain('served_at        timestamptz');
});
