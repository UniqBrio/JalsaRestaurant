import 'server-only';
import { currentRestaurantId, db } from '@/lib/supabase/server';
import { isMediaUrl, sniffImage } from '@/lib/media';
import type { QrLogo } from '@/lib/qr-svg';

/**
 * The logo uploaded under Restaurant details, as bytes for the centre of a QR code (item 31).
 *
 * Null - and the drawn Jalsa badge is used - when none is uploaded, when the stored URL is not one
 * this app wrote, or when the file cannot be read. A code must always come out: a missing logo is
 * a plainer code, never a broken one.
 */
export async function restaurantLogo(): Promise<QrLogo | null> {
  try {
    const restaurantId = await currentRestaurantId();
    const { data } = await db().from('restaurant').select('logo_url').eq('id', restaurantId).maybeSingle();
    const url = (data?.logo_url as string | null) ?? '';
    if (!isMediaUrl(url)) return null;
    const { data: file, error } = await db().storage.from('media').download(url.replace('/api/media/', ''));
    if (error || !file) return null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(bytes);
    return kind ? { bytes, contentType: kind === 'png' ? 'image/png' : 'image/jpeg' } : null;
  } catch {
    return null;
  }
}
