/**
 * test-print — the smallest ticket that proves a machine is wired up, laid out on its own paper.
 *
 * WHY IT IS BUILT HERE AND NOT IN THE COMPONENT
 *   The same reason `print-template.ts` exists: a thermal printer has character positions, not
 *   pixels, and a ticket composed in CSS wraps on word boundaries no printer has heard of. This
 *   returns the lines a machine would be handed, at that machine's own column count, so the test
 *   ticket obeys the same grid as every real one — and so it can be checked without a browser.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   It does not read a bill, a round or a menu. The whole point of a connectivity test is that it
 *   works at four in the afternoon with the restaurant empty: needing an order to test a printer
 *   is how a printer goes untested until the first ticket is lost.
 */

import { centre, PAPER, separatorLine, wrap, type PaperWidth, type TemplateConfig } from './print-template';

export interface TestPrintTarget {
  name: string;
  station: string;
  paperMm: number;
  connection: string;
  address: string;
}

/**
 * The ticket, as lines.
 *
 * `restaurantName` is passed in rather than read: this module has no business knowing where the
 * restaurant's identity lives, and the caller already holds it. Empty is allowed and prints
 * nothing — an unconfigured restaurant gets a ticket without a header rather than somebody
 * else's name, which is the same rule the bill and the KOT follow.
 */
export function buildTestTicket(input: {
  restaurantName: string;
  target: TestPrintTarget;
  at: Date;
}): string[] {
  const width: PaperWidth = input.target.paperMm === 58 ? '58' : '80';
  const cols = PAPER[width].cols.normal;

  /* A separator needs a config to know which character to draw. Only these two fields are read,
     so the test ticket does not depend on whichever template the owner last saved — a
     connectivity test that changed shape because a bill template changed would be testing the
     wrong thing. */
  const rule = separatorLine({ width, separator: 'dash' } as TemplateConfig, cols);

  const lines: string[] = [];
  const name = input.restaurantName.trim();

  lines.push(rule);
  /* WRAPPED, NOT CENTRED-AND-HOPED. "Jalsa Hospitality Private Limited" is 33 characters and a
     58 mm roll has 32 — centring alone produced a line one character too wide, and on a thermal
     printer an over-width line does not wrap, it disappears. The 58 mm machine is also the one
     most likely to be misconfigured, so it is the one the test ticket must not lose. */
  if (name) for (const part of wrap(name.toUpperCase(), cols)) lines.push(centre(part, cols));
  lines.push(centre('TEST PRINT', cols));
  lines.push(rule);
  lines.push('');

  /* Label above value rather than beside it. A printer called "TVS RP 3160 Gold — Tandoor
     station" is 33 characters and a 58 mm roll has 32, so a `left … right` pair would push the
     name off the paper on the exact machine most likely to be misconfigured. */
  const field = (label: string, value: string): void => {
    if (!value) return;
    lines.push(`${label}:`);
    // Same reason as the header: a printer called "TVS RP 3160 Gold — Tandoor station" is 34
    // characters wide and would vanish on the machine it is naming.
    for (const part of wrap(value, cols)) lines.push(part);
    lines.push('');
  };

  field('Printer', input.target.name);
  field('Station', input.target.station);
  field('Paper', `${input.target.paperMm} mm`);
  field('Connection', input.target.connection);
  field('Address', input.target.address);

  lines.push(rule);
  for (const part of wrap('If you can read this, this machine is wired up.', cols)) {
    lines.push(centre(part, cols));
  }
  lines.push('');
  lines.push(
    centre(
      `${input.at.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${input.at.toLocaleTimeString(
        'en-IN',
        { hour: 'numeric', minute: '2-digit', hour12: true }
      )}`,
      cols
    )
  );
  lines.push(rule);

  return lines;
}

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
 * THE STRONGEST TRUE SENTENCE, AND NOT ONE WORD STRONGER. Nothing in this deployment opens a
 * socket to a thermal printer — no ESC/POS, no port 9100, no WebUSB, no bridge, no agent — so
 * "printed" and even "sent" would both be inventions. The job is real, it is recorded against
 * this machine, and it is visible in History. That is what this says, and it says the rest too,
 * because an owner who thinks paper is coming will go and look for it.
 */
export const TEST_PRINT_QUEUED = (printerName: string): string =>
  `Test ticket queued for ${printerName}. Jalsa has no print service connected yet, so nothing has left the server — the job is in History.`;

/** The standing note that sits beside the buttons, so nobody has to go and find it. */
export const TEST_PRINT_NOTE =
  'A test queues a real job against that one machine and records it in History. No paper will come out until a print service is connected — nothing in this deployment can open a connection to a thermal printer yet.';
