import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COOKIE_NAMES } from '../../src/lib/cookie-names';

/**
 * The owner console and the staff app keep separate sign-ins (24-Sep correction list, G2).
 *
 * Both surfaces read ONE cookie, so a handset the owner had once used for the console was signed
 * in as the owner on /staff too, and every round from it was recorded against the owner (live:
 * KOT-129, placed from Javeed's session on Imran's bill). Each surface now has its own cookie;
 * every reader names the surface it serves, and signing in or out touches that one only.
 */

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

test('each surface has its own cookie, and neither is the guest one', () => {
  const names = [COOKIE_NAMES.staff, COOKIE_NAMES.owner, COOKIE_NAMES.guest];
  expect(new Set(names).size).toBe(3);
  /* SUPERSEDED 25-Sep-2026 (review): previously asserted the staff app KEPT 'jalsa_staff'. Every
     owner sign-in before the split was written into that cookie, so an owner session on a
     captain's phone would have survived the deploy on /staff. The old name is honoured by nobody. */
  expect(names).not.toContain('jalsa_staff');
  const sessions = code('src/lib/sessions.ts');
  expect(sessions).toContain("(surface === 'owner' ? COOKIE_NAMES.owner : COOKIE_NAMES.staff)");
  expect(sessions).toContain("return value === 'owner' ? 'owner' : 'staff';");
  expect(sessions).toContain('readStaffSession(surface: Surface)');
  expect(sessions).toContain('writeStaffSession(surface: Surface, s: StaffSession)');
  expect(sessions).toContain('clearStaffSession(surface: Surface)');
});

test('every owner route reads the owner session, every staff route the staff session', () => {
  const owner = filesUnder('src/app/api/owner').filter((f) => code(f).includes('currentStaff('));
  const staff = ['src/app/api/staff/action/route.ts', 'src/app/api/staff/state/route.ts'];
  // A scan that found nothing would pass by finding nothing.
  expect(owner.length).toBeGreaterThanOrEqual(7);
  for (const f of owner) {
    expect(code(f), f).toContain("currentStaff('owner')");
    expect(code(f), f).not.toContain("currentStaff('staff')");
  }
  for (const f of staff) expect(code(f), f).toContain("currentStaff('staff')");
});

test('no reader anywhere asks for "whichever session is there"', () => {
  const all = filesUnder('src');
  expect(all.length).toBeGreaterThan(50);
  for (const f of all) {
    expect(code(f), f).not.toMatch(/currentStaff\(\)|readStaffSession\(\)|clearStaffSession\(\)/);
  }
});

test('each page signs in to, and gates on, its own surface', () => {
  for (const surface of ['owner', 'staff']) {
    const page = code(`src/app/${surface}/page.tsx`);
    expect(page).toContain(`currentStaff('${surface}')`);
    expect(page).toContain(`<PinSignIn surface="${surface}" />`);
    expect(page).toContain(`<ChoosePin name={staff.name} surface="${surface}" />`);
  }
});

test('sign-in, sign-out and choose-PIN act on the surface they were called for', () => {
  const session = code('src/app/api/staff/session/route.ts');
  expect(session).toContain('const surface = surfaceFrom(input.surface);');
  expect(session).toContain("signInWithPin((input.pin ?? '').trim(), surface)");
  expect(session).toContain('clearStaffSession(surfaceFrom(input.surface))');
  expect(session).toContain("surface === 'owner' ? 'owner console' : 'staff app'");
  const pin = code('src/app/api/staff/pin/route.ts');
  expect(pin).toContain('const staff = await currentStaff(surface);');
  expect(pin.match(/writeStaffSession\(surface, /g)?.length).toBe(2);
  expect(code('src/lib/db/auth.ts')).toContain('await writeStaffSession(surface, session);');

  expect(code('src/features/staff/PinSignIn.tsx')).toContain('JSON.stringify({ pin: value, surface })');
  const choose = code('src/features/staff/ChoosePin.tsx');
  expect(choose).toContain('JSON.stringify({ current, next: chosen, surface })');
  expect(choose).toContain('JSON.stringify({ skip: true, surface })');
  expect(choose).toContain('JSON.stringify({ surface })');
  expect(code('src/features/owner/OwnerConsole.tsx')).toContain("JSON.stringify({ surface: 'owner' })");
  expect(code('src/features/staff/StaffApp.tsx')).toContain("JSON.stringify({ surface: 'staff' })");
});
