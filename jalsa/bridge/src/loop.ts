import { DEFAULT_ENCODER, encodeTicket } from '../../src/lib/escpos';
import type { JalsaApi, BridgeJobRef, ReportOutcome } from './api';
import { destinationFor, serves, type BridgeConfig } from './config';
import type { PrintTransport } from './transport/types';

/**
 * loop — poll, claim one, encode it, send it, say what happened. That is the whole program.
 *
 * WHAT THIS LOOP IS STRUCTURALLY INCAPABLE OF
 *   It has three verbs (`list`, `claim`, `report`), one lookup (`machine_id` → a local
 *   destination) and no vocabulary for a printer. There is no branch anywhere below that picks a
 *   different machine, and there is nothing it could say if there were: `report` takes an outcome
 *   and a sentence. A job it cannot serve FAILS; it is never re-pointed. Jalsa's retry and
 *   "print elsewhere" are the answer to that, and they are operated by a person looking at a
 *   screen rather than by a process in a cupboard guessing.
 *
 * WHY A LOSER MUST NOT ENCODE
 *   Two bridges polling one queue is the ordinary case, not the exception. The claim is one
 *   conditional UPDATE and exactly one of them wins it; the loser gets `claimed: false` and
 *   RETURNS — before the encoder, before the transport, before anything touches paper. Every
 *   step after the claim is inside the `if (claimed)`, which is why "exactly one transport" is a
 *   property of the shape of this function rather than of a rule somebody has to remember.
 *
 * WHY IT NEVER WRITES `queued`
 *   A bridge that restarts holding nothing cannot know whether the job it lost was printed a
 *   moment before it died. Re-queueing asserts it was not, and if that assertion is wrong the
 *   round prints twice - the one printing mistake that costs real food. Expiring a stale claim is
 *   the server's sweeper, and it expires to `failed`, in front of a person.
 *
 * WHY THE ENCODER IS IMPORTED AND NOT REIMPLEMENTED
 *   `src/lib/escpos.ts` is a pure module with no npm and no Node dependency, proven byte by byte
 *   in Gate 2. A second encoder on the bridge side would be a second answer to "what does this
 *   ticket look like", and the golden-byte tests would only be guarding one of them.
 */

export type TransportFor = (machineId: string) => PrintTransport | null;

export interface LoopDeps {
  config: BridgeConfig;
  api: JalsaApi;
  transportFor: TransportFor;
  /** Structured, one line per cycle. Optional so a test can read it and a service can pipe it. */
  log?: (line: string) => void;
}

/** What one cycle did. Returned rather than logged so a rung can assert on it. */
export interface CycleOutcome {
  /** Jobs Jalsa offered this bridge. */
  offered: number;
  /** Jobs left after this bridge's own machine filter. */
  eligible: number;
  /** The job this cycle took, or null if it took none. */
  claimedJobId: string | null;
  /** Did this cycle run the encoder? A cycle that lost a race must answer `false`. */
  encoded: boolean;
  bytes: number;
  /** What the transport said, or why it was never asked. */
  transport: 'sent' | 'refused' | 'not-attempted';
  reported: ReportOutcome | null;
  /** One sentence for the log, and for `print_job.last_error` when this cycle failed. */
  note: string;
}

const IDLE: CycleOutcome = {
  offered: 0,
  eligible: 0,
  claimedJobId: null,
  encoded: false,
  bytes: 0,
  transport: 'not-attempted',
  reported: null,
  note: 'Nothing waiting.',
};

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/**
 * The oldest job this bridge can actually serve.
 *
 * The server already filters by the machine ids this bridge asked for. This filters AGAIN,
 * locally, against the destinations this PC really has — because the two lists are maintained in
 * one place but arrive through two hops, and a job printed at a machine this bridge cannot reach
 * is a ticket that silently never appears.
 */
function eligibleJobs(config: BridgeConfig, jobs: readonly BridgeJobRef[]): BridgeJobRef[] {
  return jobs.filter((j) => serves(config, j.printerMachineId));
}

/**
 * One cycle. Never throws for anything that is about printing.
 *
 * A fault talking to Jalsa DOES propagate: it is not a job failure, and reporting a job failed
 * because the network was down would blame the printer for the office.
 */
export async function runCycle(deps: LoopDeps): Promise<CycleOutcome> {
  const { config, api } = deps;

  const offered = await api.list({ machineIds: config.machineIds, limit: config.batchLimit });
  const eligible = eligibleJobs(config, offered);
  if (eligible.length === 0) {
    return { ...IDLE, offered: offered.length, eligible: 0 };
  }

  // Oldest first, which is the order `listBridgeJobs` returns them in and the order a kitchen
  // reads paper in. One per cycle: a bridge that claimed the whole batch would hold jobs it has
  // not started while another bridge sat idle.
  const job = eligible[0] as BridgeJobRef;
  const base: CycleOutcome = { ...IDLE, offered: offered.length, eligible: eligible.length };

  const claim = await api.claim({ jobId: job.id });
  if (!claim.claimed || !claim.job) {
    // Somebody else won, or it was no longer queued. NOTHING below this line runs.
    return { ...base, note: `Job ${job.id} was already taken.` };
  }

  const claimed = claim.job;
  const taken: CycleOutcome = { ...base, claimedJobId: claimed.id };

  const fail = async (note: string): Promise<CycleOutcome> => {
    await api.report({ jobId: claimed.id, outcome: 'failed', error: note });
    return { ...taken, reported: 'failed', note };
  };

  // The job is claimed from here on, so every exit below reports. A claimed job that is simply
  // abandoned sits in `processing` until the sweeper, with no reason written anywhere.
  if (claim.renderError || !claim.payload) {
    return await fail(claim.renderError ?? 'Jalsa returned no ticket for this job.');
  }

  const destination = destinationFor(config, job.printerMachineId);
  const transport = deps.transportFor(job.printerMachineId);
  if (!destination || !transport) {
    // Not a substitution. This bridge says so and stops.
    return await fail(`This bridge does not serve ${job.printerMachineId || 'that machine'}.`);
  }

  let bytes: Uint8Array;
  try {
    bytes = encodeTicket(claim.payload.lines, {
      ...DEFAULT_ENCODER,
      width: claim.payload.width,
      // The full printable width, no left margin, and the font the lines were laid out in
      // (item 7, 25-Sep-2026). `font` is absent from a payload of an older Jalsa: normal.
      area: true,
      ...(claim.payload.font ? { font: claim.payload.font } : {}),
    });
  } catch (cause) {
    // An unmappable character. The encoder refuses rather than printing a '?', and the reason
    // names the codepoint, the line and the column — so it goes through verbatim.
    return { ...(await fail(message(cause))), encoded: true };
  }

  const result = await transport.send(bytes, {
    machineId: job.printerMachineId,
    jobId: claimed.id,
    destination,
  });

  if (!result.ok) {
    const failed = await fail(result.error);
    return { ...failed, encoded: true, bytes: bytes.length, transport: 'refused' };
  }

  await api.report({ jobId: claimed.id, outcome: 'printed' });
  return {
    ...taken,
    encoded: true,
    bytes: result.bytesSent,
    transport: 'sent',
    reported: 'printed',
    note: result.detail,
  };
}

export interface LoopOptions {
  /** How many cycles to run. A service passes Infinity; every test passes a number. */
  cycles: number;
  /** Injected so a test does not actually wait, and so a service can be interrupted. */
  sleep: (ms: number) => Promise<void>;
  /** Checked before every cycle. A service wires this to its shutdown signal. */
  stopping?: () => boolean;
}

/**
 * The bounded loop.
 *
 * BACKOFF IS NOT AN OPTIMISATION HERE. This process runs on a PC in a kitchen, often the same one
 * somebody is using. An idle queue doubles the wait up to the configured ceiling; the first job
 * that appears resets it, so a busy service polls at its configured interval and a closed
 * restaurant polls once a minute.
 */
export async function runLoop(deps: LoopDeps, opts: LoopOptions): Promise<CycleOutcome[]> {
  const outcomes: CycleOutcome[] = [];
  let wait = deps.config.pollMs;

  for (let i = 0; i < opts.cycles; i += 1) {
    if (opts.stopping?.()) break;

    const outcome = await runCycle(deps);
    outcomes.push(outcome);
    deps.log?.(
      `cycle=${i} offered=${outcome.offered} eligible=${outcome.eligible} job=${outcome.claimedJobId ?? '-'} ` +
        `encoded=${outcome.encoded} transport=${outcome.transport} reported=${outcome.reported ?? '-'} ${outcome.note}`
    );

    wait = outcome.claimedJobId
      ? deps.config.pollMs
      : Math.min(wait * 2, deps.config.maxBackoffMs);

    if (i + 1 < opts.cycles) await opts.sleep(wait);
  }

  return outcomes;
}
