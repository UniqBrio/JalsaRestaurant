import { loadConfig, serves, type BridgeConfig } from './config';
import { HttpJalsaApi } from './api';
import { runLoop, type LoopDeps } from './loop';
import { FileTransport } from './transport/file';
import { NullTransport } from './transport/null';
import { WindowsSpoolerTransport, windowsCopyCommand } from './transport/windows';
import { windowsQueueTransport } from './transport/windows-queue';
import { join as joinPath } from 'node:path';
import { discoverCommand, pairCommand, serviceSetup, type CliDeps } from './cli';
import { rotatingLog } from './log-file';
import { bridgeHome, nodeConfigFs } from './paired-config';
import { servePaired } from './service';
import type { PrintTransport } from './transport/types';

/**
 * main — the Windows service, as a process.
 *
 * WHAT STARTUP REFUSES TO DO
 *   Start with a broken configuration. A bridge that comes up, polls forever and prints nothing
 *   is indistinguishable from a bridge that is working in a restaurant with no orders — and it
 *   will be discovered during service, by paper that never arrives. Every problem is reported at
 *   once, by name, and the process exits non-zero.
 *
 * WHY THE PLATFORM CHECK IS HERE AND NOT IN THE TRANSPORT
 *   The transport takes a command and has no opinion about where it runs, which is what makes its
 *   failure paths testable off Windows. Whether THIS host can honour the chosen transport is a
 *   startup question, and answering it at startup means the operator finds out before service
 *   rather than on the first ticket.
 *
 * LOGS ARE ONE LINE OF JSON EACH
 *   A kitchen PC's log is read at a distance, usually by somebody pasting it into a message. One
 *   object per line survives that; a multi-line pretty-printed structure does not.
 */

export interface Clock {
  now(): string;
}

const SYSTEM_CLOCK: Clock = { now: () => new Date().toISOString() };

export type LogLine = Record<string, unknown>;

export const jsonLogger =
  (write: (line: string) => void, clock: Clock = SYSTEM_CLOCK) =>
  (fields: LogLine): void =>
    write(JSON.stringify({ at: clock.now(), ...fields }));

/* ── Choosing the transport ────────────────────────────────────────────── */

export interface TransportChoice {
  ok: true;
  transport: PrintTransport;
}
export interface TransportRefused {
  ok: false;
  problems: string[];
}

/**
 * One transport for this process, chosen from configuration and from nothing else.
 *
 * NOT A ROUTER. It answers "how does this PC talk to a printer", once, at startup. Which printer
 * a job goes to was decided by Jalsa long before this process saw it, and there is no code path
 * here that could revisit that.
 */
export function transportFor(
  config: BridgeConfig,
  platform: NodeJS.Platform = process.platform
): TransportChoice | TransportRefused {
  switch (config.transport) {
    case 'windows':
      if (platform !== 'win32') {
        return {
          ok: false,
          problems: [
            `JALSA_BRIDGE_TRANSPORT is "windows" but this host is ${platform}. Set it to "file" for development, or run the bridge on the PC the printer is attached to.`,
          ],
        };
      }
      return {
        ok: true,
        transport: new WindowsSpoolerTransport({
          command: windowsCopyCommand,
          tempDir: config.spoolDir,
          timeoutMs: config.spoolTimeoutMs,
        }),
      };

    case 'windows-queue':
      if (platform !== 'win32') {
        return {
          ok: false,
          problems: [
            `JALSA_BRIDGE_TRANSPORT is "windows-queue" but this host is ${platform}. Set it to "file" for development, or run the bridge on the PC the printer is attached to.`,
          ],
        };
      }
      return { ok: true, transport: windowsQueueTransport(config.spoolDir, config.spoolTimeoutMs) };

    case 'file':
      return {
        ok: true,
        transport: new FileTransport({ directory: config.spoolDir, humanReadable: config.humanReadable }),
      };

    case 'null':
      return { ok: true, transport: new NullTransport() };

    default: {
      // `loadConfig` already rejects anything else, so reaching here means the two disagree.
      // Refusing beats picking one.
      const kind: never = config.transport;
      return { ok: false, problems: [`Unknown transport ${String(kind)}.`] };
    }
  }
}

/* ── Startup ───────────────────────────────────────────────────────────── */

export interface StartupOk {
  ok: true;
  deps: LoopDeps;
  config: BridgeConfig;
}
export interface StartupRefused {
  ok: false;
  problems: string[];
}

/**
 * Everything that must be true before the first poll.
 *
 * Returns the problems rather than throwing or exiting, so the whole of startup is exercisable
 * without starting a process.
 */
export function startup(
  env: Readonly<Record<string, string | undefined>>,
  options: { platform?: NodeJS.Platform; log?: (fields: LogLine) => void } = {}
): StartupOk | StartupRefused {
  const loaded = loadConfig(env);
  if (!loaded.ok) return { ok: false, problems: loaded.problems };

  const chosen = transportFor(loaded.config, options.platform ?? process.platform);
  if (!chosen.ok) return { ok: false, problems: chosen.problems };

  const config = loaded.config;
  const log = options.log ?? (() => undefined);

  log({
    event: 'bridge.starting',
    label: config.label,
    api: config.apiUrl,
    transport: config.transport,
    machines: config.machineIds,
    pollMs: config.pollMs,
    // The token is never logged, not even truncated. A prefix in a log that gets pasted into a
    // support thread is still a prefix of a live credential.
    token: 'withheld',
  });

  return {
    ok: true,
    config,
    deps: {
      config,
      api: new HttpJalsaApi(config),
      // machine_id → this PC's transport. A lookup by the id the job already carries; a machine
      // this bridge does not serve yields null, and the loop fails that job rather than finding
      // it another home.
      transportFor: (machineId) => (serves(config, machineId) ? chosen.transport : null),
      log: (line) => log({ event: 'bridge.cycle', line }),
    },
  };
}

/* ── Running ───────────────────────────────────────────────────────────── */

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run until told to stop.
 *
 * SHUTDOWN IS GRACEFUL BECAUSE THE ALTERNATIVE PRINTS TWICE. A bridge killed between its transport
 * call and its report leaves a job in `processing` that nobody can adjudicate — the server's
 * sweeper eventually expires it to `failed`, in front of a person, which is the correct but
 * expensive outcome. Letting the current cycle finish avoids paying that on every restart.
 */
export async function run(
  deps: LoopDeps,
  signals: { onStop: (handler: () => void) => void },
  log: (fields: LogLine) => void
): Promise<void> {
  let stopping = false;
  signals.onStop(() => {
    if (stopping) return;
    stopping = true;
    log({ event: 'bridge.stopping', note: 'finishing the current ticket before exiting' });
  });

  await runLoop(deps, { cycles: Number.POSITIVE_INFINITY, sleep, stopping: () => stopping });
  log({ event: 'bridge.stopped' });
}

/* ── The process ───────────────────────────────────────────────────────── */

/* c8 ignore start — the process wiring itself; every rule it applies is exported above or in cli.ts. */
const COMMANDS = ['pair', 'run', 'discover'] as const;

async function paired(command: (typeof COMMANDS)[number], args: string[]): Promise<number> {
  const [{ hostname }, { dirname }, { fileURLToPath }, fsSync] = await Promise.all([
    import('node:os'),
    import('node:path'),
    import('node:url'),
    import('node:fs'),
  ]);
  const deps: CliDeps = {
    env: process.env,
    platform: process.platform,
    hostname: hostname(),
    fs: await nodeConfigFs(),
    installDir: dirname(fileURLToPath(import.meta.url)),
    out: (line) => process.stdout.write(`${line}\n`),
  };
  if (command === 'pair') return pairCommand(args, deps);
  if (command === 'discover') return discoverCommand(deps);

  // `run`: the Scheduled Task. Nobody reads its console, so the log goes to a file as well.
  const home = bridgeHome(process.env, process.platform);
  const toFile = rotatingLog(fsSync, joinPath(home, 'logs'));
  const log = jsonLogger((line) => {
    process.stdout.write(`${line}\n`);
    toFile(line);
  });
  const setup = await serviceSetup(deps, log);
  if (!setup.ok) {
    for (const problem of setup.problems) log({ event: 'bridge.refused', problem });
    return 2;
  }
  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    log({ event: 'bridge.stopping', note: 'finishing the current ticket before exiting' });
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGBREAK', stop);
  await servePaired(setup.service, {
    iterations: Number.POSITIVE_INFINITY,
    sleep,
    stopping: () => stopping,
  });
  log({ event: 'bridge.stopped' });
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('main.js')) {
  const command = process.argv[2] as (typeof COMMANDS)[number] | undefined;
  if (command && (COMMANDS as readonly string[]).includes(command)) {
    void paired(command, process.argv.slice(3)).then(
      (code) => process.exit(code),
      (err: unknown) => {
        process.stdout.write(`${JSON.stringify({ event: 'bridge.crashed', note: err instanceof Error ? err.message : String(err) })}\n`);
        process.exit(1);
      }
    );
  } else {
    // Environment-variable mode, exactly as Gate 5 shipped it.
    const log = jsonLogger((line) => process.stdout.write(`${line}\n`));
    const started = startup(process.env, { log });

    if (!started.ok) {
      for (const problem of started.problems) log({ event: 'bridge.refused', problem });
      process.exit(2);
    } else {
      void run(
        started.deps,
        {
          onStop: (handler) => {
            process.on('SIGINT', handler);
            process.on('SIGTERM', handler);
            // Windows services and `Ctrl+Break` on a console.
            process.on('SIGBREAK', handler);
          },
        },
        log
      ).then(() => process.exit(0));
    }
  }
}
/* c8 ignore stop */
