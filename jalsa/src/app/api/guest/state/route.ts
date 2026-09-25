import { NextResponse } from 'next/server';
import { handler, ok, fail } from '@/lib/route';
import { buildGuestPayload } from '@/lib/db/guest-view';
import { guestStamp, STAMP_HEADER, UNCHANGED } from '@/lib/db/change-stamp';
import { readGuestToken } from '@/lib/sessions';

/**
 * The guest's whole world, re-read.
 *
 * WHY POLLING AND NOT A LIVE SOCKET
 *   Three things reach this phone from elsewhere: a round moving to ready, a dish selling out,
 *   and a captain marking the food served. None of them is sub-second urgent, and all three are
 *   already narrated by a person standing in the room. A poll every few seconds is "within
 *   seconds" as the design set asks, survives a dead spot without a reconnect storm, and — the
 *   part that matters most — needs no browser-reachable database policy, so a phone on the
 *   restaurant's wifi still cannot read anybody else's bill.
 */
export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request): Promise<NextResponse> => {
  const params = new URL(req.url).searchParams;
  const table = params.get('table');
  if (!table) return fail(400, { code: 'validation', message: 'Which table?' });

  // "Has anything this table shows changed since the stamp I hold?" — one round, and when the
  // answer is no, the only one (change-stamp.ts). Read BEFORE the screen, never beside it.
  const stamp = await guestStamp(table, await readGuestToken());
  const init: ResponseInit = stamp ? { headers: { [STAMP_HEADER]: stamp } } : {};
  const since = params.get('since');
  if (stamp && since === stamp) return ok(UNCHANGED, init);

  const payload = await buildGuestPayload(table);
  if (!payload) {
    return fail(404, {
      code: 'not-found',
      message: `There is no table called ${table}. Check the code on the table, or ask any of the team.`,
    });
  }
  return ok(payload, init);
});
