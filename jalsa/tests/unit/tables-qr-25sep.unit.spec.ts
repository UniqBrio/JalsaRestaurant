import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { BLOCK_TABLE_HEADING, blockTablePosterSvg, brandedQrSvg } from '../../src/lib/qr-svg';

/**
 * Tables & QR - 25-Sep correction list, items 31-34. (35/36 are mark-free-a5.unit.spec.ts.)
 *
 * SCANNING IS TESTED BY SCANNING. `jsqr` decodes the very code `brandedQrSvg` encodes - same
 * text, same error-correction level H, same 2-module margin - rasterised with its centre square
 * (the badge / logo square plus its quiet border, 22% x 1.24 of the width) OBSCURED: painted
 * white, then filled with noise, which is worse than any logo. If that reads, a logo there reads.
 * A phone camera on paper is physical verification, still pending.
 */

const code = (p: string): string => readFileSync(p, 'utf8');
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

function decodeWithCentreObscured(target: string, fill: 'white' | 'noise'): string | null {
  const qr = QRCode.create(target, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const margin = 2;
  const scale = 8;
  const size = (n + margin * 2) * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y += 1)
    for (let x = 0; x < n; x += 1)
      if (qr.modules.get(y, x))
        for (let dy = 0; dy < scale; dy += 1)
          for (let dx = 0; dx < scale; dx += 1) {
            const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
  // The badge square as brandedQrSvg places it, with its quiet border (0.22 * 1.24 of the width).
  const cover = size * 0.22 * 1.24;
  const from = Math.floor((size - cover) / 2);
  let seed = 7;
  for (let y = from; y < from + cover; y += 1)
    for (let x = from; x < from + cover; x += 1) {
      const i = (y * size + x) * 4;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = fill === 'white' ? 255 : seed % 2 ? 0 : 255;
      px[i] = px[i + 1] = px[i + 2] = v;
    }
  return jsQR(px, size, size)?.data ?? null;
}

for (const target of ['https://jalsa.example/t/A5', 'https://jalsa.example/q', 'https://g.page/r/some-restaurant-review-link/review']) {
  test(`item 31/33: ${target} still scans with the logo square obscured`, () => {
    expect(decodeWithCentreObscured(target, 'white')).toBe(target);
    expect(decodeWithCentreObscured(target, 'noise')).toBe(target);
  });
}

test('item 31: with a logo uploaded, the code carries it in the badge square; without one, the drawn badge', async () => {
  const withLogo = await brandedQrSvg('https://jalsa.example/t/A5', { bytes: PNG, contentType: 'image/png' });
  expect(withLogo).toContain('href="data:image/png;base64,');
  expect(withLogo).toContain('clip-path="url(#jalsa-logo-clip)"');
  const plain = await brandedQrSvg('https://jalsa.example/t/A5');
  expect(plain).not.toContain('data:image');
  expect(plain).toContain('<path transform=');
  // Every code route asks for the restaurant's logo.
  expect(code('src/app/api/owner/qr/route.ts')).toContain('const logo = await restaurantLogo();');
  expect(code('src/app/api/owner/review-qr/route.ts')).toContain('await brandedQrSvg(reviewUrl, await restaurantLogo())');
});

test('item 32: the logo is uploaded under Restaurant details, shown, replaceable, and only a stored file is accepted', () => {
  const panel = code('src/features/owner/sections/SettingsSection.tsx');
  expect(panel).toContain('testId="owner-identity-logo-picker"');
  expect(panel).toContain("action: 'upload-image', folder: 'brand'");
  expect(panel).toContain('logo_url: r.logo_url ?? \'\',');
  const m = code('src/lib/db/owner-mutations.ts');
  expect(m).toContain("That logo was not uploaded here. Choose the image again.");
  // The column's own default (NOT NULL, the Jalsa badge) still saves - details with no upload.
  expect(m).toContain("logo !== '/brand/jalsa-badge.png'");
  // The brand folder needs the identity grant.
  expect(m).toContain("demand(input.actor, input.folder === 'brand' ? 'set.identity' : 'menu.item_edit');");
});

test('item 33: "Scan to Block Your Table" is its own poster, of the door code, and says it is not a table code', async () => {
  const poster = await blockTablePosterSvg('https://jalsa.example/q', 'Jalsa Restaurant', { bytes: PNG, contentType: 'image/png' });
  expect(poster).toContain(BLOCK_TABLE_HEADING);
  expect(poster).toContain('Jalsa Restaurant');
  expect(poster).toContain('data:image/png;base64,');
  expect(poster).toContain("This is not a table&#39;s ordering code.".replace('&#39;', "'"));
  // One width and one height on the nested code - valid SVG.
  const nested = poster.slice(poster.indexOf('<svg x="140"'), poster.indexOf('>', poster.indexOf('<svg x="140"')));
  expect(nested.match(/ width=/g)).toHaveLength(1);
  const route = code('src/app/api/owner/qr/route.ts');
  expect(route).toContain("if (!table && poster === 'block')");
  expect(code('src/features/owner/sections/SettingsSection.tsx')).toContain('src="/api/owner/qr?poster=block"');
});

test('item 34: Add Table offers AC, Non-AC and Terrace, and keeps a zone a table already has', () => {
  const panel = code('src/features/owner/sections/SettingsSection.tsx');
  expect(panel).toContain("const TABLE_ZONES = ['AC', 'Non-AC', 'Terrace'] as const;");
  expect(panel).toMatch(/<Select\s+id="owner-table-zone"/);
  expect(panel).toContain('TABLE_ZONES.includes(editing.zone');
  // Saved through the existing table write, shown when the table is edited.
  expect(panel).toContain('zone: editing.zone,');
  expect(panel).toContain('setEditing({ id: t.id, name: t.name, zone: t.zone');
});

/*
 * 26-Sep-2026 — the door code, every table stand and the review face still showed the drawn "J".
 * `restaurant.logo_url` defaults to the bundled `/brand/jalsa-badge.png` (the Jalsa logo the
 * Settings page shows), but restaurantLogo() accepted only an uploaded `/api/media/` file and
 * returned null for the default, so brandedQrSvg drew its fallback badge. The bundled badge is a
 * logo too: it is read from public/ and embedded like an upload.
 */
test('item 31: the bundled Jalsa badge counts as a logo for the centre of every code', () => {
  const m = code('src/lib/db/restaurant-logo.ts');
  expect(m).toContain("'/brand/jalsa-badge.png'");
  expect(m).toContain("join(process.cwd(), 'public', 'brand', 'jalsa-badge.png')");
  expect(m, 'the bundled file is sniffed like an upload, never trusted by its name').toContain('sniffImage(bytes)');
  expect(existsSync('public/brand/jalsa-badge.png')).toBe(true);
});
