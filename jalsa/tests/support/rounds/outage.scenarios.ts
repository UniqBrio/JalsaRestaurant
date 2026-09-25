/**
 * Outage scenarios — bundled with the REAL database client by tests/unit/outage.unit.spec.ts.
 * The child's NEXT_PUBLIC_SUPABASE_URL points at a port that refuses, or at a server this file
 * starts that accepts connections and never answers. Reports how long a read took to fail, and
 * whether a write was left to finish rather than cut off.
 */
import net from 'node:net';
import { db } from '@/lib/supabase/server';

const HANG_PORT = Number(process.env.HANG_PORT ?? 0);
if (HANG_PORT) {
  // Accepts, reads, never answers — a database that is "up" but not responding.
  await new Promise<void>((resolve) => net.createServer(() => undefined).listen(HANG_PORT, '127.0.0.1', resolve));
}

const t0 = performance.now();
const read = await db().from('dining_table').select('id').limit(1);
const readMs = Math.round(performance.now() - t0);

let writePendingAfter3s: boolean | null = null;
if (HANG_PORT) {
  const write = db().from('audit_entry').insert({ action: 'outage-probe' });
  writePendingAfter3s = await Promise.race([
    Promise.resolve(write).then(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(true), 3000)),
  ]);
}

process.stdout.write(`${JSON.stringify({ readMs, readFailed: read.error !== null, writePendingAfter3s })}\n`);
process.exit(0);
