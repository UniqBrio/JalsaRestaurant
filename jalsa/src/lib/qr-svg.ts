import QRCode from 'qrcode';
import { themeValues } from '@/theme/tokens.generated';

/**
 * qr-svg — the ONE generator for every code Jalsa prints, and where the badge goes into it.
 *
 * WHY SVG AND NOT PNG
 *   The old route produced a PNG, and a PNG is pixels: putting the badge in the middle needs a
 *   compositor, and this project has none installed. A vector code is text — the QR library
 *   emits one as a `path` — and a second shape can be written into it with string arithmetic.
 *   It also prints sharper at any size, which matters on a stand read across a table.
 *
 * WHY THE BADGE IS DRAWN HERE AND NOT LOADED
 *   An SVG served as an image cannot reference another file: browsers refuse external images
 *   inside image-context SVGs for the same reason they refuse scripts there. And a runtime read
 *   of `public/brand/mark-light.svg` from a serverless function is a file that may not have
 *   been traced into the bundle. So the glyph's path data lives here, byte for byte the shape
 *   in `mark-light.svg`, and every colour comes from the token file — not from the asset —
 *   which is what the hardcoded-colour audit demands of any file under `src/`.
 *
 * WHY 22% AND NOT BIGGER
 *   Error-correction level H recovers a code with up to 30% of its modules unreadable. A badge
 *   22% wide covers about 5% of the area, and the quiet zone around it a little more. That is
 *   comfortably inside the margin on a card that will also be scratched, folded and read
 *   through a water jug — the reason the level was H before the badge existed.
 */

/** The J from `public/brand/mark-light.svg`, in that file's own 64-unit box. */
const MARK_GLYPH =
  'M41 17v22.5c0 6.2-4.2 10-10.5 10-5.1 0-8.9-2.6-10.3-6.9l6.1-2c.7 2 2.2 3.1 4.2 3.1 2.5 0 4-1.7 4-4.6V17z';

const MARK_BOX = 64;
/** Fraction of the code's width the badge takes. See the header for why not more. */
const BADGE_SHARE = 0.22;
/** Rendered size of the root element, in CSS pixels. The old PNG was 720; the stand prints it at ~6cm. */
const RENDER_PX = 720;

const n = (v: number): string => v.toFixed(2).replace(/\.?0+$/, '');

/**
 * A QR code for `target`, the Jalsa badge in its centre, as an SVG document string.
 *
 * `target` is encoded as given. Deciding WHAT to encode — a table, the door, a review page —
 * is the caller's job, and this function has deliberately no opinion about it.
 */
/**
 * The restaurant's own logo, for the centre of the code (item 31, 25-Sep-2026): the bytes of the
 * PNG or JPEG uploaded under Restaurant details. Embedded as a data URI - the one kind of image an
 * SVG shown as an image may carry - in exactly the square the drawn badge used, so the share of
 * the code it covers, and therefore how well the code reads, is unchanged.
 */
export interface QrLogo {
  bytes: Uint8Array;
  contentType: 'image/png' | 'image/jpeg';
}

export async function brandedQrSvg(target: string, logo?: QrLogo | null): Promise<string> {
  const light = themeValues.light;
  const raw = await QRCode.toString(target, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: light.primary, light: light.surface },
  });

  const box = raw.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!box) throw new Error('The QR renderer returned no viewBox; the badge cannot be placed.');
  const size = Number(box[1]);

  const badge = size * BADGE_SHARE;
  const origin = (size - badge) / 2;
  const quiet = badge * 0.12;
  const radius = badge * 0.3;
  const scale = badge / MARK_BOX;

  // Curves inside a code drawn with crisp edges would render jagged; the overlay opts out.
  const uploaded = logo
    ? '<g shape-rendering="geometricPrecision">' +
      `<rect x="${n(origin - quiet)}" y="${n(origin - quiet)}" width="${n(badge + quiet * 2)}" height="${n(badge + quiet * 2)}" rx="${n(radius + quiet)}" fill="${light.surface}"/>` +
      `<clipPath id="jalsa-logo-clip"><rect x="${n(origin)}" y="${n(origin)}" width="${n(badge)}" height="${n(badge)}" rx="${n(radius)}"/></clipPath>` +
      `<image x="${n(origin)}" y="${n(origin)}" width="${n(badge)}" height="${n(badge)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#jalsa-logo-clip)" href="data:${logo.contentType};base64,${Buffer.from(logo.bytes).toString('base64')}"/>` +
      '</g>'
    : null;
  const overlay =
    uploaded ??
    '<g shape-rendering="geometricPrecision">' +
    `<rect x="${n(origin - quiet)}" y="${n(origin - quiet)}" width="${n(badge + quiet * 2)}" height="${n(badge + quiet * 2)}" rx="${n(radius + quiet)}" fill="${light.surface}"/>` +
    `<rect x="${n(origin)}" y="${n(origin)}" width="${n(badge)}" height="${n(badge)}" rx="${n(radius)}" fill="${light.primary}"/>` +
    `<circle cx="${n(size / 2)}" cy="${n(size / 2)}" r="${n(badge * 0.406)}" fill="none" stroke="${light.onPrimary}" stroke-width="${n(scale * 1.5)}" stroke-dasharray="${n(scale * 3)} ${n(scale * 4)}" opacity="0.8"/>` +
    `<path transform="translate(${n(origin)} ${n(origin)}) scale(${n(scale)})" d="${MARK_GLYPH}" fill="${light.onPrimary}"/>` +
    '</g>';

  return raw
    .replace('shape-rendering="crispEdges">', `shape-rendering="crispEdges" width="${RENDER_PX}" height="${RENDER_PX}">`)
    .replace('</svg>', `${overlay}</svg>`);
}

/** XML-escape a line of text that goes into the poster. */
const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const BLOCK_TABLE_HEADING = 'Scan to Block Your Table';
export const BLOCK_TABLE_NOTE = 'Join the queue from your phone. We will hold the next table for you.';

/**
 * "Scan to Block Your Table" - the poster for the entrance (item 33, 25-Sep-2026).
 *
 * The SAME code the door has always had (`/q`, the queue that holds a table for a party),
 * built by `brandedQrSvg` with the restaurant's logo in it, under a heading that says what it is
 * for - so nobody at the door mistakes it for a table's ordering code, and nobody at a table
 * mistakes the table code for this. A portrait sheet; colours from the token file.
 */
export async function blockTablePosterSvg(target: string, restaurantName: string, logo?: QrLogo | null): Promise<string> {
  const light = themeValues.light;
  const code = await brandedQrSvg(target, logo);
  // The code's own size attributes come off, so the poster can place and size it.
  const inner = code
    .replace(/^<\?xml[^>]*>/, '')
    .replace(` width="${RENDER_PX}" height="${RENDER_PX}"`, '')
    .replace('<svg ', '<svg x="140" y="250" width="520" height="520" ');
  const W = 800;
  const H = 1100;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="${light.surface}"/>` +
    `<rect x="0" y="0" width="${W}" height="18" fill="${light.primary}"/>` +
    `<text x="${W / 2}" y="120" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="58" font-weight="700" fill="${light['text.heading']}">${esc(BLOCK_TABLE_HEADING)}</text>` +
    `<text x="${W / 2}" y="190" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="600" fill="${light.primary}">${esc(restaurantName)}</text>` +
    inner +
    `<text x="${W / 2}" y="850" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="28" fill="${light['text.body']}">${esc(BLOCK_TABLE_NOTE)}</text>` +
    `<text x="${W / 2}" y="905" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="22" fill="${light['text.muted']}">This is not a table's ordering code.</text>` +
    `<rect x="0" y="${H - 18}" width="${W}" height="18" fill="${light.primary}"/>` +
    '</svg>'
  );
}

/** The headers every code is served with. One place, so the two routes cannot drift. */
export function svgHeaders(filename: string): Record<string, string> {
  return {
    'content-type': 'image/svg+xml; charset=utf-8',
    // An hour, under a URL that already carries the logo it is drawn with (src/lib/qr-url.ts). A
    // captain flicking through twenty tables still does not re-render twenty images; a change to
    // how a code is DRAWN reaches every screen within the hour rather than the day it took on
    // 26-Sep-2026, when a fixed badge sat unseen behind a day-long cache.
    'cache-control': 'private, max-age=3600',
    'content-disposition': `inline; filename="${filename}.svg"`,
  };
}
