/**
 * The review code's image changes the moment the review link does (12-Oct-2026).
 *
 * ROOT CAUSE it pins: the QR image is cached for an hour under its URL, and that URL's version
 * (`v`) hashed only the logo. The review code ENCODES the owner's review link, so a stand or the
 * Settings preview opened while the database held the seeded placeholder
 * (`https://g.page/r/jalsa-hosur/review`) kept showing a code for that placeholder for an hour after
 * the real link was saved - scanned, it opens Google's error, not the review page.
 *
 * FAIL-FIRST (observed 12-Oct-2026, `src/lib/qr-url.ts` at the previous version): "a new review
 * link is a new image URL" failed - the two URLs were identical (both `?v=` of the logo alone).
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { qrImageUrl } from '../../src/lib/qr-url';

const LOGO = { logo_url: '/brand/jalsa-badge.png' };
const SEEDED = 'https://g.page/r/jalsa-hosur/review';
const REAL = 'https://g.page/r/CVXvWzgULZeeEAE/review';

test('a new review link is a new image URL, so no screen can keep the old code', () => {
  // Called with four arguments so the previous two-argument builder also compiles here.
  const call = qrImageUrl as unknown as (p: string, r: Record<string, unknown>, q: Record<string, string>, l: string) => string;
  expect(call('/api/owner/review-qr', LOGO, {}, REAL)).not.toBe(call('/api/owner/review-qr', LOGO, {}, SEEDED));
  // The same link (spaces aside) is the same picture - the hour's cache still works.
  expect(call('/api/owner/review-qr', LOGO, {}, ` ${REAL} `)).toBe(call('/api/owner/review-qr', LOGO, {}, REAL));
});

test('every table code keeps exactly the URL it had - only the review code gained the link', () => {
  // The previous builder's output for a table: `v` is the logo alone.
  expect(qrImageUrl('/api/owner/qr', LOGO, { table: 'A5' })).toBe('/api/owner/qr?table=A5&v=6e909450');
});

test('both screens that show the review code name the saved link in its URL', () => {
  expect(readFileSync('src/features/owner/TableStandSheet.tsx', 'utf8')).toContain(
    "qrImageUrl('/api/owner/review-qr', restaurant, {}, reviewUrl)"
  );
  expect(readFileSync('src/features/owner/sections/SettingsSection.tsx', 'utf8')).toContain(
    "qrImageUrl('/api/owner/review-qr', data.restaurant, {}, savedReview)"
  );
});
