import { NextResponse } from 'next/server';
import { fail, handler, ok } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import { listHeardAboutBetween } from '@/lib/db/queries';
import { tallyHeard } from '@/lib/heard-about';
import { checkRange } from '@/lib/report-range';
import { nowForRangeCheck } from '@/lib/restaurant-time';

/**
 * How guests found Jalsa, over a range - for the Uplift section (24-Sep list, H2).
 *
 * Its own endpoint for the reason `/api/owner/report` is one: the owner payload is polled every
 * few seconds, and a count nobody has opened should not ride on it. Gated like the section it
 * feeds (`rep.sales`), validated with the same `checkRange` the report uses.
 */
export const dynamic = 'force-dynamic';

export const GET = handler(async (request: Request): Promise<NextResponse> => {
  const staff = await currentStaff();
  if (!staff) {
    return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN to open the console.' });
  }
  if (!staff.grants.can('rep.sales')) {
    return fail(403, {
      code: 'forbidden',
      message: 'How guests found the restaurant is part of the revenue reports, which are not part of your role.',
      permission: 'rep.sales',
    });
  }
  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const verdict = checkRange({ from, to }, nowForRangeCheck());
  if (verdict.problem) return fail(400, { code: 'validation', message: verdict.problem });

  const answers = await listHeardAboutBetween(from, to);
  return ok({ range: { from, to }, total: answers.length, sources: tallyHeard(answers) });
});
