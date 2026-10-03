import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import { listFavouritesBetween } from '@/lib/db/queries';
import { checkRange } from '@/lib/report-range';
import { nowForRangeCheck } from '@/lib/restaurant-time';

/**
 * "People loved items" - the dishes guests hearted, over a range (03-Oct-2026).
 *
 * Its own endpoint for the reason `/api/owner/heard` is one: the owner payload is polled, and a
 * count nobody has opened should not ride on it. Gated by `rep.products` - it is a report about
 * dishes, and that is the grant the Reports section itself is shown for. Validated with the same
 * `checkRange` every report uses. Counts only what `guest_favourite` holds; nothing is estimated.
 */
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request): Promise<NextResponse> => {
  const staff = await currentStaff('owner');
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN to open the console.' });
  }
  if (!staff.grants.can('rep.products')) {
    return fail(403, {
      code: 'forbidden',
      message: 'The dishes guests loved are part of the product reports, which are not part of your role.',
      permission: 'rep.products',
    });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const verdict = checkRange({ from, to }, nowForRangeCheck());
  if (verdict.problem) return fail(400, { code: 'validation', message: verdict.problem });

  const items = await listFavouritesBetween(from, to);
  // `hearts`: every party's heart on every dish in the range - the sum of the rows below.
  return ok({ range: { from, to }, items, hearts: items.reduce((a, i) => a + i.parties, 0) });
});
