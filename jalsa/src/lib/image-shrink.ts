/**
 * image-shrink - a phone photo made small enough to send (07-Oct-2026).
 *
 * WHY
 *   A phone camera's photo is 2-12 MB; the media rule is PNG or JPEG of 1 MB at most (`media.ts`),
 *   checked again on the server. Refusing every camera photo would make "take a photo" useless,
 *   so a picker that asks for it draws the picture onto a canvas, at most `MAX_SIDE` pixels on
 *   its long side, and saves it as JPEG - lowering the quality, then the size, until it fits.
 *   The server still checks the bytes it receives; this only makes a fitting file likely.
 */
import { MAX_IMAGE_BYTES } from './media';

export const MAX_SIDE = 1600;
const QUALITIES = [0.85, 0.75, 0.6, 0.5] as const;

/** Width and height scaled to fit `max` on the long side, never enlarged. */
export function fitWithin(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max || long <= 0) return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  const k = max / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** The JPEG bytes of `file`, at most 1 MB if it can be done; null when the browser cannot read it. */
export async function shrinkToJpeg(file: Blob): Promise<Uint8Array | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    let side = MAX_SIDE;
    for (let pass = 0; pass < 4; pass += 1) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, side);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, width, height);
      for (const q of QUALITIES) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
        if (!blob) return null;
        if (blob.size <= MAX_IMAGE_BYTES) return new Uint8Array(await blob.arrayBuffer());
      }
      side = Math.round(side * 0.7);
    }
    return null;
  } finally {
    bitmap.close();
  }
}
