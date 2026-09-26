import { NextResponse } from 'next/server';
import { fail, handler } from '@/lib/route';
import { publicConfig } from '@/lib/config';
import { currentStaff } from '@/lib/db/auth';
import { blockTablePosterSvg, brandedQrSvg, svgHeaders } from '@/lib/qr-svg';
import { currentRestaurantId, db } from '@/lib/supabase/server';
import { restaurantLogo } from '@/lib/db/restaurant-logo';

/**
 * The tabletop QR code, as an image.
 *
 * IT IS GENERATED, NOT STORED, AND THAT IS THE POINT
 *   The code encodes one thing: `<origin>/t/<table>`. Nothing about a bill, a session or a
 *   guest is in it, so the same laminated card works for every party, forever, and renaming a
 *   table in Settings does not invalidate it. A stored image would be a second copy of a fact
 *   that changes.
 *
 * SINCE 23-Sep-2026 THE PICTURE CARRIES THE BADGE
 *   What the code ENCODES is unchanged, and the target expression below is byte for byte what
 *   it was. What changed is the picture: a vector with the Jalsa mark in its centre, made by
 *   `lib/qr-svg.ts`, which also explains why it is an SVG and why the mark is drawn rather than
 *   loaded. Colour still comes from the token map and never from a literal.
 */
export const GET = handler(async (req: Request): Promise<NextResponse> => {
  const staff = await currentStaff();
  if (!staff) return fail(401, { code: 'unauthenticated', message: 'Sign in to view a table code.' });
  /* The same grant governs both: `tables.qr` is "may see the printable codes", and the entrance
     code is one of them. A separate permission would be a second answer to one question. */
  if (!staff.grants.can('tables.qr')) {
    return fail(403, {
      code: 'forbidden',
      message: 'Viewing table codes is not part of your role.',
      permission: 'tables.qr',
    });
  }

  /*
    TWO CODES, ONE GENERATOR.

    A table's code points at `/t/<table>`; the entrance code points at `/q`. They are the same
    kind of object — a picture of a URL that identifies a PLACE and nothing else — so they are
    made the same way rather than by a second endpoint with its own size, colours and cache
    policy. `?table=` absent means the entrance: the presence of a table name is already the
    only question being asked, and a `?kind=` parameter would admit the nonsensical pair
    (kind=queue, table=A5) that this shape simply cannot express.

    THE ENTRANCE CODE CARRIES NOTHING ABOUT A PARTY. No token, no party size, no queue row id,
    no session. It is the same laminated card every night, whoever is standing at the door, and
    it does not change when the queue opens or closes — the page it points at answers that.
  */
  const table = new URL(req.url).searchParams.get('table');
  const poster = new URL(req.url).searchParams.get('poster');
  const origin = publicConfig.qrOrigin.replace(/\/+$/, '');
  const target = table ? `${origin}/t/${encodeURIComponent(table)}` : `${origin}/q`;
  // The restaurant's own logo in the centre when one is uploaded (item 31); the drawn badge otherwise.
  const logo = await restaurantLogo();

  // "Scan to Block Your Table" (item 33): the entrance code, on a poster that says what it is for.
  // Only for the entrance - a table's code is never dressed as a queue poster.
  if (!table && poster === 'block') {
    const { data: r } = await db().from('restaurant').select('display_name,legal_name').eq('id', await currentRestaurantId()).maybeSingle();
    const name = ((r?.display_name as string) || (r?.legal_name as string) || '').trim();
    return new NextResponse(await blockTablePosterSvg(target, name, logo), { headers: svgHeaders('scan-to-block-your-table') });
  }

  const svg = await brandedQrSvg(target, logo);

  return new NextResponse(svg, {
    headers: svgHeaders(table ? `jalsa-table-${table}` : 'jalsa-entrance-queue'),
  });
});
