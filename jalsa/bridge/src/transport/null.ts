import type { PrintTransport, TransportResult, TransportTarget } from './types';

/**
 * NullTransport — a transport that is honestly not attached to anything.
 *
 * WHY THIS EXISTS AND WHY IT FAILS RATHER THAN SUCCEEDS
 *   Phase 1's central defect was a success that nothing had done: `status: 'printed'` written on
 *   the strength of a boolean column, with no device anywhere in the call. The cheapest way to
 *   re-introduce that is a "no-op transport" that returns `ok: true` because nothing went wrong —
 *   and nothing went wrong precisely because nothing happened. So the default transport of a
 *   bridge that has not been configured reports FAILURE, every time, and says why.
 *
 *   It is also the failure path's test double. Every branch downstream of a transport that could
 *   not deliver — the report, the operator's message, the retry — needs something that reliably
 *   does not deliver, and a real printer cannot be relied upon to stay broken.
 *
 * NEVER THROWS
 *   Not for an empty stream, not for a nonsense target, not for anything. A transport's failure is
 *   a value; a throw from one means a bug in the bridge, and this transport must never be the
 *   thing that produces a false positive of that signal.
 */

/** The default sentence, chosen to be readable in `print_job.last_error` by a person on the floor. */
export const NULL_TRANSPORT_REASON =
  'No print transport is configured on this bridge, so nothing was sent.';

export class NullTransport implements PrintTransport {
  readonly name = 'null';

  readonly #reason: string;

  constructor(reason: string = NULL_TRANSPORT_REASON) {
    this.#reason = reason;
  }

  async send(bytes: Uint8Array, target: TransportTarget): Promise<TransportResult> {
    return {
      ok: false,
      error: `${this.#reason} (job ${target.jobId}, ${bytes.length} bytes, printer ${target.machineId})`,
      /**
       * Not retryable, and that is the accurate answer rather than the cautious one. Sending the
       * same bytes to the same nothing produces the same nothing; marking it retryable would have
       * a bridge loop spin on a configuration fault forever and report it as a flaky printer.
       */
      retryable: false,
    };
  }
}
