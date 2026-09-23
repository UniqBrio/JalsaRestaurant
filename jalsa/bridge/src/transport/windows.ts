import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PrintTransport, TransportResult, TransportTarget } from './types';

/**
 * WindowsSpoolerTransport — bytes into the Windows print queue, and nothing more than that.
 *
 * WHAT IT HONESTLY PROVES, AND WHAT IT DOES NOT
 *   A success here means THE SPOOLER ACCEPTED THE JOB. It does not mean paper came out, that the
 *   roll was loaded, or that the printer was even switched on — Windows queues for an offline
 *   printer perfectly happily. No spooler-based transport can promise more than this, and the
 *   honest thing is to say so in the word `detail` carries rather than to let "printed" quietly
 *   mean something larger than it does. Paper is Gate 7, on a real RP3160.
 *
 * WHY `copy /b` AND NOT A NATIVE BINDING
 *   The obvious alternative is `winspool.drv` through a native addon. That means a compiler
 *   toolchain on a restaurant's PC, a rebuild on every Node upgrade, and a binary nobody in this
 *   project can read. `copy /b <file> <share>` is the documented way to put RAW bytes into a
 *   Windows queue, it ships with the operating system, and it returns an exit code. The cost is
 *   one prerequisite — the printer must be shared — and that cost is written down in the runbook
 *   rather than discovered on a Friday.
 *
 *   `/b` is load-bearing. Without it `copy` runs in text mode, stops at the first 0x1A, and
 *   translates line endings — which on an ESC/POS stream means a truncated ticket that still
 *   prints something.
 *
 * WHY THE COMMAND IS INJECTED
 *   Everything interesting about this transport — a non-zero exit, a timeout, a queue that does
 *   not exist — has to be executable somewhere other than Windows, or it is tested nowhere. The
 *   rule lives here; the process spawn is `windowsCopyCommand` below and is swapped for a fake in
 *   the spec. A transport whose failure paths only run on hardware has no failure paths.
 *
 * IT STILL CANNOT CHOOSE A PRINTER. Same as every transport: one target in, one verdict out.
 */

/** What running the spooler command produced. A value, never an exception. */
export interface SpoolerRun {
  /** Process exit code. Null when the process was killed. */
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type SpoolerCommand = (input: {
  file: string;
  destination: string;
  timeoutMs: number;
}) => Promise<SpoolerRun>;

export interface WindowsSpoolerConfig {
  /** How bytes reach the queue. Swapped for a fake in tests. */
  command: SpoolerCommand;
  /** Where the raw stream is staged before being handed over. */
  tempDir: string;
  /** A hung `copy` must not wedge the loop. */
  timeoutMs: number;
  /**
   * Which destinations this command can be trusted with (23-Sep-2026). Omitted — every Gate 5
   * caller — it is the share/UNC whitelist below, because `copy /b` puts the destination on a
   * `cmd.exe` command line. The queue command (`windows-queue.ts`) passes the destination as an
   * environment variable instead, so it supplies its own, wider rule for real printer names.
   */
  destination?: { accepts: (destination: string) => boolean; refusal: string };
}

/**
 * A Windows print-queue name this transport will accept.
 *
 * A whitelist, deliberately. The destination reaches a command line, and while the arguments are
 * passed as an array rather than a string, `cmd.exe` still parses them — so the safe move is to
 * refuse anything that is not plainly a share name or a UNC path. Quotes, ampersands, pipes,
 * carets, newlines and redirection characters have no business in a printer name.
 */
const QUEUE = /^(\\\\[A-Za-z0-9._-]+\\[A-Za-z0-9._$ -]+|[A-Za-z0-9._$ -]+)$/;

const unusable = (destination: string): boolean =>
  destination.length === 0 || destination.length > 200 || !QUEUE.test(destination);

/**
 * The real command: stage the bytes, hand the file to the spooler, delete the file.
 *
 * Refuses outright anywhere that is not Windows. A `copy /b` on Linux would find no `cmd.exe` and
 * fail with a confusing spawn error; saying which platform this needs is more useful than the
 * operating system's opinion about a missing binary.
 */
export const windowsCopyCommand: SpoolerCommand = ({ file, destination, timeoutMs }) =>
  new Promise<SpoolerRun>((resolve) => {
    if (process.platform !== 'win32') {
      resolve({
        code: null,
        stdout: '',
        stderr: `The Windows spooler transport needs Windows; this host is ${process.platform}.`,
        timedOut: false,
      });
      return;
    }

    const child = spawn('cmd.exe', ['/c', 'copy', '/b', file, destination], {
      windowsHide: true,
      // The arguments are an array, so nothing here is assembled from a string. Combined with the
      // QUEUE whitelist above, a destination cannot carry a second command into cmd.
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}${err.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });

export class WindowsSpoolerTransport implements PrintTransport {
  readonly name = 'windows-spooler';

  readonly #config: WindowsSpoolerConfig;

  constructor(config: WindowsSpoolerConfig) {
    this.#config = config;
  }

  async send(bytes: Uint8Array, target: TransportTarget): Promise<TransportResult> {
    const rule = this.#config.destination;
    if (rule ? !rule.accepts(target.destination) : unusable(target.destination)) {
      return {
        ok: false,
        error: `Windows spooler refused the queue name ${JSON.stringify(target.destination)}: ${rule ? rule.refusal : 'it is not a printer share or a UNC path.'}`,
        retryable: false,
      };
    }
    // The job id becomes a filename. Same reasoning as FileTransport: sanitising would collapse
    // two jobs onto one name and the second would overwrite the first with no error anywhere.
    if (!/^[A-Za-z0-9._-]+$/.test(target.jobId)) {
      return {
        ok: false,
        error: `Windows spooler refused job id ${JSON.stringify(target.jobId)}: it is used as a filename.`,
        retryable: false,
      };
    }

    const staged = join(this.#config.tempDir, `${target.jobId}.prn`);

    try {
      await mkdir(this.#config.tempDir, { recursive: true });
      // No encoding argument. A ticket is not text, and `copy /b` is only half the answer if the
      // file it is handed was written through a text path first.
      await writeFile(staged, bytes);
    } catch (cause) {
      return {
        ok: false,
        error: `Windows spooler could not stage ${staged}: ${cause instanceof Error ? cause.message : String(cause)}`,
        retryable: true,
      };
    }

    let run: SpoolerRun;
    try {
      run = await this.#config.command({
        file: staged,
        destination: target.destination,
        timeoutMs: this.#config.timeoutMs,
      });
    } catch (cause) {
      // The command contract is to RETURN a run. A throw is a bug in the command, not a printing
      // failure — but it must not take the loop down with it.
      return {
        ok: false,
        error: `Windows spooler command failed unexpectedly: ${cause instanceof Error ? cause.message : String(cause)}`,
        retryable: true,
      };
    } finally {
      // Best effort. A staged file left behind is untidy; a failure to delete it is not a
      // printing failure and must never turn a successful job into a failed one.
      await rm(staged, { force: true }).catch(() => undefined);
    }

    if (run.timedOut) {
      return {
        ok: false,
        error: `The Windows spooler did not answer within ${this.#config.timeoutMs} ms for queue ${target.destination}. Nothing can be said about whether it printed.`,
        retryable: true,
      };
    }

    if (run.code !== 0) {
      // A non-zero exit is the whole of the evidence. Reporting success on anything else is the
      // Phase 1 defect - a success nobody performed - arriving one layer further down.
      const said = (run.stderr || run.stdout).trim().split('\n')[0] ?? '';
      return {
        ok: false,
        error: `The Windows spooler refused queue ${target.destination} (exit ${run.code ?? 'killed'})${said ? `: ${said}` : '.'}`,
        retryable: true,
      };
    }

    return {
      ok: true,
      bytesSent: bytes.length,
      // Deliberately worded. The spooler ACCEPTED it. Whether paper came out is not a thing this
      // layer can see, and the sentence must not imply otherwise.
      detail: `windows-spooler: ${bytes.length} bytes accepted by queue ${target.destination} for ${target.machineId}`,
    };
  }
}
