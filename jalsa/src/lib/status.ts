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

export const KOT_STATUS: Record<KotStatus, StatusWord> = {
  new: { staff: 'New', guest: 'Sent to the kitchen', tone: 'error' },
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
