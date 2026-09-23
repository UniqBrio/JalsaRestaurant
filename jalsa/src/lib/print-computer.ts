import type { Tone } from './status';

/**
 * print-computer — what an owner is told about a printing computer and the printers on it.
 *
 * WHY THIS IS A PURE MODULE
 *   Every sentence below is a translation of a technical fact (a stale heartbeat, a queue Windows
 *   no longer lists, a spooler that did not answer) into something a restaurant owner can act on.
 *   Written inline in a component the translations drift between the card, the test-print result
 *   and the history row. Written here they are one table, executed by a unit spec.
 *
 * WHAT IS NEVER SHOWN
 *   A stack trace, an exit code, a queue path or the word "bridge token". The technical sentence
 *   stays in `print_job.last_error` (History shows it, for whoever is diagnosing) and in the
 *   bridge's own log on the PC.
 */

/** The bridge syncs every 30 s; two missed syncs and a bit is "not running", not a blip. */
export const COMPUTER_STALE_MS = 2 * 60_000;

export type ComputerState = 'connected' | 'not-running' | 'waiting';

export function computerState(lastSeenAt: string | null, now: Date): ComputerState {
  if (!lastSeenAt) return 'waiting';
  return now.getTime() - new Date(lastSeenAt).getTime() <= COMPUTER_STALE_MS ? 'connected' : 'not-running';
}

export const COMPUTER_WORDS: Record<ComputerState, { word: string; tone: Tone }> = {
  connected: { word: 'Connected', tone: 'success' },
  'not-running': { word: 'Not running', tone: 'error' },
  waiting: { word: 'Waiting', tone: 'warning' },
};

/** The owner-readable sentences, by case. Frozen once shipped (the freeze rule). */
export const OWNER_PRINT_MESSAGES = {
  notInstalled: 'Jalsa Print Bridge is not installed on this computer.',
  notRunning: 'Jalsa Print Bridge is not running.',
  notPaired: 'This computer is not connected to this Jalsa restaurant.',
  notConfigured: 'This printer has not been configured for this computer.',
  unavailable: (printer: string): string => `${printer} is not available on this computer.`,
  offline: 'Printer is unavailable. Check that the printer is turned on and connected to this computer.',
  stoppedMidTicket:
    'The printing computer stopped responding while printing. Check the printer before trying again.',
  unprintableCharacter: 'This ticket has a character the printer cannot print. Remove it from the order note and try again.',
  sending: 'Sending test print…',
  completed: 'Test print completed. Check the printer for the paper.',
  generic: 'The ticket did not print. Try again, or open History for the details.',
} as const;

export type DiscoveredStatus = 'ready' | 'offline' | 'error' | 'unknown';

export interface Readiness {
  word: string;
  tone: Tone;
  /** Null when there is nothing to do. Otherwise the one sentence that says what to do. */
  message: string | null;
}

/**
 * Is this Jalsa printer ready to print, and if not, why — in the owner's words.
 *
 * The order of the checks is the order a person would walk to fix it: the setting, then the
 * computer, then the printer on that computer.
 */
export function printerReadiness(input: {
  name: string;
  enabled: boolean;
  mapping: { queueName: string } | null;
  computer: { lastSeenAt: string | null; revoked: boolean } | null;
  discovered: { status: DiscoveredStatus } | null;
  now: Date;
}): Readiness {
  if (!input.enabled) return { word: 'Switched off', tone: 'neutral', message: null };
  if (!input.mapping || !input.computer || input.computer.revoked) {
    return { word: 'Not set up', tone: 'warning', message: OWNER_PRINT_MESSAGES.notConfigured };
  }
  const state = computerState(input.computer.lastSeenAt, input.now);
  if (state === 'waiting') return { word: 'Waiting', tone: 'warning', message: OWNER_PRINT_MESSAGES.notInstalled };
  if (state === 'not-running') return { word: 'Not running', tone: 'error', message: OWNER_PRINT_MESSAGES.notRunning };
  if (!input.discovered) {
    return { word: 'Unavailable', tone: 'error', message: OWNER_PRINT_MESSAGES.unavailable(input.name) };
  }
  if (input.discovered.status === 'offline' || input.discovered.status === 'error') {
    return { word: 'Unavailable', tone: 'error', message: OWNER_PRINT_MESSAGES.offline };
  }
  return { word: 'Ready', tone: 'success', message: null };
}

/**
 * A failed job's `last_error`, as the owner should read it.
 *
 * The inputs are the sentences this system itself writes — the transports, the loop, the
 * sweeper, the encoder — so each pattern names the file it comes from. An unrecognised sentence
 * gets the generic line, never the raw text.
 */
export function ownerPrintError(lastError: string, printerName: string): string {
  const e = lastError.toLowerCase();
  // transport/windows-queue.ts — queue missing on this PC (OpenPrinter failed)
  if (e.includes('no printer named') || e.includes('cannot be found') || e.includes('not a printer share')) {
    return OWNER_PRINT_MESSAGES.unavailable(printerName);
  }
  // transport/windows-queue.ts — Windows reports the printer offline / paper out / error
  if (e.includes('windows reports the printer') || e.includes('did not answer within')) {
    return OWNER_PRINT_MESSAGES.offline;
  }
  // loop.ts — a job for a machine this computer has no mapping for
  if (e.includes('does not serve') || e.includes('not configured for this computer')) {
    return OWNER_PRINT_MESSAGES.notConfigured;
  }
  // bridge-mutations.ts sweepStaleClaims
  if (e.includes('stopped answering')) return OWNER_PRINT_MESSAGES.stoppedMidTicket;
  // escpos.ts EncodeError
  if (e.startsWith('cannot encode')) {
    return OWNER_PRINT_MESSAGES.unprintableCharacter;
  }
  return OWNER_PRINT_MESSAGES.generic;
}

/** A test job's status, as the one line beside the Test Print button. */
export function testPrintProgress(
  job: { status: 'queued' | 'processing' | 'printed' | 'failed'; lastError: string } | null,
  printerName: string
): { text: string; tone: Tone } | null {
  if (!job) return null;
  if (job.status === 'printed') return { text: OWNER_PRINT_MESSAGES.completed, tone: 'success' };
  if (job.status === 'failed') return { text: ownerPrintError(job.lastError, printerName), tone: 'error' };
  return { text: OWNER_PRINT_MESSAGES.sending, tone: 'info' };
}
