import { ApiError, type Assignment, type PairedApi } from './api';
import type { BridgeConfig, TransportKind } from './config';
import { runCycle, type CycleOutcome } from './loop';
import type { PairedConfig } from './paired-config';
import type { PrintTransport } from './transport/types';
import type { PrinterDiscovery } from './windows/discovery';

/**
 * service — a paired computer, running unattended, for as long as the PC is on.
 *
 * THE SAME CYCLE, A DIFFERENT SOURCE OF CONFIGURATION
 *   Every ticket still goes through `runCycle` from Gate 4, unchanged: list → claim → TicketLine[]
 *   → `escpos.ts` → transport → report. What differs is only where the `machine_id → destination`
 *   lookup comes from. In environment mode a developer typed it; here the owner chose it in Jalsa
 *   and `sync` hands it down. The lookup is rebuilt from that answer and nothing else — this file
 *   has no code that could invent, widen or reorder it.
 *
 * WHAT MAKES IT SURVIVE A KITCHEN
 *   - A network fault is NOT fatal. The Gate 4 loop lets it propagate (correctly: it is not a
 *     job failure). Here it is caught, logged, and retried with backoff, and the mapping is
 *     re-synced before the next cycle — so a router rebooting at 7 p.m. costs a minute, not a
 *     visit from somebody who knows what a Scheduled Task is.
 *   - A 401 means the owner revoked this computer, or it was paired again elsewhere. It is logged
 *     in the owner's words and the bridge keeps checking slowly, never printing, so pairing it
 *     again brings it back without a reinstall.
 *   - The Scheduled Task restarts the process if it dies; everything it needs is on disk.
 *
 * IT STILL CANNOT CHOOSE A PRINTER. A job whose machine is not in the handed-down mapping is never
 * listed for this computer (Jalsa filters server-side) and, were it offered, `runCycle` would fail
 * it by name rather than find it another home.
 */

export type ServiceState = 'starting' | 'connected' | 'offline' | 'unpaired';

export interface ServiceStatus {
  state: ServiceState;
  at: string;
  label: string;
  printers: number;
  note: string;
}

export interface ServiceDeps {
  paired: PairedConfig;
  api: PairedApi;
  discover: PrinterDiscovery;
  transport: PrintTransport;
  transportKind: TransportKind;
  spoolDir: string;
  hostname: string;
  bridgeVersion: string;
  log: (fields: Record<string, unknown>) => void;
  /** Where the installer looks to say "connected". Best effort; a failure to write is ignored. */
  writeStatus?: (status: ServiceStatus) => Promise<void>;
  now?: () => Date;
}

export interface ServiceOptions {
  sleep: (ms: number) => Promise<void>;
  stopping?: () => boolean;
  /** A service passes Infinity; a spec passes a number. */
  iterations: number;
  /** Busy poll interval. */
  pollMs?: number;
  /**
   * Ceiling an IDLE queue backs off to. Deliberately far lower than Gate 4's 60 s default: a new
   * round waiting a minute for an idle bridge to wake is a round the kitchen hears about late.
   * One small request every ten seconds is nothing to a PC or to Jalsa.
   */
  maxBackoffMs?: number;
  /** Ceiling while Jalsa cannot be reached. Here patience costs nothing. */
  errorBackoffMs?: number;
  syncEveryMs?: number;
}

/** Words the log and the status file use. The owner's own sentences live in Jalsa. */
export const SERVICE_NOTES = {
  unpaired: 'This computer is not connected to this Jalsa restaurant. Pair it again from Jalsa → Printers.',
  offline: 'Jalsa could not be reached. Printing resumes by itself when the connection comes back.',
  noPrinters: 'Connected. No printer has been chosen for this computer yet — choose one in Jalsa → Printers.',
} as const;

/**
 * The lookup, rebuilt from what Jalsa said. `machine_id → queue`, and nothing else.
 *
 * A machine id Jalsa listed twice keeps its FIRST queue; there is no rule here that could prefer
 * one queue over another, because there is no rule here at all.
 */
export function configFromAssignments(input: {
  paired: PairedConfig;
  assignments: readonly Assignment[];
  transport: TransportKind;
  spoolDir: string;
  pollMs: number;
  maxBackoffMs: number;
}): BridgeConfig {
  const destinations: Record<string, string> = {};
  for (const a of input.assignments) {
    if (!a.machineId || !a.queueName) continue;
    if (!Object.prototype.hasOwnProperty.call(destinations, a.machineId)) destinations[a.machineId] = a.queueName;
  }
  return {
    apiUrl: input.paired.apiUrl,
    token: input.paired.token,
    label: input.paired.label,
    machineIds: Object.keys(destinations).sort(),
    destinations,
    pollMs: input.pollMs,
    maxBackoffMs: input.maxBackoffMs,
    batchLimit: 20,
    transport: input.transport,
    spoolDir: input.spoolDir,
    humanReadable: false,
    spoolTimeoutMs: 30_000,
  };
}

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export interface ServiceIteration {
  state: ServiceState;
  synced: boolean;
  cycle: CycleOutcome | null;
  waitMs: number;
}

export async function servePaired(deps: ServiceDeps, opts: ServiceOptions): Promise<ServiceIteration[]> {
  const pollMs = opts.pollMs ?? 3_000;
  const maxBackoffMs = opts.maxBackoffMs ?? 10_000;
  const errorBackoffMs = opts.errorBackoffMs ?? 60_000;
  const syncEveryMs = opts.syncEveryMs ?? 30_000;
  const now = deps.now ?? (() => new Date());

  let config: BridgeConfig | null = null;
  let lastSync = 0;
  let wait = pollMs;
  let state: ServiceState = 'starting';
  const history: ServiceIteration[] = [];

  const status = async (next: ServiceState, note: string, printers: number): Promise<void> => {
    const changed = next !== state;
    state = next;
    if (changed) deps.log({ event: `bridge.${next}`, note });
    await deps.writeStatus?.({ state: next, at: now().toISOString(), label: deps.paired.label, printers, note }).catch(() => undefined);
  };

  for (let i = 0; i < opts.iterations; i += 1) {
    if (opts.stopping?.()) break;
    let synced = false;
    let cycle: CycleOutcome | null = null;

    try {
      // With nothing mapped yet the owner is probably at the Printers screen choosing one, so the
      // answer is checked as often as the idle poll rather than every half minute.
      const due = config && config.machineIds.length ? syncEveryMs : Math.min(syncEveryMs, maxBackoffMs);
      if (!config || now().getTime() - lastSync >= due) {
        const found = await deps.discover();
        if (!found.ok) deps.log({ event: 'bridge.discovery-failed', note: found.error });
        const answer = await deps.api.sync({
          ...(found.ok ? { printers: found.printers } : {}),
          hostname: deps.hostname,
          bridgeVersion: deps.bridgeVersion,
        });
        config = configFromAssignments({
          paired: deps.paired,
          assignments: answer.assignments,
          transport: deps.transportKind,
          spoolDir: deps.spoolDir,
          pollMs,
          maxBackoffMs,
        });
        lastSync = now().getTime();
        synced = true;
        await status(
          'connected',
          config.machineIds.length ? `Connected. Printing for ${config.machineIds.join(', ')}.` : SERVICE_NOTES.noPrinters,
          config.machineIds.length
        );
      }

      if (config.machineIds.length > 0) {
        const current = config;
        cycle = await runCycle({
          config: current,
          api: deps.api,
          // Lookup BY the job's own machine id. A machine not in the mapping yields null, and the
          // loop fails that job rather than finding it another home.
          transportFor: (machineId) =>
            Object.prototype.hasOwnProperty.call(current.destinations, machineId) ? deps.transport : null,
        });
        if (cycle.claimedJobId) {
          deps.log({
            event: 'bridge.cycle',
            job: cycle.claimedJobId,
            transport: cycle.transport,
            reported: cycle.reported,
            note: cycle.note,
          });
        }
      }
      wait = cycle?.claimedJobId ? pollMs : Math.min(Math.max(wait, pollMs) * 2, maxBackoffMs);
    } catch (cause) {
      // Re-sync before the next ticket, whatever went wrong: the mapping may have changed while
      // this computer could not hear about it.
      config = null;
      if (cause instanceof ApiError && cause.status === 401) {
        await status('unpaired', SERVICE_NOTES.unpaired, 0);
        wait = errorBackoffMs;
      } else {
        deps.log({ event: 'bridge.error', note: message(cause) });
        await status('offline', SERVICE_NOTES.offline, 0);
        wait = Math.min(Math.max(wait, pollMs) * 2, errorBackoffMs);
      }
    }

    history.push({ state, synced, cycle, waitMs: wait });
    if (i + 1 < opts.iterations && !opts.stopping?.()) await opts.sleep(wait);
  }
  return history;
}
