/**
 * qr-url — the ONE way a screen names a QR image, so the picture's inputs are in its URL.
 *
 * WHY (26-Sep-2026)
 *   A code is cached by the browser under its URL. The route said "keep it for a day", and the
 *   URL never changed - so when the logo in the middle changed, every screen kept showing the old
 *   picture for a day, and the owner, reasonably, reported the fix as not working. The logo is an
 *   input to the picture; an input belongs in the URL. `v` is a short hash of `logo_url`: a new
 *   logo is a new URL, fetched at once, and the day's cache still saves a captain flicking
 *   through twenty tables from twenty renders.
 *
 *   A hash, not the URL itself, so the address stays short and carries no path of the upload.
 *
 * AND WHAT THE CODE SAYS IS AN INPUT TOO (12-Oct-2026)
 *   The review code encodes the owner's Google review link, and `v` hashed only the logo. A stand
 *   or the Settings preview opened while the database still held the seeded placeholder
 *   (`https://g.page/r/jalsa-hosur/review`, not a real page) kept that picture for an hour after
 *   the real link was saved - a code that opens Google's error instead of the review page. The
 *   review link is now hashed into `v` with the logo, and the review path cannot be named without
 *   it (the overload below), so the same omission cannot be made again by a new screen.
 */
export type QrImagePath = '/api/owner/qr' | '/api/owner/review-qr';

/** FNV-1a, 32-bit, as eight hex digits. Not security: a cache key that changes when its input does. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The review code: `reviewUrl` is the saved link it encodes - required, it is in the picture. */
export function qrImageUrl(
  path: '/api/owner/review-qr',
  restaurant: Record<string, unknown>,
  params: Record<string, string>,
  reviewUrl: string
): string;
export function qrImageUrl(path: '/api/owner/qr', restaurant: Record<string, unknown>, params?: Record<string, string>): string;
export function qrImageUrl(
  path: QrImagePath,
  restaurant: Record<string, unknown>,
  params: Record<string, string> = {},
  reviewUrl?: string
): string {
  const q = new URLSearchParams(params);
  const logo = typeof restaurant.logo_url === 'string' ? restaurant.logo_url : '';
  // The logo alone keeps every table code's URL exactly as it was; the review link joins it only
  // for the review code.
  q.set('v', fnv1a(reviewUrl === undefined ? logo : `${logo}\n${reviewUrl.trim()}`));
  return `${path}?${q.toString()}`;
}
