import { NextResponse } from 'next/server';
import { fail, handler } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import { readAllSettings } from '@/lib/db/queries';
import { brandedQrSvg, svgHeaders } from '@/lib/qr-svg';

/**
 * The Google review code — the back of the tabletop stand.
 *
 * WHY IT IS ITS OWN ROUTE AND NOT `?kind=review` ON THE TABLE CODE
 *   The table code encodes a PLACE from one origin and nothing else, and a spec pins that
 *   expression so nothing can ever ride along in it. A review link is a different kind of
 *   thing — an address the owner TYPED, pointing off this site — and putting it behind the
 *   same route would mean that route sometimes encodes a place and sometimes encodes a
 *   setting. Two routes, one generator: the picture is made by the same function.
 *
 * WHY THE LINK IS READ HERE AND NEVER PASSED IN
 *   A `?url=` parameter would let any signed-in staff member print a code pointing anywhere
 *   and hand it to a guest as the restaurant's. The link comes from the one setting the owner
 *   edits under Customer engagement, which is already what the guest's phone shows after the
 *   meal — so the card and the phone can never send a happy guest to two different pages.
 */
export const GET = handler(async (): Promise<NextResponse> => {
  const staff = await currentStaff();
  if (!staff) return fail(401, { code: 'unauthenticated', message: 'Sign in to view a table code.' });
  // The same grant as the table codes: this is one of the printable codes, not a new kind.
  if (!staff.grants.can('tables.qr')) {
    return fail(403, {
      code: 'forbidden',
      message: 'Viewing table codes is not part of your role.',
      permission: 'tables.qr',
    });
  }

  const settings = await readAllSettings();
  const engagement = (settings.engagement ?? {}) as { reviewUrl?: unknown };
  const reviewUrl = typeof engagement.reviewUrl === 'string' ? engagement.reviewUrl.trim() : '';

  if (!reviewUrl) {
    return fail(404, {
      code: 'not-found',
      message: 'No Google review link is set. Add one under Settings → Customer engagement, then print again.',
    });
  }
  // Only a real web address becomes a code. A guest scanning the back of a stand gets exactly
  // what the owner typed; a typo here is a card that has to be reprinted, not a silent fix.
  if (!/^https:\/\/\S+$/i.test(reviewUrl)) {
    return fail(422, {
      code: 'validation',
      message: 'The Google review link must start with https:// before it can be printed.',
    });
  }

  const svg = await brandedQrSvg(reviewUrl);
  return new NextResponse(svg, { headers: svgHeaders('jalsa-google-review') });
});
