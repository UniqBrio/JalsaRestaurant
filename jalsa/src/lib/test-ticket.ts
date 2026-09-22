import type { ComposeItem } from './ticket-compose';

/**
 * test-ticket — the one ticket a person prints to find out whether the machine works.
 *
 * WHY IT IS A PAYLOAD AND NOT A SECOND PRINT PATH
 *   The tempting shape for "Test print" is a little function that opens the printer and writes
 *   `Hello`. It would work, and it would prove almost nothing: not the routing, not the claim, not
 *   the encoder, not the transport, not the report — and when a real ticket failed later, the
 *   successful test would be evidence for the wrong thing.
 *
 *   So a test print is an ORDINARY PRINT JOB with a different payload. It is queued like any job,
 *   listed like any job, claimed like any job, composed by `buildTicket`, encoded by `escpos.ts`,
 *   carried by whichever transport this bridge has, and reported like any job. Everything a real
 *   ticket exercises, it exercises. The only thing that differs is what the paper says.
 *
 * WHAT IS ON IT, AND WHY
 *   Enough to diagnose the machine from the paper alone, without asking anybody what they clicked:
 *   which machine Jalsa thinks this is, which station it is stamped for, when it was sent. Both
 *   food types, so the veg/non-veg heading is exercised. A long line, so the column width shows
 *   itself. Nothing that could be mistaken for food a kitchen should cook.
 */

/**
 * The lines of a test ticket, as items.
 *
 * `category: ''` deliberately. It makes every item fall to the machine the job is assigned to
 * through the ordinary "nobody claims this" branch, which means a test print needs no routing
 * configuration to exist and cannot be mis-routed by one that does.
 */
export const TEST_TICKET_ITEMS: readonly ComposeItem[] = [
  { name: 'TEST PRINT - do not cook', qty: 1, foodType: 'veg', rate: 0, category: '', instruction: '' },
  { name: 'Veg line, to show the VEG heading', qty: 2, foodType: 'veg', rate: 0, category: '', instruction: '' },
  {
    name: 'Non-veg line, to show the NON-VEG heading',
    qty: 1,
    foodType: 'non_veg',
    rate: 0,
    category: '',
    instruction: '',
  },
  {
    // Deliberately longer than a 58 mm roll holds. If the right-hand end is missing on paper, the
    // configured width is wrong — and that is visible without measuring anything.
    name: 'Width check 0123456789 0123456789 0123456789 0123456789 0123456789',
    qty: 1,
    foodType: 'veg',
    rate: 0,
    category: '',
    instruction: 'special instruction line',
  },
];

export interface TestTicketFacts {
  restaurant: string;
  branch: string;
  phone: string;
  /** What Jalsa calls this machine. On the paper so a mismatch is visible without the screen. */
  machineName: string;
  machineId: string;
  /** Already formatted. This module owns no locale and no clock. */
  date: string;
  time: string;
  /** Who pressed it. A test ticket appearing in a kitchen should say who caused it. */
  actor: string;
}

/**
 * The header of a test ticket.
 *
 * Every identifier field carries a legible word rather than a plausible-looking code. Somebody
 * WILL pick this paper up off a kitchen pass, and it must be obvious in one glance that it is not
 * an order — a `KOT-0000` would send a cook looking for table zero.
 */
export const testTicketHeader = (facts: TestTicketFacts) => ({
  restaurant: facts.restaurant,
  branch: facts.branch,
  phone: facts.phone,
  gstin: '—',
  kotCode: 'TEST PRINT',
  roundCode: '—',
  billCode: '—',
  table: '—',
  customer: '—',
  captain: facts.actor,
  date: facts.date,
  time: facts.time,
  source: `${facts.machineName} (${facts.machineId})`,
  note: 'This is a test print. Nothing here is an order. If this came out of the wrong machine, the machine id above is the one Jalsa sent it to.',
});
