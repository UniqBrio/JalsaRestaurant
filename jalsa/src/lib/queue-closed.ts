/**
 * The one sentence a party reads when they tap Join after the queue has closed.
 *
 * WHY IT LIVES IN ITS OWN MODULE
 *   The SERVER throws it (`guestJoinQueue`), the ROUTE answers with it, and the SCREEN compares
 *   against it to decide whether to show the closed state instead of a toast. `mutations.ts`
 *   imports 'server-only', so a client component cannot import the constant from there — and
 *   copying the string into the component would put the same sentence in two places, where the
 *   comparison silently stops matching the first time somebody improves one of them.
 *
 *   It is a plain string with no imports, so both sides can hold it and neither owns it.
 */
export const QUEUE_CLOSED = 'The queue is closed right now, so nobody new is being added.';

/**
 * What a guest reads when they scan a TABLE code while the queue is closed and nobody has
 * seated them there (24-Sep list, F3). Same module, same reason: the round route refuses with
 * it, and the table page shows its own designed screen for the same state.
 */
export const NEW_TABLES_CLOSED =
  'We are not seating new tables right now, so orders cannot be placed from this code. Any of the team can help.';
