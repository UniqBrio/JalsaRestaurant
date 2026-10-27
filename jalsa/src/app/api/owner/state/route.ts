import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { publicConfig } from '@/lib/config';
import { PROVISIONAL_REFUSAL, currentStaff } from '@/lib/db/auth';
import { buildOwnerPayload } from '@/lib/db/owner-view';
import { readVersions, staffStamp, STAMP_HEADER, UNCHANGED } from '@/lib/db/change-stamp';
import { maybeSweepStaleClaims } from '@/lib/db/bridge-mutations';
import { currentRestaurantId } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** The once-a-minute stale-claim sweep, started by the route and awaited BESIDE the build. */
async function sweepStaleClaimsBeside(): Promise<void> {
  await maybeSweepStaleClaims(await currentRestaurantId());
}

export const GET = handler(async (req: Request): Promise<NextResponse> => {
  // Who is asking, and whether anything has moved, in one round (change-stamp.ts).
  // The catalog counter rides in the same read, for the catalog cache (catalog-cache.ts).
  const [staff, versions] = await Promise.all([currentStaff('owner'), readVersions()]);
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN to open the console.' });
  }
  // Rule 5, on the reads as well as the writes (26-Oct-2026 audit, SEC-02): an issued PIN opens
  // "choose your own PIN" and nothing else.
  if (staff.provisional) return fail(403, { code: 'forbidden', message: PROVISIONAL_REFUSAL });
  // The console is gated on ONE grant, and every section inside it is gated again on its own.
  // A cashier who may close bills gets the console; the tax panel is still not theirs.
  if (!staff.grants.can('orders.view')) {
    return fail(403, {
      code: 'forbidden',
      message: 'This console is not part of your role.',
      permission: 'orders.view',
    });
  }
  // The open console is what notices a PC that died holding a ticket (throttled; see the sweeper).
  // BESIDE the build, not in front of it (27-Oct-2026): once a minute it was a serial round ahead
  // of the console. The sweep itself never throws. A sweep that expires a claim moves the floor, so a build that
  // missed it is re-read on the next poll.
  const sweep = sweepStaleClaimsBeside();
  const stamp = staffStamp(versions.floor, staff);
  const init: ResponseInit = stamp ? { headers: { [STAMP_HEADER]: stamp } } : {};
  if (stamp && new URL(req.url).searchParams.get('since') === stamp) {
    await sweep;
    return ok(UNCHANGED, init);
  }
  const [payload] = await Promise.all([buildOwnerPayload(staff, publicConfig.qrOrigin, versions.catalog), sweep]);
  return ok(payload, init);
});
