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
  if (!staff.grants.can('tables.qr')) {
    return fail(403, {
      code: 'forbidden',
      message: 'Viewing table codes is not part of your role.',
      permission: 'tables.qr',
    });
  }

  const table = new URL(req.url).searchParams.get('table');
  if (!table) return fail(400, { code: 'validation', message: 'Which table?' });

  const target = `${publicConfig.qrOrigin.replace(/\/+$/, '')}/t/${encodeURIComponent(table)}`;
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
      'content-disposition': `inline; filename="jalsa-table-${table}.png"`,
    },
  });
});
