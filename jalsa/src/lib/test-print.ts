/**
 * test-print — whether a machine can be tested, and what the owner is told afterwards.
 *
 * MERGED 22-Sep-2026. This file arrived from `main` carrying a `buildTestTicket()` that laid out
 * a test ticket on its own grid, written for a deployment where nothing could send bytes to a
 * printer. On this branch something can: a test print is an ordinary `print_job`, composed by
 * `buildTicket` through `test-ticket.ts`, encoded by `escpos.ts` and carried by the bridge.
 *
 *   `buildTestTicket` was therefore REMOVED, not kept alongside. Two things that lay out a test
 *   ticket is the defect this repository's own rule names — one blessed idiom per concern — and
 *   the one that survives is the one whose output reaches paper. Its careful thinking was not
 *   wasted: the reason it wrapped rather than centred (a 33-character printer name on a
 *   32-column roll does not wrap on a thermal head, it disappears) is exactly what the width-check
 *   line in `TEST_TICKET_ITEMS` exists to expose, and what Gate 7 row 11 checks on paper.
 *
 * WHAT SURVIVES, AND WHY EACH PIECE EARNED IT
 *   `testPrintBlocker` — one definition of "is this machine testable", shared by the button and
 *   the server. Two copies would eventually disagree, and the disagreement would be a button that
 *   does nothing.
 *
 *   The two sentences — because what an owner is told after pressing a button is a promise, and
 *   both of these had to be rewritten when the promise changed. See below.
 */

/**
 * Why a test could not even be queued, or null when it can.
 *
 * SEPARATE FROM THE SEND so the button can explain itself before it is pressed and the server can
 * refuse the same thing for the same reason. Two copies of "is this printer testable" would
 * eventually disagree, and the disagreement would be a button that does nothing.
 */
export function testPrintBlocker(printer: { enabled: boolean; connection: string; address: string }): string | null {
  if (!printer.enabled) return 'This printer is switched off. Switch it on in Configure first.';
  // A machine with no address is not unreachable — it is unconfigured, and saying so sends the
  // owner to the setting rather than to the kitchen.
  if (printer.connection !== 'USB' && !printer.address.trim()) {
    return 'This printer has no address yet, so there is nowhere to send a test. Add one in Configure.';
  }
  return null;
}

/**
 * What the owner is told after a test job is written.
 *
 * THE STRONGEST TRUE SENTENCE, AND NOT ONE WORD STRONGER.
 *
 * REWRITTEN 22-Sep-2026, because the previous one stopped being true. It read: *"Jalsa has no
 * print service connected yet, so nothing has left the server — the job is in History."* That was
 * accurate on `main`, where no ESC/POS, no transport and no bridge existed. Gates 2 to 6 built
 * all three, so leaving the sentence alone would have been the more dangerous kind of stale copy:
 * one that tells an owner not to go and look for paper that is, in fact, coming.
 *
 * It still does not say "printed". A queued job prints when a bridge collects it, and whether one
 * is running on that PC is not something the server can see. Saying where to look is the strongest
 * thing that is true from here.
 */
export const TEST_PRINT_QUEUED = (printerName: string): string =>
  `Test ticket queued for ${printerName}. It prints when the bridge on that PC collects it — the outcome appears in History.`;

/**
 * The standing note that sits beside the buttons, so nobody has to go and find it.
 *
 * Rewritten alongside the sentence above, and for the same reason. What it must still convey is
 * the one thing an owner cannot see from this screen: a queued job waits rather than fails when
 * no bridge is running, so silence is not the same as a broken printer.
 */
export const TEST_PRINT_NOTE =
  'A test queues a real job against that one machine and records it in History. It travels the same path a kitchen ticket does — composed, encoded and carried by the bridge on that PC. If no bridge is collecting for that machine, the job waits in the queue instead of printing.';
