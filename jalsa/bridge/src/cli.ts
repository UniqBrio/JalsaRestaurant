import { join } from 'node:path';
import { HttpJalsaApi } from './api';
import type { TransportKind } from './config';
import {
  STATE_FILE,
  bridgeHome,
  readInstallerInfo,
  readPairedConfig,
  writePairedConfig,
  type ConfigFs,
} from './paired-config';
import { pairComputer } from './pairing';
import type { ServiceDeps, ServiceStatus } from './service';
import { FileTransport } from './transport/file';
import { windowsQueueTransport } from './transport/windows-queue';
import type { PrintTransport } from './transport/types';
import { BRIDGE_VERSION } from './version';
import { windowsDiscovery, type PrinterDiscovery } from './windows/discovery';
import { powershellRunner, type ScriptRunner } from './windows/powershell';

/**
 * cli — the three things the installer and the Scheduled Task ask this program to do.
 *
 *   node main.js pair --code ABCD-EFGH    the installer's one question, answered once
 *   node main.js run                      the Scheduled Task, at every boot, unattended
 *   node main.js discover                 which printers Windows has (a diagnostic)
 *
 * With no command, `main.js` behaves exactly as it did in Gate 5 — configured from environment
 * variables — so every existing developer setup and every Gate 7 row keeps working.
 *
 * NOTHING HERE PRINTS THE TOKEN. `pair` writes it to `config.json` and says "connected"; the
 * installer never sees it.
 *
 * Every side effect — the filesystem, the network, PowerShell, the platform — arrives as a
 * dependency, so each command runs in a unit spec against a temporary directory.
 */

export interface CliDeps {
  env: Readonly<Record<string, string | undefined>>;
  platform: NodeJS.Platform;
  hostname: string;
  fs: ConfigFs;
  /** The directory `main.js` lives in, where the installer put `jalsa.json`. */
  installDir: string;
  out: (line: string) => void;
  fetchImpl?: typeof fetch;
  runner?: ScriptRunner;
}

/** Installer exit codes. The installer branches on these, never on the words. */
export const EXIT = { ok: 0, usage: 2, refused: 3, network: 4 } as const;

const argValue = (args: readonly string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

export async function pairCommand(args: readonly string[], deps: CliDeps): Promise<number> {
  const code = argValue(args, '--code') ?? '';
  if (!code.trim()) {
    deps.out('Type the pairing code shown in Jalsa under Printers.');
    return EXIT.usage;
  }
  const origin = argValue(args, '--origin') ?? (await readInstallerInfo(deps.fs, deps.installDir))?.origin ?? '';
  if (!origin) {
    deps.out('This installer does not say which Jalsa server it belongs to. Download it again from Jalsa → Printers.');
    return EXIT.usage;
  }

  const result = await pairComputer({
    origin,
    code,
    hostname: deps.hostname,
    bridgeVersion: BRIDGE_VERSION,
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  });
  if (!result.ok) {
    deps.out(result.message);
    return result.message.startsWith('This computer could not reach') ? EXIT.network : EXIT.refused;
  }

  await writePairedConfig(deps.fs, bridgeHome(deps.env, deps.platform), result.config);
  deps.out(
    `This computer is now connected to ${result.config.restaurantName || 'Jalsa'} as "${result.config.label}". ` +
      'Go back to Jalsa → Printers to choose the printer.'
  );
  return EXIT.ok;
}

/**
 * Discovery for this host.
 *
 * On Windows, `Get-Printer`. Anywhere else there is no spooler to ask, so a developer may name
 * pretend printers in `JALSA_BRIDGE_DEV_PRINTERS` (`;` separated) to walk the whole pairing flow
 * against the file transport. Absent, a non-Windows host reports an honest failure, never an
 * empty list.
 */
export function discoveryFor(deps: CliDeps): PrinterDiscovery {
  if (deps.platform === 'win32') return windowsDiscovery(deps.runner ?? powershellRunner);
  const names = (deps.env.JALSA_BRIDGE_DEV_PRINTERS ?? '')
    .split(';')
    .map((n) => n.trim())
    .filter(Boolean);
  return async () =>
    names.length
      ? {
          ok: true,
          printers: names.map((queueName) => ({ queueName, driverName: 'development', portName: 'DEV:', status: 'ready' as const, isVirtual: false })),
        }
      : { ok: false, error: `There is no Windows printer list on ${deps.platform}. Set JALSA_BRIDGE_DEV_PRINTERS to develop here.` };
}

export async function discoverCommand(deps: CliDeps): Promise<number> {
  const found = await discoveryFor(deps)();
  if (!found.ok) {
    deps.out(found.error);
    return EXIT.refused;
  }
  if (found.printers.length === 0) deps.out('Windows has no printers installed on this computer.');
  for (const p of found.printers) deps.out(`${p.queueName}  ·  ${p.status}  ·  ${p.portName}${p.isVirtual ? '  ·  software printer' : ''}`);
  return EXIT.ok;
}

/**
 * Everything the paired service needs, or why it cannot start.
 *
 * The transport is `windows-queue` on Windows. Elsewhere only `file` is allowed, and only when a
 * developer asks for it by name — the same rule `transportFor` applies in environment mode: the
 * transport is chosen by configuration, never guessed from the platform.
 */
export async function serviceSetup(
  deps: CliDeps,
  log: (fields: Record<string, unknown>) => void
): Promise<{ ok: true; service: ServiceDeps } | { ok: false; problems: string[] }> {
  const home = bridgeHome(deps.env, deps.platform);
  const read = await readPairedConfig(deps.fs, home);
  if (!read.ok) return { ok: false, problems: read.problems };
  if ((deps.env.SUPABASE_SECRET_KEY ?? '').trim()) {
    return { ok: false, problems: ['SUPABASE_SECRET_KEY is present. A bridge never holds a database credential — remove it.'] };
  }

  const spoolDir = join(home, 'spool');
  let transport: PrintTransport;
  let transportKind: TransportKind;
  if (deps.platform === 'win32') {
    transport = windowsQueueTransport(spoolDir, 30_000, deps.runner ?? powershellRunner);
    transportKind = 'windows-queue';
  } else if ((deps.env.JALSA_BRIDGE_TRANSPORT ?? '').trim() === 'file') {
    transport = new FileTransport({ directory: spoolDir, humanReadable: true });
    transportKind = 'file';
  } else {
    return {
      ok: false,
      problems: [`This host is ${deps.platform}. A paired bridge prints through Windows; set JALSA_BRIDGE_TRANSPORT=file to develop here.`],
    };
  }

  const config = read.config;
  const writeStatus = async (s: ServiceStatus): Promise<void> => {
    await deps.fs.writeFile(join(home, STATE_FILE), `${JSON.stringify(s)}\n`);
  };

  log({ event: 'bridge.starting', mode: 'paired', label: config.label, api: config.apiUrl, transport: transportKind, version: BRIDGE_VERSION, token: 'withheld' });

  return {
    ok: true,
    service: {
      paired: config,
      api: new HttpJalsaApi(
        {
          apiUrl: config.apiUrl,
          token: config.token,
          label: config.label,
          machineIds: [],
          destinations: {},
          pollMs: 3_000,
          maxBackoffMs: 10_000,
          batchLimit: 20,
          transport: transportKind,
          spoolDir,
          humanReadable: false,
          spoolTimeoutMs: 30_000,
        },
        deps.fetchImpl ?? fetch
      ),
      discover: discoveryFor(deps),
      transport,
      transportKind,
      spoolDir,
      hostname: deps.hostname,
      bridgeVersion: BRIDGE_VERSION,
      log,
      writeStatus,
    },
  };
}
