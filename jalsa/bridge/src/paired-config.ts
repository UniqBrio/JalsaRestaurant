import { join, win32 } from 'node:path';

/**
 * paired-config — what a paired computer remembers between restarts, and where.
 *
 * WHY A FILE NOW, WHEN GATE 4 SAID "NOTHING IS READ FROM A FILE"
 *   Gate 4's bridge was configured by a developer, who can set environment variables. A paired
 *   bridge is configured by a restaurant owner typing a code into an installer once — and must
 *   still be configured after the PC reboots at 6 a.m. with nobody at it. The credential the
 *   pairing produced has to live somewhere the Scheduled Task can read, and that is a file under
 *   `%ProgramData%\Jalsa\PrintBridge`, locked by the installer to SYSTEM and Administrators.
 *   Environment-variable mode is untouched and still works exactly as it did (`config.ts`).
 *
 * WHAT IS IN IT, AND WHAT IS NOT
 *   The Jalsa API address, the bridge token, the name the owner gave the computer, the restaurant's
 *   name for the log. NOT the printer mapping: that is Jalsa's, handed down on every sync, so an
 *   owner who re-maps a printer never has to touch the PC.
 *
 * FILESYSTEM INJECTED, like every other side effect in this bridge, so persistence is exercised by
 * a unit spec against a real temporary directory rather than trusted.
 */

export const PAIRED_CONFIG_VERSION = 1;

export interface PairedConfig {
  version: typeof PAIRED_CONFIG_VERSION;
  /** `https://<jalsa>/api/bridge` — as the server said, at pairing. */
  apiUrl: string;
  /** The bearer token. Never logged. */
  token: string;
  /** What the owner called this computer. Lands in `claimed_by`. */
  label: string;
  restaurantName: string;
  pairedAt: string;
}

/** Baked into the download by `bridge:package`: which Jalsa server this installer belongs to. */
export interface InstallerInfo {
  origin: string;
}

export interface ConfigFs {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}

export const CONFIG_FILE = 'config.json';
export const INSTALLER_FILE = 'jalsa.json';
export const STATE_FILE = 'state.json';

/**
 * Where this computer keeps its state.
 *
 * `JALSA_BRIDGE_HOME` wins, so a developer can run a paired bridge anywhere. Otherwise
 * `%ProgramData%\Jalsa\PrintBridge` on Windows — machine-wide, so the SYSTEM task and the
 * installer see the same file — and a dot-directory elsewhere, for development only.
 */
export function bridgeHome(env: Readonly<Record<string, string | undefined>>, platform: NodeJS.Platform): string {
  const override = (env.JALSA_BRIDGE_HOME ?? '').trim();
  if (override) return override;
  // `win32.join`, explicitly: this is asked on a developer's Linux machine by the specs, and the
  // answer has to be the path Windows will use, not the host's idea of a separator.
  if (platform === 'win32') return win32.join(env.ProgramData ?? env.PROGRAMDATA ?? 'C:\\ProgramData', 'Jalsa', 'PrintBridge');
  return join(env.HOME ?? '.', '.jalsa-print-bridge');
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** A parsed config, or the problems with it. A half-valid config never starts a bridge. */
export function parsePairedConfig(raw: string): { ok: true; config: PairedConfig } | { ok: false; problems: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, problems: ['config.json is not readable JSON.'] };
  }
  const o = (json ?? {}) as Record<string, unknown>;
  const problems: string[] = [];
  if (o.version !== PAIRED_CONFIG_VERSION) problems.push(`config.json has version ${String(o.version)}; expected ${PAIRED_CONFIG_VERSION}.`);
  const apiUrl = str(o.apiUrl);
  if (!/^https?:\/\/.+\/api\/bridge$/.test(apiUrl)) problems.push('config.json has no usable apiUrl.');
  const token = str(o.token);
  if (!token.startsWith('jbt_')) problems.push('config.json has no bridge credential.');
  const label = str(o.label);
  if (!label) problems.push('config.json has no computer name.');
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    config: {
      version: PAIRED_CONFIG_VERSION,
      apiUrl,
      token,
      label,
      restaurantName: str(o.restaurantName),
      pairedAt: str(o.pairedAt),
    },
  };
}

export async function readPairedConfig(
  fs: ConfigFs,
  home: string
): Promise<{ ok: true; config: PairedConfig } | { ok: false; problems: string[]; missing: boolean }> {
  let raw: string;
  try {
    raw = await fs.readFile(join(home, CONFIG_FILE));
  } catch {
    return { ok: false, missing: true, problems: ['This computer is not connected to a Jalsa restaurant yet. Run the installer and type the pairing code.'] };
  }
  const parsed = parsePairedConfig(raw);
  return parsed.ok ? parsed : { ...parsed, missing: false };
}

/**
 * Write the config so that a crash mid-write can never leave half a credential on disk: write a
 * sibling, then rename over the original. A rename is atomic on NTFS and on every POSIX
 * filesystem this will meet.
 */
export async function writePairedConfig(fs: ConfigFs, home: string, config: PairedConfig): Promise<void> {
  await fs.mkdir(home);
  const target = join(home, CONFIG_FILE);
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(config, null, 2)}\n`);
  await fs.rename(temp, target);
}

export async function readInstallerInfo(fs: ConfigFs, dir: string): Promise<InstallerInfo | null> {
  try {
    const o = JSON.parse(await fs.readFile(join(dir, INSTALLER_FILE))) as Record<string, unknown>;
    const origin = str(o.origin).replace(/\/+$/, '');
    return /^https?:\/\/[^/]+$/.test(origin) ? { origin } : null;
  } catch {
    return null;
  }
}

/** The real filesystem. */
export const nodeConfigFs = async (): Promise<ConfigFs> => {
  const fsp = await import('node:fs/promises');
  return {
    readFile: (p) => fsp.readFile(p, 'utf8'),
    writeFile: (p, d) => fsp.writeFile(p, d, { encoding: 'utf8', mode: 0o600 }),
    rename: (a, b) => fsp.rename(a, b),
    mkdir: async (p) => {
      await fsp.mkdir(p, { recursive: true });
    },
  };
};
