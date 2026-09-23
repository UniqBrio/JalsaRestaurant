/**
 * config — what this one PC knows, and the whole of what it is allowed to know.
 *
 * WHY THE QUEUE NAMES ARE HERE AND NOT IN JALSA'S DATABASE
 *   "Kitchen 1" is a machine in a restaurant; `\\PC-KITCHEN\TVS_RP3160` is a string Windows
 *   invented on one computer during a driver install. Putting the second in shared data would
 *   make adding a printer a database change and would mean one restaurant's row set describes
 *   another restaurant's PC. So Jalsa owns the assignment and this file owns the local address,
 *   and the two meet only at `machine_id`.
 *
 * WHAT THIS IS NOT
 *   It is not a routing table. Nothing here can decide that a job assigned to Kitchen 1 should
 *   go to Kitchen 2: `destinations` is a lookup BY the machine id the job already carries, and a
 *   machine id that is not in it produces a failure, never a substitute. See `destinationFor`.
 *
 * PURE, AND TAKING `env` AS AN ARGUMENT
 *   Nothing here reads `process.env` itself. A configuration loader that reaches for a global is
 *   a loader that can only be tested by mutating the test process, and the cases worth testing
 *   are the malformed ones.
 */

export interface BridgeConfig {
  /** Where Jalsa's `/api/bridge` lives. */
  apiUrl: string;
  /** The bridge token. Never a Supabase key — the bridge has no database credential at all. */
  token: string;
  /** What a person calls this PC. Lands in `print_job.claimed_by`. */
  label: string;
  /** The `printer.machine_id`s this PC can physically reach. */
  machineIds: string[];
  /** machine_id → whatever this bridge's transport needs to reach it. */
  destinations: Record<string, string>;
  /** Idle poll interval. */
  pollMs: number;
  /** The ceiling an empty queue backs off to. A kitchen PC must not poll in a tight loop. */
  maxBackoffMs: number;
  /** How many waiting jobs to ask for at once. */
  batchLimit: number;

  /* ── Gate 5: which transport carries the bytes ───────────────────────── */

  /**
   * `windows` in a restaurant, `file` on a developer's machine, `null` to exercise the failure
   * path. Named explicitly and never inferred from the platform: a bridge that silently chose a
   * different transport because of where it happened to be running would be the one configuration
   * nobody could reason about from the log.
   */
  transport: TransportKind;
  /** Where FileTransport writes, and where the spooler transport stages its `.prn` files. */
  spoolDir: string;
  /** FileTransport only: also write the readable `.txt` beside each `.bin`. */
  humanReadable: boolean;
  /** How long `copy /b` may take before the job is failed as unanswered. */
  spoolTimeoutMs: number;
}

/**
 * `windows-queue` (23-Sep-2026): raw bytes to a printer BY ITS WINDOWS NAME through the spooler
 * API, with no printer sharing. What a paired computer uses; also accepted here so a developer
 * configuring by environment can use a queue name instead of a share.
 */
export type TransportKind = 'file' | 'null' | 'windows' | 'windows-queue';

const TRANSPORTS: readonly TransportKind[] = ['file', 'null', 'windows', 'windows-queue'];

const isTransport = (raw: string): raw is TransportKind => (TRANSPORTS as readonly string[]).includes(raw);

export type ConfigResult = { ok: true; config: BridgeConfig } | { ok: false; problems: string[] };

const DEFAULTS = {
  pollMs: 3_000,
  maxBackoffMs: 60_000,
  batchLimit: 20,
  spoolTimeoutMs: 30_000,
} as const;

/** A positive integer, or the default. A nonsense interval must never become a tight loop. */
function interval(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 250 ? Math.floor(n) : fallback;
}

/**
 * `KOT-VEG-01=C:\jalsa\out;KOT-NV-01=C:\jalsa\out2`
 *
 * Deliberately one flat string rather than a config file format: the whole of a bridge's local
 * state is two lines in an environment, and a parser is a thing that can be wrong.
 */
function parseDestinations(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (raw ?? '').split(';')) {
    const at = pair.indexOf('=');
    if (at <= 0) continue;
    const machineId = pair.slice(0, at).trim();
    const destination = pair.slice(at + 1).trim();
    if (machineId && destination) out[machineId] = destination;
  }
  return out;
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): ConfigResult {
  const problems: string[] = [];

  const apiUrl = (env.JALSA_BRIDGE_API ?? '').trim();
  const token = (env.JALSA_BRIDGE_TOKEN ?? '').trim();
  const label = (env.JALSA_BRIDGE_LABEL ?? '').trim();
  const destinations = parseDestinations(env.JALSA_BRIDGE_DESTINATIONS);
  const machineIds = Object.keys(destinations).sort();

  if (!apiUrl) problems.push('JALSA_BRIDGE_API is not set.');
  if (!token) problems.push('JALSA_BRIDGE_TOKEN is not set.');
  if (!label) problems.push('JALSA_BRIDGE_LABEL is not set — it is what appears on the job history.');
  // A bridge serving nothing would poll forever and print nothing, which looks exactly like a
  // bridge that is working and a restaurant with no orders. Refuse to start instead.
  if (machineIds.length === 0) {
    problems.push('JALSA_BRIDGE_DESTINATIONS names no machines, so this bridge could never print anything.');
  }
  // A Supabase credential on a kitchen PC is the Gate 1 security model inverted. If one is
  // present in this environment somebody has misunderstood the deployment, and starting anyway
  // would hide that.
  if ((env.SUPABASE_SECRET_KEY ?? '').trim()) {
    problems.push('SUPABASE_SECRET_KEY is present. A bridge never holds a database credential — remove it.');
  }

  const transportRaw = (env.JALSA_BRIDGE_TRANSPORT ?? 'file').trim();
  if (!isTransport(transportRaw)) {
    problems.push(
      `JALSA_BRIDGE_TRANSPORT is ${JSON.stringify(transportRaw)}; it must be one of ${TRANSPORTS.join(', ')}.`
    );
  }
  const spoolDir = (env.JALSA_BRIDGE_SPOOL_DIR ?? '').trim();
  if (!spoolDir && transportRaw !== 'null') {
    // `file` writes its artifacts there and `windows` stages its `.prn` files there. Defaulting
    // to a temp directory would scatter a restaurant's tickets somewhere nobody thinks to look.
    problems.push('JALSA_BRIDGE_SPOOL_DIR is not set, and this transport needs somewhere to write.');
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    config: {
      apiUrl,
      token,
      label,
      machineIds,
      destinations,
      pollMs: interval(env.JALSA_BRIDGE_POLL_MS, DEFAULTS.pollMs),
      maxBackoffMs: interval(env.JALSA_BRIDGE_MAX_BACKOFF_MS, DEFAULTS.maxBackoffMs),
      batchLimit: interval(env.JALSA_BRIDGE_BATCH, DEFAULTS.batchLimit),
      transport: transportRaw as TransportKind,
      spoolDir,
      humanReadable: (env.JALSA_BRIDGE_READABLE ?? '').trim() === 'true',
      spoolTimeoutMs: interval(env.JALSA_BRIDGE_SPOOL_TIMEOUT_MS, DEFAULTS.spoolTimeoutMs),
    },
  };
}

/** Does this bridge physically reach that machine? The question a job is filtered by. */
export const serves = (config: BridgeConfig, machineId: string): boolean =>
  Object.prototype.hasOwnProperty.call(config.destinations, machineId);

/**
 * Where the bytes for that machine go on this PC.
 *
 * Null for a machine this bridge does not serve — never another machine's destination. This
 * function is the one place a substitution could have been written, and it is written so it
 * cannot be: there is no iteration, no "first available", and no fallback.
 */
export const destinationFor = (config: BridgeConfig, machineId: string): string | null =>
  serves(config, machineId) ? (config.destinations[machineId] ?? null) : null;
