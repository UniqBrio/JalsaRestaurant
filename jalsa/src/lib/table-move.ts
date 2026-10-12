/**
 * Move a running order to another table (12-Oct-2026) - the rules the screens and the server share.
 *
 * "From table A1, the customer wants to sit at A2 - move all their orders to A2." The owner chose:
 * onto FREE tables only (combining two live bills is not this action), captains may do it by
 * default, and the kitchen is told by its screens - rounds still to come say the new table - with
 * no extra slip printed (there is no ticket template for one; the same call as cancelling).
 *
 * The database does the move (`move_bill_to_table`, 20261012090000) in one transaction and is the
 * one that refuses; these functions only decide what a screen OFFERS, from the same facts, so it
 * never offers a move the server is about to refuse (Standard 5.6).
 */

/** The grant - "Move a bill to another table", defined since the first permission set. */
export const TABLE_MOVE_GRANT = 'tables.transfer';

export const TABLE_MOVE_COPY = {
  action: 'Move to another table',
  title: (from: string) => `Move table ${from}'s order`,
  body: 'Everything on this order moves to the table you choose: the bill, the rounds still to come and the guests’ phones. Served rounds stay in the record as they were.',
  pick: 'Move to',
  confirm: (to: string) => `Move to ${to}`,
  confirmNone: 'Choose a table',
  keep: 'Cancel',
  noFreeTable: 'No table is free right now. A table shows here once it is free and cleared.',
} as const;

/** What the person is told. Never a database message. */
export const TABLE_MOVE_MESSAGES = {
  gone: 'This order has already been paid or cancelled.',
  notHere: 'This table now holds a different order — reload and check it again.',
  same: 'Choose a different table.',
  unavailable: 'That table is not on the floor any more. Choose another.',
  taken: 'That table is no longer free. Choose another.',
  needsClearing: 'That table still needs clearing. Clear it first, or choose another.',
} as const;

export function tableMovedMessage(billCode: string, from: string, to: string): string {
  return `${billCode} moved from ${from} to ${to}. ${from} needs clearing.`;
}

/** The floor's view of a table, as both floors already carry it. */
export interface MoveFloorTable {
  id: string;
  name: string;
  active: boolean;
  billId: string | null;
  /** The floor's derived state (`tableStateFrom`). */
  state: string;
  /** Phones holding the table: an unsent cart, or the table's open bill. */
  phonesAttached: number;
}

/** "Move to another table" is offered on a table holding an order, to a person with the grant. */
export function tableIsMovable(input: { billId: string | null }, grants: readonly string[]): boolean {
  return input.billId !== null && grants.includes(TABLE_MOVE_GRANT);
}

/**
 * The tables an order may move to: on the floor, free (no order, nothing to clear), with no phone
 * holding an unsent order, and not the table it is on. In floor order.
 */
export function tableMoveTargets<T extends MoveFloorTable>(floor: readonly T[], fromTableId: string): T[] {
  return floor.filter((t) => t.id !== fromTableId && t.active && t.state === 'free' && t.billId === null && t.phonesAttached === 0);
}
