import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { brandedQrSvg, svgHeaders } from '../../src/lib/qr-svg';
import { themeValues } from '../../src/theme/tokens.generated';

/**
 * The badge in the code, the code on the stand, and the review code on its back.
 *
 * Three things are pinned here that a green build cannot see on its own:
 *
 *   1. The picture changed and the ENCODING did not. The table route's target expression is
 *      asserted byte for byte by `indoor-queue.unit.spec.ts`; this file asserts the other half —
 *      that what the route now returns is a vector with the mark in it, and that the mark is
 *      drawn from token colours rather than loaded from a file the function may not carry.
 *   2. The review code encodes the one setting the guest's phone already reads, and refuses to
 *      encode anything passed in. A route that took a `?url=` would let any staff member print a
 *      code pointing anywhere and hand it to a guest as the restaurant's.
 *   3. The instructions on the stand are the owner's words, unparaphrased, as the request said.
 */

const QR_SVG = readFileSync('src/lib/qr-svg.ts', 'utf8');
const TABLE_ROUTE = readFileSync('src/app/api/owner/qr/route.ts', 'utf8');
const REVIEW_ROUTE = readFileSync('src/app/api/owner/review-qr/route.ts', 'utf8');
const STAND = readFileSync('src/features/owner/TableStandSheet.tsx', 'utf8');
const SETTINGS = readFileSync('src/features/owner/sections/SettingsSection.tsx', 'utf8');
const CSS = readFileSync('src/app/globals.css', 'utf8');

const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('the code is a vector with the badge drawn in its centre', async () => {
  const svg = await brandedQrSvg('https://example.test/t/A5');
  expect(svg.startsWith('<svg'), 'an SVG document').toBe(true);
  expect(svg, 'the QR itself is the stroke path the renderer emits').toContain('<path stroke=');
  // The badge: a rounded square in the primary colour, the J glyph on it, both AFTER the code so
  // they paint on top of it.
  const code = svg.indexOf('<path stroke=');
  const badge = svg.indexOf('<g shape-rendering="geometricPrecision">');
  expect(badge, 'the badge is present').toBeGreaterThan(-1);
  expect(badge, 'and is painted over the code, not under it').toBeGreaterThan(code);
  expect(svg).toContain('d="M41 17v22.5c0');
  expect(svg, 'the picture has a size, so an image element without one still lays out').toContain('width="720" height="720"');
});

test('every colour in the picture is a token, and nothing is loaded from outside it', async () => {
  const svg = await brandedQrSvg('https://example.test/q');
  const light = themeValues.light;
  expect(svg).toContain(`fill="${light.primary}"`);
  expect(svg).toContain(`fill="${light.onPrimary}"`);
  expect(svg).toContain(`fill="${light.surface}"`);
  // An SVG served as an image cannot load another file; a reference here would be a blank
  // square on every stand and a green test.
  expect(svg).not.toContain('<image');
  expect(svg).not.toContain('href=');
  // And the source carries no literal: the hardcoded-colour audit would ratchet on one.
  expect(stripComments(QR_SVG)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
});

test('the badge is small enough for level H to read around it', () => {
  // 30% of modules may be lost at level H. 22% of the width is ~5% of the area.
  expect(QR_SVG).toContain("errorCorrectionLevel: 'H'");
  expect(QR_SVG).toContain('const BADGE_SHARE = 0.22;');
});

test('the table route still encodes a place and nothing else, and now serves the vector', () => {
  const code = stripComments(TABLE_ROUTE);
  expect(code).toContain("searchParams.get('table')");
  expect(code).toContain('table ? `${origin}/t/${encodeURIComponent(table)}` : `${origin}/q`');
  expect(code).toContain("staff.grants.can('tables.qr')");
  // SUPERSEDED 25-Sep-2026 (item 31): previously `brandedQrSvg(target)`. One generator still,
  // now handed the restaurant's uploaded logo for its centre.
  expect(code, 'one generator').toContain('brandedQrSvg(target, logo)');
  expect(code, 'one set of headers').toContain("svgHeaders(table ? `jalsa-table-${table}` : 'jalsa-entrance-queue')");
  expect(code, 'the PNG path is gone, not kept beside the new one').not.toContain('toBuffer');
  expect(svgHeaders('x')['content-type']).toBe('image/svg+xml; charset=utf-8');
  expect(svgHeaders('jalsa-table-A5')['content-disposition']).toContain('jalsa-table-A5.svg');
});

test('the review code encodes the setting the phone already shows, and refuses anything passed in', () => {
  const code = stripComments(REVIEW_ROUTE);
  expect(code, 'read from the one setting').toContain('settings.engagement');
  expect(code).toContain('reviewUrl');
  expect(code, 'never from the request').not.toContain('searchParams');
  expect(code, 'and never from a body').not.toContain('body<');
  expect(code, 'behind the same grant as the table codes').toContain("staff.grants.can('tables.qr')");
  // SUPERSEDED 25-Sep-2026 (item 31): previously `brandedQrSvg(reviewUrl)` verbatim. The same
  // generator, now also given the restaurant's logo for its centre.
  expect(code, 'the same generator').toContain('brandedQrSvg(reviewUrl, await restaurantLogo())');
});

test('with no link set, the review route says which setting to fill rather than printing a blank', () => {
  const code = stripComments(REVIEW_ROUTE);
  expect(code).toContain("code: 'not-found'");
  expect(REVIEW_ROUTE).toContain('Settings → Customer engagement');
  // A typed link that is not a web address is refused, so a guest never scans a typo.
  expect(code).toContain('/^https:\\/\\/\\S+$/i');
  expect(code).toContain("code: 'validation'");
});

test('the stand prints as two pages and hides the console behind it', () => {
  expect(STAND, 'the print stylesheet keeps this body').toContain('j-print-root');
  expect(STAND, 'and the back starts a new page').toContain('j-print-break');
  expect(CSS).toContain('.j-print-break {');
  expect(CSS).toContain('break-before: page;');
  expect(STAND, 'print is a button, not a link').toContain('data-testid="owner-stand-print"');
  expect(STAND).toContain('onClick={() => window.print()}');
});

test('the scan instructions are the owner’s words, unparaphrased', () => {
  for (const line of [
    'Open your phone’s Camera',
    'Point the camera at the QR code and wait for the link to appear.',
    'Tap the link to open it.',
    'Open Google Lens and scan the QR code.',
    'Then tap the link shown by Google Lens.',
  ]) {
    expect(STAND, `"${line}" must be printed as given`).toContain(line);
  }
  expect(STAND).toContain('How to scan the QR code');
  expect(STAND).toContain('If the QR code is not recognised');
});

test('the back carries the review code, or says why it cannot', () => {
  expect(STAND).toContain('src="/api/owner/review-qr"');
  expect(STAND, 'a missing link is named, not silently blank').toContain('data-testid="owner-stand-no-review"');
  expect(STAND).toContain('Customer engagement');
  // The two images are generated vectors; the optimiser is bypassed on purpose and says so.
  expect((STAND.match(/eslint-disable-next-line @next\/next\/no-img-element/g) ?? []).length).toBe(2);
});

test('every control on the stand carries a test id', () => {
  const code = stripComments(STAND);
  const tags = [...code.matchAll(/<(button|a|input|select|textarea|Button|Link)(\s[^>]*?)?\/?>/gs)];
  expect(tags.length, 'there are controls to check').toBeGreaterThan(0);
  const missing = tags.filter((m) => !/data-testid=/.test(m[0]));
  expect(missing.map((m) => m[0].slice(0, 60)), 'none may lack an id').toEqual([]);
});

test('Tables & QR offers the stand beside the code, and mounts the sheet', () => {
  expect(SETTINGS).toContain('data-testid={`owner-stand-${t.name}`}');
  expect(SETTINGS).toContain('onClick={() => setStandFor(t.name)}');
  expect(SETTINGS).toContain('<TableStandSheet');
  expect(SETTINGS, 'the stand reads the same settings the phone does').toContain('settings={data.settings}');
});

test('the stand uses the type scale and token colours only', () => {
  const code = stripComments(STAND);
  expect(code).not.toMatch(/text-\[[0-9.]+px\]/);
  expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(code).toContain('type-h2');
  expect(code).toContain('type-caption');
});
