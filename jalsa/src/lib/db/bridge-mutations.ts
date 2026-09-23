import 'server-only';
import { db } from '@/lib/supabase/server';
import type { Bridge } from '@/lib/bridge-auth';

/**
 * bridge-mutations — everything a print bridge may do, and nothing else.
 *
 * THE BOUNDARY THIS FILE EXISTS TO HOLD
 *   Jalsa decides WHAT prints and WHICH machine prints it. A bridge decides only whether the
 *   bytes reached that machine. Every function below is written so the second cannot become the
 *   first: `reportPrintJob` takes no printer argument, so a bridge cannot say "I sent it
 *   elsewhere" even by mistake, and the Phase 1 trigger would reject it if it tried.
 *
 * WHY `printed` LIVES HERE AND NOWHERE ELSE
 *   Phase 1 made `printed` unwritable on purpose: no code path had evidence for it. This file is
 *   that evidence arriving — a bridge reporting that a transport accepted the job. It is the one
 *   place in the application allowed to write the word, and `print-assignment.unit.spec.ts` still
 *   guards the Phase 1 paths so they cannot start doing it again.
 */

/** Statuses a bridge may report. Deliberately not the full enum: it cannot re-queue anything. */
export type BridgeOutcome = 'printed' | 'failed';

export interface BridgeJob {
  id: string;
  kind: string;
  /** Which machine Jalsa assigned. The bridge matches this to a local queue; it never re-picks. */
  printerId: string | null;
  printerMachineId: string;
  printerName: string;
  station: string;
  isReprint: boolean;
  attempts: number;
  createdAt: string;
}

/**
 * The queued jobs this bridge can carry.
 *
 * WHY THE BRIDGE NAMES THE MACHINES IT SERVES
 *   The mapping from a Jalsa printer to a Windows queue is a property of ONE PC — the same
 *   restaurant may have a kitchen machine and a counter machine on different computers, and the
 *   queue names are whatever Windows called them during driver install. Storing that server-side
 *   would put a machine-specific string in shared data and make adding a printer a database
 *   change. So the bridge declares which `machine_id`s it can reach, and the server returns only
 *   those. A bridge that claims a machine it cannot print to simply fails the job, visibly.
 */
export async function listBridgeJobs(input: {
  bridge: Bridge;
  machineIds: readonly string[];
  limit?: number;
}): Promise<BridgeJob[]> {
  // A PAIRED bridge is held to its mapping here, on the server. It names machine ids like any
  // bridge, but the answer is intersected with what `bridge_printer` says this computer reaches —
  // so a paired PC is never handed a job for a printer plugged into a different PC.
  const mapped = input.bridge.paired ? await mappedPrinters(input.bridge) : null;
  const asked = mapped
    ? input.machineIds.filter((m) => [...mapped.values()].some((p) => p.machineId === m))
    : input.machineIds;
  if (asked.length === 0) return [];

  const { data: printers, error: pErr } = await db()
    .from('printer')
    .select('id,machine_id')
    .eq('restaurant_id', input.bridge.restaurantId)
    .in('machine_id', asked as string[]);
  if (pErr) throw pErr;

  const byId = new Map((printers ?? []).map((p) => [p.id as string, p.machine_id as string]));
  if (byId.size === 0) return [];

  const { data, error } = await db()
    .from('print_job')
    .select('id,kind,printer_id,printer_name,station,is_reprint,attempts,created_at')
    .eq('restaurant_id', input.bridge.restaurantId)
    .eq('status', 'queued')
    .in('printer_id', [...byId.keys()])
    // Oldest first: a kitchen reads paper in the order it was ordered, and a queue that serves
    // the newest round first is a queue that starves the table that has waited longest.
    .order('created_at', { ascending: true })
    .limit(input.limit ?? 20);
  if (error) throw error;

  return (data ?? []).map((j) => ({
    id: j.id as string,
    kind: j.kind as string,
    printerId: (j.printer_id as string | null) ?? null,
    printerMachineId: byId.get(j.printer_id as string) ?? '',
    printerName: (j.printer_name as string) ?? '',
    station: (j.station as string) ?? '',
    isReprint: (j.is_reprint as boolean) ?? false,
    attempts: (j.attempts as number) ?? 0,
    createdAt: j.created_at as string,
  }));
}

/**
 * Take a job, or discover that somebody else already did.
 *
 * WHY THIS IS ONE CONDITIONAL UPDATE AND NOT A READ THEN A WRITE
 *   Read-then-write leaves a window in which two bridges both see `queued` and both proceed, and
 *   the symptom is two identical tickets in a kitchen with no way to tell which round was
 *   double-cooked. `where status = 'queued'` makes Postgres the arbiter: the row is updated once,
 *   the loser updates nothing, and the loser learns it lost from an empty result rather than from
 *   a duplicate on the paper. Verified against the TEST database: A updated 1 row, B updated 0.
 */
export async function claimPrintJob(input: { bridge: Bridge; jobId: string }): Promise<BridgeJob | null> {
  // A paired bridge may only take jobs for printers mapped to it. Part of the SAME conditional
  // update below, never a read-then-check: the mapping is read first, the job is not.
  const mapped = input.bridge.paired ? [...(await mappedPrinters(input.bridge)).keys()] : null;
  if (mapped && mapped.length === 0) return null;

  let claim = db()
    .from('print_job')
    .update({
      status: 'processing',
      claimed_by: input.bridge.label,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', input.jobId)
    .eq('restaurant_id', input.bridge.restaurantId)
    // The whole of the concurrency control.
    .eq('status', 'queued');
  if (mapped) claim = claim.in('printer_id', mapped);
  const { data, error } = await claim.select('id,kind,printer_id,printer_name,station,is_reprint,attempts,created_at');
  if (error) throw error;

  const row = (data ?? [])[0];
  if (!row) return null; // somebody else won, or it was never queued. Both mean: skip it.

  return {
    id: row.id as string,
    kind: row.kind as string,
    printerId: (row.printer_id as string | null) ?? null,
    printerMachineId: '',
    printerName: (row.printer_name as string) ?? '',
    station: (row.station as string) ?? '',
    isReprint: (row.is_reprint as boolean) ?? false,
    attempts: (row.attempts as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

/**
 * What happened to a claimed job.
 *
 * NOTE WHAT THIS FUNCTION CANNOT BE TOLD. There is no printer parameter, no station, no routing
 * rule — a bridge has no vocabulary here for "I sent it somewhere else", which is the single
 * property that keeps routing in Jalsa. The patch below is a closed set for the same reason the
 * Phase 1 retry patch is: a blacklist only catches the defect somebody already imagined.
 *
 * `.eq('status', 'processing')` is not decoration. It means a bridge can only report on a job it
 * actually holds: a stale report arriving after the sweeper gave up updates nothing, and a bridge
 * cannot mark `printed` a job it never claimed.
 */
export async function reportPrintJob(input: {
  bridge: Bridge;
  jobId: string;
  outcome: BridgeOutcome;
  error?: string;
}): Promise<{ applied: boolean }> {
  const printed = input.outcome === 'printed';
  const now = new Date().toISOString();

  const { data, error } = await db()
    .from('print_job')
    .update({
      status: printed ? 'printed' : 'failed',
      last_attempt_at: now,
      last_error: printed ? '' : (input.error ?? 'The bridge reported a transport failure.').slice(0, 500),
      completed_at: printed ? now : null,
    })
    .eq('id', input.jobId)
    .eq('restaurant_id', input.bridge.restaurantId)
    .eq('status', 'processing')
    .eq('claimed_by', input.bridge.label)
    .select('id,kot_id');
  if (error) throw error;

  const row = (data ?? [])[0];
  if (!row) return { applied: false };

  if (row.kot_id) await syncKotFromJobs(row.kot_id as string);
  return { applied: true };
}

/**
 * Expire claims nobody came back for.
 *
 * WHY A STALE CLAIM BECOMES `failed` AND NEVER `queued`
 *   A bridge that stopped answering may have put paper in the kitchen a moment before it died.
 *   Re-queueing asserts it did not, and if that assertion is wrong the round prints twice — the
 *   one printing mistake that costs real food. `failed` asserts nothing: it puts the job in front
 *   of a person, where Jalsa's existing retry and "print elsewhere" already live and where
 *   somebody can look at the printer before deciding.
 *
 * WHY THIS IS SERVER-SIDE AND NOT IN THE BRIDGE
 *   A bridge cannot adjudicate its own death — the instance that would run this is the instance
 *   that is gone. And a bridge allowed to release another bridge's claim is a bridge that can
 *   take work off a machine that is still printing it.
 */
export async function sweepStaleClaims(input: {
  restaurantId: string;
  olderThanMinutes?: number;
}): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - (input.olderThanMinutes ?? 10) * 60_000).toISOString();

  const { data, error } = await db()
    .from('print_job')
    .update({
      status: 'failed',
      last_error: 'The bridge that took this ticket stopped answering. Nobody can say whether paper came out — check the machine before retrying.',
      completed_at: null,
    })
    .eq('restaurant_id', input.restaurantId)
    .eq('status', 'processing')
    .lt('claimed_at', cutoff)
    .select('id,kot_id');
  if (error) throw error;

  const rows = data ?? [];
  for (const kotId of new Set(rows.map((r) => r.kot_id as string | null).filter(Boolean))) {
    await syncKotFromJobs(kotId as string);
  }
  return { expired: rows.length };
}

/**
 * Re-derive `kot.print_status` after a bridge changed one of its jobs.
 *
 * The same pessimistic aggregate `syncKotPrintState` applies on the order path, kept here rather
 * than imported so the bridge path cannot reach into `mutations.ts` and, one refactor later, find
 * itself able to call `queuePrint`. One rule, stated twice, in two modules that must not depend
 * on each other — and asserted identical by a rung.
 */
async function syncKotFromJobs(kotId: string): Promise<void> {
  const { data: jobs } = await db()
    .from('print_job')
    .select('id,status,attempts,completed_at,redirected_from_job_id')
    .eq('kot_id', kotId);

  const all = jobs ?? [];
  if (all.length === 0) return;
  const superseded = new Set(all.map((j) => j.redirected_from_job_id as string | null).filter(Boolean));
  const live = all.filter((j) => !superseded.has(j.id as string));
  if (live.length === 0) return;

  const status = live.some((j) => j.status === 'failed')
    ? 'failed'
    : live.every((j) => j.status === 'printed')
      ? 'printed'
      : live.some((j) => j.status === 'processing')
        ? 'processing'
        : 'queued';

  await db()
    .from('kot')
    .update({
      print_status: status,
      print_attempts: live.reduce((most, j) => Math.max(most, (j.attempts as number) ?? 0), 0),
      printed_at:
        status === 'printed'
          ? ((live.map((j) => j.completed_at as string | null).filter(Boolean).sort().pop() as string) ?? null)
          : null,
    })
    .eq('id', kotId);
}

/* ── Paired bridges (20260923090000) ───────────────────────────────────── */

/** One Jalsa printer, as one paired computer reaches it. */
export interface BridgeAssignment {
  printerId: string;
  /** Jalsa's identity for the machine. What a job carries and what the loop matches on. */
  machineId: string;
  printerName: string;
  /** The Windows queue on THIS computer. The only PC-specific fact, and it lives in the mapping. */
  queueName: string;
}

/**
 * The printers mapped to this computer, keyed by `printer.id`.
 *
 * Restaurant-scoped twice — the mapping row and the printer row — so a mapping that somehow named
 * another restaurant's printer would simply not resolve.
 */
export async function mappedPrinters(bridge: Bridge): Promise<Map<string, BridgeAssignment>> {
  const { data: maps, error } = await db()
    .from('bridge_printer')
    .select('printer_id,queue_name')
    .eq('bridge_token_id', bridge.id)
    .eq('restaurant_id', bridge.restaurantId);
  if (error) throw error;
  const ids = (maps ?? []).map((m) => m.printer_id as string);
  if (ids.length === 0) return new Map();

  const { data: printers, error: pErr } = await db()
    .from('printer')
    .select('id,machine_id,name')
    .eq('restaurant_id', bridge.restaurantId)
    .in('id', ids);
  if (pErr) throw pErr;

  const byId = new Map((printers ?? []).map((p) => [p.id as string, p]));
  const out = new Map<string, BridgeAssignment>();
  for (const m of maps ?? []) {
    const p = byId.get(m.printer_id as string);
    if (!p) continue;
    out.set(p.id as string, {
      printerId: p.id as string,
      machineId: p.machine_id as string,
      printerName: p.name as string,
      queueName: m.queue_name as string,
    });
  }
  return out;
}

/** What a bridge may say about the printers Windows shows it. Anything else is dropped. */
export interface DiscoveredPrinterInput {
  queueName: string;
  driverName: string;
  portName: string;
  status: 'ready' | 'offline' | 'error' | 'unknown';
  isVirtual: boolean;
}

const STATUSES = new Set(['ready', 'offline', 'error', 'unknown']);
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Untrusted input from a PC, narrowed to the shape above. A bridge is a client like any other. */
export function cleanDiscovery(raw: unknown): DiscoveredPrinterInput[] | null {
  // Absent means "discovery failed on the PC this time" — keep the last snapshot rather than
  // telling the owner every printer vanished.
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: DiscoveredPrinterInput[] = [];
  for (const r of raw.slice(0, 50)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const queueName = text(o.queueName, 200).trim();
    if (!queueName || seen.has(queueName)) continue;
    seen.add(queueName);
    out.push({
      queueName,
      driverName: text(o.driverName, 200),
      portName: text(o.portName, 200),
      status: (STATUSES.has(o.status as string) ? o.status : 'unknown') as DiscoveredPrinterInput['status'],
      isVirtual: o.isVirtual === true,
    });
  }
  return out;
}

/**
 * The fourth verb, and still not a routing one.
 *
 * The bridge says what Windows shows it; Jalsa answers with the printers the OWNER mapped to this
 * computer. Nothing here touches `print_job` — a sync cannot claim, report, re-queue or re-point a
 * ticket. The answer is the same `machine_id` → destination lookup Gate 4's environment variable
 * held, except the owner chose it on a screen instead of typing it on the PC.
 */
export async function syncBridge(input: {
  bridge: Bridge;
  printers: DiscoveredPrinterInput[] | null;
  hostname: string;
  bridgeVersion: string;
}): Promise<{ assignments: BridgeAssignment[] }> {
  const now = new Date().toISOString();

  if (input.printers && input.printers.length) {
    const { error } = await db()
      .from('bridge_discovered_printer')
      .upsert(
        input.printers.map((p) => ({
          bridge_token_id: input.bridge.id,
          restaurant_id: input.bridge.restaurantId,
          queue_name: p.queueName,
          driver_name: p.driverName,
          port_name: p.portName,
          status: p.status,
          is_virtual: p.isVirtual,
          reported_at: now,
        })),
        { onConflict: 'bridge_token_id,queue_name' }
      );
    if (error) throw error;
  }
  // A snapshot, not a history: whatever this sync did not report is no longer on the PC.
  if (input.printers) {
    const { error: delErr } = await db()
      .from('bridge_discovered_printer')
      .delete()
      .eq('bridge_token_id', input.bridge.id)
      .lt('reported_at', now);
    if (delErr) throw delErr;
  }

  await db()
    .from('bridge_token')
    .update({
      hostname: input.hostname.slice(0, 100),
      bridge_version: input.bridgeVersion.slice(0, 40),
      last_sync_at: now,
    })
    .eq('id', input.bridge.id);

  return { assignments: [...(await mappedPrinters(input.bridge)).values()] };
}
