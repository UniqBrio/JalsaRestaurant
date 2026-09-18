import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { fail, handler } from '@/lib/route';
import { publicConfig } from '@/lib/config';
import { currentStaff } from '@/lib/db/auth';
import { themeValues } from '@/theme/tokens.generated';

/**
 * The tabletop QR code, as an image.
 *
 * IT IS GENERATED, NOT STORED, AND THAT IS THE POINT
 *   The code encodes one thing: `<origin>/t/<table>`. Nothing about a bill, a session or a
 *   guest is in it, so the same laminated card works for every party, forever, and renaming a
 *   table in Settings does not invalidate it. A stored image would be a second copy of a fact
 *   that changes.
 *
 * COLOUR COMES FROM THE TOKEN MAP, NOT FROM A LITERAL
 *   A QR is painted by a library that cannot read a stylesheet, so it needs real values — the
 *   same reason the browser-chrome colour does. Taking them from the generated token map means
 *   a rebrand carries the printed codes with it, and the contrast that makes a code SCANNABLE
 *   is the same contrast the theme gate already measured.
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
    kind of object — a PNG of a URL that identifies a PLACE and nothing else — so they are made
    the same way rather than by a second endpoint with its own size, colours and cache policy.

    `?table=` absent means the entrance. Not a separate `?kind=` parameter: the presence of a
    table name is already the only question being asked, and a second parameter would allow the
    nonsensical pair (kind=queue, table=A5) that this shape simply cannot express.

    THE ENTRANCE CODE CARRIES NOTHING ABOUT A PARTY. No token, no party size, no queue row id,
    no session. It is the same laminated card every night, whoever is standing at the door, and
    it does not change when the queue opens or closes — the page it points at answers that.
  */
  const table = new URL(req.url).searchParams.get('table');
  const origin = publicConfig.qrOrigin.replace(/\/+$/, '');
  const target = table ? `${origin}/t/${encodeURIComponent(table)}` : `${origin}/q`;
  const png = await QRCode.toBuffer(target, {
    type: 'png',
    width: 720,
    // High correction, because these live on a table under a water jug and get scratched.
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: themeValues.light.primary, light: themeValues.light.surface },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      // Immutable for a day: the content is a pure function of origin + table name, and a
      // captain flicking through twenty tables should not re-render twenty images.
      'cache-control': 'private, max-age=86400',
      'content-disposition': `inline; filename="${table ? `jalsa-table-${table}` : 'jalsa-entrance-queue'}.png"`,
    },
  });
});
