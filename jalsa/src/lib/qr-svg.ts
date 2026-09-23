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
export async function brandedQrSvg(target: string): Promise<string> {
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
  const overlay =
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

/** The headers every code is served with. One place, so the two routes cannot drift. */
export function svgHeaders(filename: string): Record<string, string> {
  return {
    'content-type': 'image/svg+xml; charset=utf-8',
    // Immutable for a day: the content is a pure function of its inputs, and a captain flicking
    // through twenty tables should not re-render twenty images.
    'cache-control': 'private, max-age=86400',
    'content-disposition': `inline; filename="${filename}.svg"`,
  };
}
