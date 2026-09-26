import 'server-only';
import { currentRestaurantId, db } from '@/lib/supabase/server';
import { isMediaUrl, sniffImage } from '@/lib/media';
import type { QrLogo } from '@/lib/qr-svg';
import { JALSA_BADGE_PNG_BASE64 } from '@/lib/brand-badge.generated';

/**
 * The logo the schema gives every restaurant until one is uploaded: the Jalsa badge bundled with
 * the app. It is what Restaurant details shows under "Logo", so it is what the owner expects in
 * the middle of every code (26-Sep-2026: the door code and every stand still carried the drawn
 * "J", because this reader accepted uploads only and answered null for the default).
 */
const BUNDLED_BADGE_URL = '/brand/jalsa-badge.png';

/**
 * The logo uploaded under Restaurant details, as bytes for the centre of a QR code (item 31).
 *
 * The bundled Jalsa badge when the restaurant has kept the default; the upload when there is one.
 * Null - and the drawn badge is used - when the stored URL is neither, or the file cannot be read.
 * A code must always come out: a missing logo is a plainer code, never a broken one.
 */
export async function restaurantLogo(): Promise<QrLogo | null> {
  try {
    const restaurantId = await currentRestaurantId();
    const { data } = await db().from('restaurant').select('logo_url').eq('id', restaurantId).maybeSingle();
    const url = (data?.logo_url as string | null) ?? '';
    const bytes = url === BUNDLED_BADGE_URL ? bundledBadge() : await uploaded(url);
    if (!bytes) return null;
    const kind = sniffImage(bytes);
    return kind ? { bytes, contentType: kind === 'png' ? 'image/png' : 'image/jpeg' } : null;
  } catch {
    return null;
  }
}

/** An upload written by this app's own media route, or nothing. */
async function uploaded(url: string): Promise<Uint8Array | null> {
  if (!isMediaUrl(url)) return null;
  const { data: file, error } = await db().storage.from('media').download(url.replace('/api/media/', ''));
  if (error || !file) return null;
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * The bundled badge, from the constant scripts/gen-brand-badge.mjs derives from
 * public/brand/jalsa-badge.png. Not a file read: in a Vercel function that depends on the build's
 * file tracing having noticed it, and the only symptom of it not having is the drawn "J" coming
 * back (26-Sep-2026). A constant is in the bundle by construction.
 */
function bundledBadge(): Uint8Array {
  return new Uint8Array(Buffer.from(JALSA_BADGE_PNG_BASE64, 'base64'));
}
