/**
 * status - the ONE status vocabulary, defined once and used identically on the guest's phone,
 * the captain's floor, the owner's board, the printed ticket and every export.
 *
 * Reusable Design Standard 7.1: statuses read as words someone understands on their first
 * shift. `kot_status` in the database already stores those words; this module is what stops a
 * screen inventing a synonym for one of them.
 *
 * THE ONE PLACE THE VOCABULARY DIFFERS BY AUDIENCE, AND WHY
 *   A guest is told "In the kitchen"; a captain is told "Cooking". That is not drift - the
 *   design set says so explicitly, because the guest is being reassured and the captain is
 *   being told what to do. Both read from the same state, and the mapping is here where the
 *   difference is visible, rather than in two components that will diverge.
 */

export type KotStatus = 'new' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'cancelled';
export type BillStatus = 'open' | 'payment_requested' | 'closed' | 'void';
export type FoodType = 'veg' | 'non_veg' | 'egg';

/** The token role a status pill paints itself with. Never a colour - a role. */
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export interface StatusWord {
  /** What staff read. */
  staff: string;
  /** What the guest reads. */
  guest: string;
  tone: Tone;
}

/**
 * Where a round came from, in words (24-Sep list, C3). Read from `kot.source` - the column the
 * route that placed the round wrote - never inferred from a name or a screen.
 *
 * ONE map, used by the owner's board, the report's orders table and the printed KOT. It was
 * written out twice before, each copy noting that it was "duplicated nowhere else".
 */
export const KOT_SOURCE_LABEL: Record<'guest' | 'captain' | 'owner', string> = {
  guest: 'Guest phone',
  captain: 'Captain',
  owner: 'Owner',
};

export const KOT_STATUS: Record<KotStatus, StatusWord> = {
  // "Order received" rather than the "Sent to the kitchen" this shipped with: the reference
  // design draws the first step as Order received, and CLAUDE.md makes the design set the
  // specification. Changed HERE, in the one vocabulary, so every guest surface moves together —
  // which is the reason this module exists.
  new: { staff: 'New', guest: 'Order received', tone: 'error' },
  preparing: { staff: 'Cooking', guest: 'In the kitchen', tone: 'warning' },
  ready: { staff: 'Ready', guest: 'Ready', tone: 'success' },
  picked_up: { staff: 'Picked up', guest: 'On its way', tone: 'info' },
  served: { staff: 'Served', guest: 'Served', tone: 'neutral' },
  cancelled: { staff: 'Cancelled', guest: 'Cancelled', tone: 'neutral' },
};

export const BILL_STATUS: Record<BillStatus, StatusWord> = {
  open: { staff: 'Open', guest: 'Open', tone: 'neutral' },
  payment_requested: { staff: 'Payment requested', guest: 'Bill on its way', tone: 'primary' },
  closed: { staff: 'Closed', guest: 'Paid', tone: 'success' },
  void: { staff: 'Void', guest: 'Cancelled', tone: 'error' },
};

/**
 * The five words a round moves through, in order. Exported as an ordered list because two
 * screens need "what comes next" and neither should hard-code it.
 */
export const KOT_FLOW: readonly KotStatus[] = ['new', 'preparing', 'ready', 'picked_up', 'served'];

export function nextKotStatus(current: KotStatus): KotStatus | null {
  const i = KOT_FLOW.indexOf(current);
  if (i < 0 || i === KOT_FLOW.length - 1) return null;
  return KOT_FLOW[i + 1] ?? null;
}

/**
 * Every move a round is allowed to make, and the ONLY ones the server will write.
 *
 * WHY A TABLE AND NOT `nextKotStatus`
 *   `KOT_FLOW` is a straight line, but the real flow forks once: a ready round can either be
 *   picked up from the counter and then served, or handed straight to the table. A single
 *   "next" cannot express a fork, and `advanceKot` used to write whatever it was handed — so a
 *   served round could be sent back to preparing, and two captains tapping at once could land
 *   any final state at all.
 *
 * READ IT AS: from this state, these are the only states reachable.
 *   new       → preparing                 the kitchen has started
 *   preparing → ready                     it is up
 *   ready     → picked_up | served        off the counter, or straight onto the table
 *   picked_up → served
 *   served    → nothing. It is over, and un-serving food is not a thing.
 *   cancelled → nothing.
 *
 * `cancelled` is deliberately absent as a DESTINATION: cancelling is `cancelKotItem`'s job,
 * which has its own reason field and its own audit line. A status verb that could quietly
 * cancel a round would be a second way to do it, and a second way is a defect.
 */
export const KOT_TRANSITIONS: Record<KotStatus, readonly KotStatus[]> = {
  new: ['preparing'],
  preparing: ['ready'],
  ready: ['picked_up', 'served'],
  picked_up: ['served'],
  served: [],
  cancelled: [],
};

/** Whether this exact move is legal. The server asks this before it writes; so does the UI. */
export function canAdvanceKot(from: KotStatus, to: KotStatus): boolean {
  return KOT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The ONE action a captain is offered for a round, or nothing when it is finished.
 *
 * Contextual by construction: a screen cannot offer "Mark served" on a round still in the
 * kitchen, because there is nothing here to render for it. Standard 5.6 — an action the server
 * is about to refuse is worse than an action that was never offered.
 *
 * `ready` resolves to **served**, not `picked_up`, because the table screen hands food to the
 * guest. The counter-pickup step is a different screen's verb and keeps its own button.
 */
export function captainNextKot(current: KotStatus): { to: KotStatus; label: string } | null {
  switch (current) {
    case 'new':
      return { to: 'preparing', label: 'Start preparing' };
    case 'preparing':
      return { to: 'ready', label: 'Mark ready' };
    case 'ready':
    case 'picked_up':
      // "Mark served" is the label this button already ships with. Frozen on purpose.
      return { to: 'served', label: 'Mark served' };
    default:
      return null;
  }
}

/**
 * The four steps the guest is shown, in the design set's order and words.
 *
 * FOUR, NOT FIVE. `picked_up` is a real state the floor uses, but to the guest it is still the
 * Ready step — their food is up and on its way, which is what "Ready" already tells them. The
 * reference design draws four dots and the requester confirmed four.
 */
export const GUEST_STEPS: ReadonlyArray<{ key: KotStatus; label: string }> = [
  { key: 'new', label: 'Order received' },
  { key: 'preparing', label: 'In the kitchen' },
  { key: 'ready', label: 'Ready' },
  { key: 'served', label: 'Served' },
];

export type StepState = 'done' | 'current' | 'todo';

/**
 * Where a round has got to, as four steps the guest can read at a glance.
 *
 * Derived from the one status, never stored: a stored copy would be a sixth thing to keep in
 * step and the one that is wrong after a crash.
 */
export function guestSteps(status: KotStatus): Array<{ key: KotStatus; label: string; state: StepState }> {
  // `picked_up` sits at the Ready step, which is the whole reason this is a function and not an
  // index lookup on KOT_FLOW.
  const reached = status === 'picked_up' ? 'ready' : status;
  const at = GUEST_STEPS.findIndex((s) => s.key === reached);
  return GUEST_STEPS.map((s, i) => ({
    ...s,
    // A cancelled round has reached nothing; `at` is -1 and every step reads as still to come.
    state: at < 0 ? 'todo' : i < at ? 'done' : i === at ? 'current' : 'todo',
  }));
}

/**
 * The state a TABLE is in, derived from its bill and rounds rather than stored.
 *
 * Stored, it would be a sixth thing to keep in step with five others, and the one that is
 * wrong after a crash. Derived, it cannot disagree with the rounds it is derived from.
 */
export type TableState =
  'free' | 'ordering' | 'in_the_kitchen' | 'ready' | 'served' | 'payment_requested' | 'clearing';

export const TABLE_STATE: Record<TableState, { label: string; tone: Tone }> = {
  free: { label: 'Free', tone: 'neutral' },
  ordering: { label: 'Ordering', tone: 'neutral' },
  in_the_kitchen: { label: 'In the kitchen', tone: 'warning' },
  ready: { label: 'Ready', tone: 'success' },
  served: { label: 'Served', tone: 'neutral' },
  payment_requested: { label: 'Payment requested', tone: 'primary' },
  clearing: { label: 'Needs clearing', tone: 'info' },
};

export function tableStateFrom(input: {
  hasBill: boolean;
  billStatus?: BillStatus;
  kotStatuses: readonly KotStatus[];
  awaitingClearing?: boolean;
}): TableState {
  if (input.awaitingClearing) return 'clearing';
  if (!input.hasBill) return 'free';
  if (input.billStatus === 'payment_requested') return 'payment_requested';
  // Most urgent first: a table with one ready round and three served ones needs a runner.
  if (input.kotStatuses.includes('ready')) return 'ready';
  if (input.kotStatuses.includes('preparing') || input.kotStatuses.includes('new')) return 'in_the_kitchen';
  if (input.kotStatuses.length === 0) return 'ordering';
  return 'served';
}

/**
 * Whether a table is holding something a hand-made release could let go of.
 *
 * ONE rule, read by three places: the owner's floor grid, the captain's floor, and `freeTable`
 * on the server, which is the one that actually refuses. A screen offering an action the server
 * is about to refuse is worse than a screen that never offered it (Standard 5.6) — and two
 * copies of "is this safe to free" would eventually disagree about a table with food on it.
 *
 * `roundCount === 0` is the whole of the safety rule. The moment a round exists the table is
 * held by something real and the answer is a payment or a void, never a floor operation: a tile
 * on a grid must not be able to write off a bill.
 */
export function tableIsFreeable(input: {
  roundCount: number;
  billId: string | null;
  phonesAttached: number;
}): boolean {
  if (input.roundCount > 0) return false;
  // Something has to be there to let go of. An untouched table is already free, and offering
  // "Mark free" on twenty of them is noise on the screen that matters most during service.
  return input.billId !== null || input.phonesAttached > 0;
}

/**
 * Can this table be taken off this bill and given one of its own?
 *
 * `Jalsa Product Plan.dc.html` lists four group cases that "have to be designed, not
 * discovered", and this is the second of them: *"removing a table mid-service (its lines move to
 * a fresh bill)"*. The rule is here rather than only in `detachTableFromBill` for the reason
 * `tableIsFreeable` is here: the screen decides whether to OFFER the button by the same
 * predicate the server decides whether to ALLOW it by, so a hidden button is a courtesy and
 * never the boundary.
 *
 * Each refusal carries its own sentence, because the three are three different situations and
 * exactly one of them has an obvious next step.
 */
export function billSeparability(input: {
  status: BillStatus;
  tableCount: number;
  isHostTable: boolean;
}): { can: boolean; reason: string } {
  if (input.tableCount < 2) {
    return { can: false, reason: 'There is only one table on this bill — there is nothing to separate.' };
  }
  if (input.isHostTable) {
    // host_table_id anchors the bill's own code. Detaching it would leave a bill whose host
    // table belongs to a different bill — the same table claimed twice.
    return { can: false, reason: 'This is the table the bill was opened on. Separate one of the others instead.' };
  }
  if (input.status === 'payment_requested') {
    return {
      can: false,
      reason:
        'This table has already asked to pay. Withdraw the payment request first — moving lines out from under a total somebody has read is not a thing to do quietly.',
    };
  }
  if (input.status !== 'open') {
    return { can: false, reason: 'That bill is closed. A closed bill is a record, and records are not re-split.' };
  }
  return { can: true, reason: '' };
}

/**
 * May this person hold this position on a bill?
 *
 * WHY THE SERVER NEEDS THIS AND NOT JUST THE PICKER
 *   The "Captain on B-1043" sheet listed every active person — Chefs, Cleaning staff, the
 *   Cashier — and `reassignBillStaff` wrote whatever id it was handed straight into
 *   `captain_staff_id`. An unsettled tip FOLLOWS the captain, so a Cleaning staff member could
 *   be made captain on a bill and have somebody else's gratuity moved to them. The dialog
 *   promised captains and the write checked nothing, which is rule 3 of `mutations.ts` broken
 *   in both directions at once.
 *
 * WHY OWNER / ADMIN IS ON BOTH LISTS
 *   One restaurant, one owner, and on a busy Friday he runs tables himself — the floor screen
 *   already shows "My tables · Javeed Ahmed". Excluding him would mean a position he is
 *   currently holding could not be re-selected after it was changed by mistake.
 *
 * WHY A CAPTAIN MAY BE A WAITER AND NOT THE REVERSE
 *   Running food is part of a captain's night; owning a table is not part of a waiter's. The
 *   asymmetry is the real hierarchy, and inverting it would let the picker quietly promote
 *   somebody into the position the tip attaches to.
 */
const ELIGIBLE: Record<'captain' | 'waiter', readonly string[]> = {
  captain: ['Captain', 'Owner / Admin'],
  waiter: ['Waiter', 'Captain', 'Owner / Admin'],
};

export function canHoldBillRole(role: 'captain' | 'waiter', staffRole: string): boolean {
  return (ELIGIBLE[role] ?? []).includes(staffRole);
}

/**
 * The people a picker may offer for a position.
 *
 * The CURRENT holder is always included, whatever their role. Somebody wrongly made captain by
 * the old unchecked write is still recorded as captain today, and a list that filtered them out
 * would make the mistake permanent — the one name you need in order to undo it would be the one
 * name missing.
 */
export function eligibleForBillRole<T extends { id: string; role: string; active: boolean }>(
  role: 'captain' | 'waiter',
  people: readonly T[],
  currentHolderId: string | null
): T[] {
  return people.filter((p) => (p.active && canHoldBillRole(role, p.role)) || p.id === currentHolderId);
}

export const FOOD_TYPE: Record<FoodType, { label: string; short: string }> = {
  veg: { label: 'Veg', short: 'V' },
  non_veg: { label: 'Non-veg', short: 'N' },
  egg: { label: 'Egg', short: 'E' },
};

/**
 * Whether a round can still be changed by a captain without the owner's approval.
 *
 * The gate is the KITCHEN, not the clock: once a ticket has been started, changing it means
 * food already on a pan. The captain's cancel sheet reads this to decide between "Cancel the
 * item" and "Ask Javeed to cancel", and the same function decides on the server - so a guest
 * or a stale phone cannot get a late cancellation through by retrying.
 */
export function kitchenHasStarted(status: KotStatus): boolean {
  return status === 'preparing' || status === 'ready' || status === 'picked_up' || status === 'served';
}
