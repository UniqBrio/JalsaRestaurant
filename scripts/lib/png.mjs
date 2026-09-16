/**
 * png - write a minimal, valid PNG with no dependency.
 *
 * WHY THIS EXISTS
 *   A PWA is installable only if it declares a raster icon: Android's launcher needs a
 *   maskable one to cut its own shape from, and iOS's home screen will not take an SVG at all.
 *   So "installable with no manual configuration" is false unless a real PNG ships in the box.
 *
 *   The alternatives were both worse. Committing two binary blobs makes the launcher icon the
 *   one brand asset that does NOT follow `design/tokens.json` - rebrand the app and its icon
 *   stays the old colour, which is exactly the drift the token file exists to prevent. Adding
 *   a rasteriser (sharp, resvg, canvas) puts a native-compiled dependency in the path of every
 *   scaffold for two flat images.
 *
 *   Node already ships zlib, and a PNG is a zlib stream in four chunks. Forty lines is cheaper
 *   than either alternative and keeps the icon inside the token system.
 *
 * WHAT IT DELIBERATELY IS NOT
 *   An image library. 8-bit RGBA, one IDAT, filter 0 on every scanline. It draws the flat
 *   placeholder mark the starter ships so an app is installable on day one - and every app is
 *   expected to replace that artwork with its own. It is not a rasteriser and must never grow
 *   into one: an SVG needing rendering is a job for a real tool, run by hand, once.
 */
import zlib from 'node:zlib';

/* CRC-32 as PNG specifies it. The table is built once - the per-byte form is measurably slower
 * and this runs for every icon on every theme build. */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** '#RRGGBB' or '#RGB' -> [r,g,b]. The token file is the only source these ever come from. */
export function rgb(hex) {
  const h = String(hex).replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) throw new Error(`png: not a hex colour: ${hex}`);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The starter's placeholder launcher icon: a full-bleed field in one token colour with a
 * centred disc in another.
 *
 * FULL-BLEED IS THE POINT, not laziness. A maskable icon is cropped by the platform to
 * whatever shape it likes - circle, squircle, rounded square - so any transparent margin
 * becomes a visible gap, and any artwork outside the middle 80% is liable to be cut off. A
 * flat field can be cropped to any shape without damage, and the disc sits well inside the
 * safe zone at 56% of the width.
 */
export function maskableIconPng(size, fieldHex, markHex) {
  const [fr, fg, fb] = rgb(fieldHex);
  const [mr, mg, mb] = rgb(markHex);
  const c = (size - 1) / 2;
  const r = size * 0.28;          // disc radius: 56% of the width, inside the 80% safe zone
  const rows = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    rows[p++] = 0;                // filter type 0 (None) for every scanline
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      // One-pixel linear feather, so the disc does not read as a staircase at 192px.
      const a = d <= r - 0.5 ? 1 : d >= r + 0.5 ? 0 : r + 0.5 - d;
      rows[p++] = Math.round(fr + (mr - fr) * a);
      rows[p++] = Math.round(fg + (mg - fg) * a);
      rows[p++] = Math.round(fb + (mb - fb) * a);
      rows[p++] = 255;            // fully opaque: a maskable icon may have no transparency
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;                    // bit depth
  ihdr[9] = 6;                    // colour type 6 = RGBA
  // 10,11,12 = deflate / adaptive filtering / no interlace, all zero by construction.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    // level 9: written once per build, read on every install. Determinism matters more than
    // speed here - the same tokens must produce the same bytes, or G1 reports drift forever.
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
