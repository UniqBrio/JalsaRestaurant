import { join } from 'node:path';

/**
 * log-file — where an unattended bridge writes, since nobody is watching its console.
 *
 * A Scheduled Task running as SYSTEM has no window; its stdout goes nowhere. So the service writes
 * the same one-line-JSON log to `logs\bridge.log` under the bridge's home, rolled over at a fixed
 * size so a PC left on for a year does not fill its disk with tickets.
 *
 * WRITING A LOG NEVER STOPS A TICKET. Every failure here is swallowed: a full disk is a problem,
 * but a kitchen that stops receiving KOTs because the diagnostic file could not grow is a worse one.
 */

export interface LogFs {
  appendFileSync(path: string, data: string): void;
  statSync(path: string): { size: number };
  renameSync(from: string, to: string): void;
  mkdirSync(path: string, opts: { recursive: true }): unknown;
}

export const LOG_MAX_BYTES = 1_000_000;

export function rotatingLog(fs: LogFs, dir: string, maxBytes = LOG_MAX_BYTES): (line: string) => void {
  const file = join(dir, 'bridge.log');
  const previous = join(dir, 'bridge.1.log');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* best effort */
  }
  return (line: string) => {
    try {
      let size = 0;
      try {
        size = fs.statSync(file).size;
      } catch {
        size = 0;
      }
      if (size + line.length + 1 > maxBytes) fs.renameSync(file, previous);
      fs.appendFileSync(file, `${line}\n`);
    } catch {
      /* never let the log take the bridge down */
    }
  };
}
