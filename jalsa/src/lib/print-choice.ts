/**
 * Print choice — whether a new KOT, or the invoice of a bill just paid, prints by itself or asks
 * first (22-Oct-2026, requests/2026-10-22-kot-and-invoice-print-switches.md).
 *
 * TWO SWITCHES, ONE SETTING KEY, ONE SET OF MACHINES
 *   `kotEnabled` and `invoiceEnabled` live in the `print` setting beside `splitByFoodType` and the
 *   templates, written by `writeSetting` (grant `set.printer`). `writeSetting` MERGES, so saving
 *   one switch never touches the other. Neither switch chooses a machine: a KOT and an invoice go
 *   where routing already sends them - one printer with both roles, in a one-printer restaurant.
 *
 * WHY BOTH DEFAULT TO ON
 *   Every restaurant printed both automatically before the switches existed. A missing key must
 *   keep doing exactly that; only an owner's explicit OFF changes anything.
 *
 * WHAT "OFF" MEANS
 *   Nothing is queued by the round or the payment. The screen that placed the round or recorded
 *   the payment asks once; "Print" is a one-time action on THAT ticket and writes no setting.
 *
 * Shared by the server and the screens, so it imports nothing from either.
 */

export interface PrintSwitches {
  kotEnabled: boolean;
  invoiceEnabled: boolean;
}

export const PRINT_SWITCH_DEFAULTS: PrintSwitches = { kotEnabled: true, invoiceEnabled: true };

/** Only an explicit `false` turns automatic printing off - a missing or odd value keeps it on. */
export function printsAutomatically(print: Record<string, unknown> | null | undefined, kind: 'KOT' | 'Invoice'): boolean {
  return (print ?? {})[kind === 'KOT' ? 'kotEnabled' : 'invoiceEnabled'] !== false;
}

/**
 * What became of the print a round or a payment would have made.
 *   queued  sent to a printer, as before the switches existed;
 *   ask     the switch is off: nothing was sent, and the screen asks;
 *   failed  it should have printed and could not be sent - the round or the payment is saved
 *           all the same, and `printProblem` says why in words.
 */
export type PrintOutcome = 'queued' | 'ask' | 'failed';

/** The one-time Print, answered: sent now, or already sent by an earlier tap (nothing new). */
export interface PrintOnceResult {
  outcome: 'queued' | 'already';
  /** Where it went - more than one machine when the round routes to more than one station. */
  printerName: string;
  /** Sent, but part of it found no machine to go to (its ticket is on the record as failed). */
  printProblem?: string;
}

/* The words the request gave, verbatim. */
export const KOT_ASK = {
  title: 'Do you want to print this KOT?',
  print: 'Print KOT',
  skip: 'Skip',
} as const;

export const INVOICE_ASK = {
  title: 'Payment successful. Do you want to print the invoice?',
  print: 'Print Invoice',
  skip: 'Skip',
} as const;

export const SWITCH_LABEL = {
  kot: 'Enable KOT Printing',
  invoice: 'Enable Invoice Printing',
} as const;

/**
 * A round that was never sent to a printer: KOT printing was off when it was placed, and nobody
 * has printed it since. Its `print_status` is `cancelled` with no job of its own (a job-level
 * `cancelled` means "sent elsewhere" and always sits beside another job, so the two never meet).
 */
export function neverPrinted(kot: { printStatus: string; printJobs: readonly unknown[] }): boolean {
  return kot.printStatus === 'cancelled' && kot.printJobs.length === 0;
}
