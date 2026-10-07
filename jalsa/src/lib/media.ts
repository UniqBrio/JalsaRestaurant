/**
 * media - what an uploaded image must be, checked the same way on the phone and on the server
 * (items 23 and 32, 25-Sep-2026).
 *
 * PNG or JPEG, 1 MB at most. The TYPE is read from the file's own first bytes, not from its name
 * or the type the browser claims: a `.png` that is really a PDF is refused, and a JPEG named
 * `photo.PNG` is accepted as the JPEG it is.
 */

export const MAX_IMAGE_BYTES = 1024 * 1024;

export type ImageKind = 'png' | 'jpeg';

export const IMAGE_CONTENT_TYPE: Record<ImageKind, string> = { png: 'image/png', jpeg: 'image/jpeg' };

/** The file's real type from its signature, or null for anything that is not PNG or JPEG. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  return null;
}

export const IMAGE_MESSAGES = {
  tooBig: (bytes: number): string =>
    `That image is ${(bytes / (1024 * 1024)).toFixed(1)} MB. Choose a PNG or JPEG of 1 MB or less.`,
  wrongType: 'Only PNG or JPEG images can be used. Choose a .png, .jpg or .jpeg file.',
  empty: 'That file is empty. Choose a PNG or JPEG image.',
} as const;

/** Why this file cannot be used, or null when it can. One sentence the owner can act on. */
export function imageProblem(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return IMAGE_MESSAGES.empty;
  if (bytes.length > MAX_IMAGE_BYTES) return IMAGE_MESSAGES.tooBig(bytes.length);
  if (!sniffImage(bytes)) return IMAGE_MESSAGES.wrongType;
  return null;
}

/** The two places an image may live. Anything else is not a path this app serves. */
export type MediaFolder = 'menu' | 'brand';

/** `/api/media/menu/<uuid>.png` - the only shape of URL stored in `image_url` / `logo_url`. */
export const MEDIA_URL = /^\/api\/media\/(menu|brand)\/[0-9a-f-]{36}\.(png|jpg)$/;

export const isMediaUrl = (url: string): boolean => MEDIA_URL.test(url);

/**
 * A takeaway order's photo (07-Oct-2026): `/api/media/takeaway/<bill uuid>/<uuid>.jpg`.
 *
 * NOT PUBLIC, unlike `menu/` and `brand/`: an order's photo is the restaurant's business, not a
 * guest's. The serving route answers it only to a signed-in staff member or owner who may see
 * orders, for a bill of their own restaurant whose photo it is now. Same private bucket, same
 * PNG/JPEG and 1 MB rule - no second bucket.
 */
export const TAKEAWAY_PHOTO_URL = /^\/api\/media\/takeaway\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.(png|jpg)$/;

export const isTakeawayPhotoUrl = (url: string): boolean => TAKEAWAY_PHOTO_URL.test(url);

/** The bill a takeaway photo URL belongs to, or null when it is not one. */
export function takeawayPhotoBill(url: string): string | null {
  return TAKEAWAY_PHOTO_URL.exec(url)?.[1] ?? null;
}
