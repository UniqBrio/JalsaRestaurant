#!/usr/bin/env node
/**
 * gen-pwa-icons - render the PWA raster icons from design/tokens.json.
 *
 * WHY A SCRIPT AND NOT A CHECKED-IN PNG
 *   An installed PWA icon is a colour decision that ships as a binary. Hand-exported, it is
 *   the one brand surface that silently keeps the OLD palette after a rebrand, because no
 *   colour gate can read inside a PNG. Generating it from the token file means the icon can
 *   never disagree with the theme: re-run this after `npm run theme:build` and it follows.
 *
 * There is no image library in the toolchain on purpose - a full raster dependency for four
 * files is not a trade worth making. This writes the PNG bytes directly.
 *
 * USAGE  node scripts/gen-pwa-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import process from 'node:process';

const ROOT = process.cwd();
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/tokens.json'), 'utf8'));
const hex = (s) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) throw new Error(`Not a 6-digit hex colour: ${s}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const FIELD = hex(tokens.semantic.primary.light);       // the maroon tile
const INK = hex(tokens.semantic.onPrimary.light);       // the white letterform
const RING = hex(tokens.semantic.accent.dark);          // the gold dashed ring

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Coverage of a rounded square at (x, y), sampled 3x3 so the corners are not stair-stepped. */
const roundedCoverage = (x, y, size, radius, inset) => {
  let hits = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const px = x + (sx + 0.5) / 3;
      const py = y + (sy + 0.5) / 3;
      const lo = inset;
      const hi = size - inset;
      if (px < lo || px > hi || py < lo || py > hi) continue;
      const cx = Math.min(Math.max(px, lo + radius), hi - radius);
      const cy = Math.min(Math.max(py, lo + radius), hi - radius);
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy <= radius * radius) hits++;
    }
  }
  return hits / 9;
};

/** The mark's "J": a vertical stem with a hook, drawn in normalised 0-1 space. */
const inGlyph = (u, v) => {
  const stem = u >= 0.545 && u <= 0.665 && v >= 0.235 && v <= 0.68;
  const hookOuter = (u - 0.545) ** 2 / 0.2 ** 2 + (v - 0.665) ** 2 / 0.155 ** 2 <= 1;
  const hookInner = (u - 0.545) ** 2 / 0.09 ** 2 + (v - 0.665) ** 2 / 0.07 ** 2 <= 1;
  const hook = hookOuter && !hookInner && v >= 0.6 && u <= 0.665;
  const bar = v >= 0.235 && v <= 0.325 && u >= 0.42 && u <= 0.665;
  return stem || hook || bar;
};

const render = (size, maskable) => {
  const pad = maskable ? size * 0.12 : 0;
  const inner = size - pad * 2;
  const radius = maskable ? inner * 0.5 : size * 0.22;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const cover = roundedCoverage(x, y, size, radius, pad);
      const u = (x - pad) / inner;
      const v = (y - pad) / inner;
      // The dashed ring from the mark, drawn as a solid hairline at icon sizes: a dashed
      // stroke below ~64px reads as noise, and the icon is often rendered at 48.
      const r = Math.hypot(u - 0.5, v - 0.5);
      const onRing = r > 0.405 && r < 0.425;
      let rgb = FIELD;
      if (cover > 0 && inGlyph(u, v)) rgb = INK;
      else if (cover > 0 && onRing) rgb = RING;
      const o = 1 + x * 4;
      row[o] = rgb[0];
      row[o + 1] = rgb[1];
      row[o + 2] = rgb[2];
      row[o + 3] = Math.round(cover * 255);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const OUT = path.join(ROOT, 'public/brand');
fs.mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
];
for (const [name, size, maskable] of files) {
  fs.writeFileSync(path.join(OUT, name), render(size, maskable));
  console.log(`wrote  public/brand/${name}  (${size}x${size}${maskable ? ', maskable' : ''})`);
}
