/**
 * PrintTransport — the seam between Jalsa's decisions and a physical device.
 *
 * WHAT A TRANSPORT IS ALLOWED TO KNOW
 *   Bytes, and where to put them. That is the whole of it. It receives a stream that is already
 *   encoded and a target that is already chosen, and it answers one question: did the bytes reach
 *   the thing. It does not know what a KOT is, what a station is, which categories route where, or
 *   that a `print_job` table exists.
 *
 * WHAT IT IS STRUCTURALLY INCAPABLE OF
 *   Choosing a printer. `send` takes the target it is given; there is no list to pick from, no
 *   fallback parameter, and no way to return "I used a different one". A transport that finds its
 *   device unreachable says so and stops. Jalsa's retry and "print elsewhere" already exist for
 *   what happens next, and they are operated by a person looking at a screen, not by a process in
 *   a cupboard guessing.
 *
 *   That is not a convention to be remembered — it is the shape of the interface. There is nowhere
 *   in `TransportResult` to name a printer.
 *
 * WHY RESULTS ARE RETURNED AND NOT THROWN
 *   A printer being switched off is an ordinary Tuesday, not an exceptional condition. Modelled as
 *   an exception it reaches a `catch` that also catches programming errors, and the two get the
 *   same log line and the same retry. Modelled as a value, the caller must handle it to compile.
 *   Transports throw only for faults that are genuinely not about printing — and the bridge loop,
 *   when it exists, will treat a throw as a bug rather than as paper not arriving.
 */

/**
 * Where this stream is going, in terms the local machine understands.
 *
 * Every field is OPAQUE to the transport: it labels and addresses, it never decides. `machineId`
 * and `jobId` exist so a log line and an artifact filename can be traced back to a row somebody is
 * looking at, not so a transport can reason about them.
 */
export interface TransportTarget {
  /** Jalsa's `printer.machine_id`. Carried for tracing; never interpreted. */
  machineId: string;
  /** The `print_job.id` this stream belongs to. Carried for tracing and naming. */
  jobId: string;
  /**
   * Whatever THIS transport needs to reach the device — a directory for a file sink, a Windows
   * queue name for the spooler, a host for some future LAN transport. Its meaning belongs to the
   * transport implementation and to the bridge's local configuration, which is why the queue name
   * never entered Jalsa's schema: it is a property of one PC, not of the restaurant.
   */
  destination: string;
}

/** The bytes reached the device, or whatever this transport counts as the device. */
export interface TransportOk {
  ok: true;
  /** What was actually accepted. A short write is not a success. */
  bytesSent: number;
  /** One line for the log — which transport, and where it put them. */
  detail: string;
}

/** The bytes did not reach it, and why. */
export interface TransportFailure {
  ok: false;
  /** Plain enough to survive into `print_job.last_error`, which a person reads on a screen. */
  error: string;
  /**
   * Whether trying the SAME target again could plausibly work — a printer switched off, versus a
   * destination that does not exist.
   *
   * DIAGNOSTIC ONLY. It never selects anything. Jalsa decides what happens to a failed job, and
   * this flag exists so the sentence it shows a person can be the useful one.
   */
  retryable: boolean;
}

export type TransportResult = TransportOk | TransportFailure;

export interface PrintTransport {
  /** Identifies the implementation in logs and configuration. */
  readonly name: string;

  /**
   * Put these exact bytes on that target.
   *
   * The stream is already encoded — `src/lib/escpos.ts` did that, and is the only encoder in this
   * system. A transport that re-encoded, re-wrapped or appended anything would silently disagree
   * with the golden-byte tests that are the only proof the ticket is right.
   */
  send(bytes: Uint8Array, target: TransportTarget): Promise<TransportResult>;
}

/** Narrowing helpers, so call sites read as prose rather than as property checks. */
export const succeeded = (r: TransportResult): r is TransportOk => r.ok;
export const failed = (r: TransportResult): r is TransportFailure => !r.ok;
