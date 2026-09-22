import type { PaperWidth, TicketLine } from '../../src/lib/print-template';
import type { BridgeConfig } from './config';

/**
 * api — the three things a bridge may ask Jalsa for, as a type it can be handed a fake of.
 *
 * WHY AN INTERFACE AND NOT JUST `fetch`
 *   Every property Gate 4 has to prove — that a loser never encodes, that a machine's jobs stay
 *   on their machine, that a printed job is never processed twice — is a property of the LOOP,
 *   and a loop wired directly to `fetch` can only be tested against a running server with a
 *   database behind it. That is the tier that does not run, and a rung that does not run is a
 *   rung that is not enforcing anything. So the loop takes this interface and the specs hand it
 *   a store that enforces the same conditional-update semantics the real route does.
 *
 * WHAT IS DELIBERATELY ABSENT
 *   There is no `printers()`, no `bill()`, no `menu()`, and `report` has no printer argument.
 *   This interface IS the bridge's entire vocabulary, and rerouting is not a sentence it can say.
 */

/** A job as Jalsa describes it. Every field is read-only to the bridge. */
export interface BridgeJobRef {
  id: string;
  kind: string;
  printerId: string | null;
  printerMachineId: string;
  printerName: string;
  station: string;
  isReprint: boolean;
  attempts: number;
  createdAt: string;
}

/** The ticket, as lines. Never bytes — encoding is the bridge's job and escpos.ts is the encoder. */
export interface TicketPayload {
  lines: TicketLine[];
  width: PaperWidth;
  itemCount: number;
}

export interface ClaimResult {
  claimed: boolean;
  job: BridgeJobRef | null;
  payload: TicketPayload | null;
  /** Set when the job was claimed but its ticket could not be composed. See bridge-payload.ts. */
  renderError: string | null;
}

export type ReportOutcome = 'printed' | 'failed';

export interface JalsaApi {
  list(input: { machineIds: readonly string[]; limit: number }): Promise<BridgeJobRef[]>;
  claim(input: { jobId: string }): Promise<ClaimResult>;
  /* No printer, no station, no routing rule. The report says what happened, never where. */
  report(input: { jobId: string; outcome: ReportOutcome; error?: string }): Promise<{ applied: boolean }>;
}

/** Thrown for transport-level faults talking to Jalsa — not for a job that failed to print. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * The real client.
 *
 * `fetch` and nothing else — no HTTP library, no retry middleware, no Supabase client. The token
 * is a bearer and is the ONLY credential this process holds.
 */
export class HttpJalsaApi implements JalsaApi {
  readonly #config: BridgeConfig;
  readonly #fetch: typeof fetch;

  constructor(config: BridgeConfig, fetchImpl: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetchImpl;
  }

  async #post<T>(payload: Record<string, unknown>): Promise<T> {
    const res = await this.#fetch(this.#config.apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.#config.token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new ApiError(res.status, `Jalsa answered ${res.status} to ${String(payload.action)}.`);
    const json = (await res.json()) as unknown;
    // `ok()` in src/lib/route.ts serialises the payload object itself - there is no envelope.
    // Anything that is not an object is a contract change, not a job failure, and must not be
    // mistaken for one.
    if (json === null || typeof json !== 'object') {
      throw new ApiError(res.status, 'Jalsa returned a body this bridge does not understand.');
    }
    return json as T;
  }

  list(input: { machineIds: readonly string[]; limit: number }): Promise<BridgeJobRef[]> {
    return this.#post<{ jobs: BridgeJobRef[] }>({
      action: 'list',
      machineIds: [...input.machineIds],
      limit: input.limit,
    }).then((d) => d.jobs ?? []);
  }

  claim(input: { jobId: string }): Promise<ClaimResult> {
    return this.#post<ClaimResult>({ action: 'claim', jobId: input.jobId });
  }

  report(input: { jobId: string; outcome: ReportOutcome; error?: string }): Promise<{ applied: boolean }> {
    return this.#post<{ applied: boolean }>({
      action: 'report',
      jobId: input.jobId,
      outcome: input.outcome,
      ...(input.error === undefined ? {} : { error: input.error }),
    });
  }
}
