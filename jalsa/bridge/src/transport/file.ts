import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

import type { PrintTransport, TransportResult, TransportTarget } from './types';

/**
 * FileTransport — the device stands in as a directory.
 *
 * WHAT IT IS FOR
 *   Everything upstream of the printer can be finished and proven without a printer: the claim,
 *   the encode, the report, the retry. This transport is what makes that true. It takes the exact
 *   bytes a TVS RP3160 would have eaten and puts them on disk, so the only thing still unproven
 *   on the day hardware arrives is the hardware.
 *
 * THE `.bin` IS THE ARTIFACT OF RECORD
 *   It is byte-for-byte what `encodeTicket` produced — no BOM, no trailing newline, no text mode,
 *   no re-encoding. That is the whole point of the file: `cmp` it against a golden stream, or
 *   `copy /b` it to a real queue later and get the same paper. The `.txt` beside it is a reading
 *   convenience and is NEVER read back by anything.
 *
 * WHERE IT WRITES, AND WHO DECIDES
 *   The root directory comes from THIS MACHINE'S configuration and from nowhere else. A job cannot
 *   name a directory; `target.destination` names only a folder WITHIN that root — the file sink's
 *   equivalent of a queue name — and a destination that tries to climb out of it (`..`, a
 *   separator, an absolute path) is refused as a failure rather than obeyed. A print job arriving
 *   over the network deciding where bytes land on a restaurant's PC is a different kind of bug
 *   from a printer being switched off, and it should never be reachable.
 *
 * IT STILL CANNOT CHOOSE A PRINTER
 *   Same as every transport: one target in, one verdict out. A write that fails is reported as a
 *   failure to the job it was given. It is never re-attempted somewhere else.
 */

export interface FileTransportConfig {
  /**
   * The root every artifact lands under. Bridge configuration, read once at startup — not a value
   * that arrives with a job.
   */
  directory: string;
  /**
   * Also write the `.txt` rendering beside each `.bin`. On during development, where somebody is
   * reading the tickets; off wherever the bytes are the only thing that matters.
   */
  humanReadable: boolean;
}

/**
 * One path segment, or nothing.
 *
 * Deliberately a whitelist. A blacklist of `..` and `/` misses `..\` on Windows, misses `C:`,
 * misses a NUL, and misses whatever the next platform invents; a whitelist misses only characters
 * nobody needs in a job id or a queue label.
 */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

const unsafe = (value: string): boolean => !SAFE_SEGMENT.test(value) || value === '.' || value === '..';

/**
 * Bytes as something a person can read, without pretending to understand ESC/POS.
 *
 * Printable ASCII passes through and LF ends a line. EVERY other byte is printed as `<1b>` — this
 * function does not parse commands, does not know that `1B 40` is a reset, and must not start:
 * a renderer that interpreted the stream could disagree with the encoder, and then the readable
 * file would be quietly lying about the file next to it. Hex is never wrong.
 */
export function readable(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    if (byte === 0x0a) out += '\n';
    else if (byte >= 0x20 && byte <= 0x7e) out += String.fromCharCode(byte);
    else out += `<${byte.toString(16).padStart(2, '0')}>`;
  }
  return out;
}

export class FileTransport implements PrintTransport {
  readonly name = 'file';

  readonly #config: FileTransportConfig;

  constructor(config: FileTransportConfig) {
    this.#config = config;
  }

  async send(bytes: Uint8Array, target: TransportTarget): Promise<TransportResult> {
    if (unsafe(target.destination)) {
      return {
        ok: false,
        error: `FileTransport refused destination ${JSON.stringify(target.destination)}: a destination names one folder under the configured directory, not a path.`,
        // Nothing about trying again changes a malformed destination.
        retryable: false,
      };
    }
    if (unsafe(target.jobId)) {
      return {
        ok: false,
        error: `FileTransport refused job id ${JSON.stringify(target.jobId)}: it is used as a filename and is not a safe path segment.`,
        retryable: false,
      };
    }

    const root = resolve(this.#config.directory);
    const folder = join(root, target.destination);

    // Belt and braces. `unsafe()` should already make this unreachable; if a future edit widens
    // the whitelist, this is the assertion that notices rather than the filesystem.
    if (folder !== root && !folder.startsWith(root + sep)) {
      return {
        ok: false,
        error: `FileTransport refused to write outside ${root}.`,
        retryable: false,
      };
    }

    const binary = join(folder, `${target.jobId}.bin`);

    try {
      await mkdir(folder, { recursive: true });
      // A Uint8Array is written as its exact bytes. No encoding argument, deliberately: passing
      // one makes Node treat the payload as text, and a ticket is not text.
      await writeFile(binary, bytes);

      // What landed, not what we meant to land. `writeFile` resolving is not by itself evidence
      // that the bytes are all there — a full disk has been known to produce both.
      const written = await stat(binary);
      if (written.size !== bytes.length) {
        return {
          ok: false,
          error: `FileTransport wrote ${written.size} of ${bytes.length} bytes to ${binary}.`,
          retryable: true,
        };
      }

      if (this.#config.humanReadable) {
        await writeFile(join(folder, `${target.jobId}.txt`), readable(bytes), 'utf8');
      }

      return {
        ok: true,
        bytesSent: written.size,
        detail: `file: wrote ${written.size} bytes to ${binary} for ${target.machineId}`,
      };
    } catch (cause) {
      // An unwritable directory is an ordinary operational fault here, the same class as a printer
      // being switched off, so it is a value and not a throw. See types.ts.
      return {
        ok: false,
        error: `FileTransport could not write ${binary}: ${cause instanceof Error ? cause.message : String(cause)}`,
        retryable: true,
      };
    }
  }
}
