import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { serverConfig } from '@/lib/config';
import { COOKIE_NAMES } from '@/lib/cookie-names';

/**
 * sessions - the two kinds of session this application has, and nothing else.
 *
 *   STAFF   A person who typed a four-digit PIN. Their identity is what makes every order,
 *           discount, cancellation and closure attributable (Standard 6.2), so it is signed
 *           and it names them.
 *
 *   GUEST   A phone that scanned a table's QR. It is NOT a person and NOT an account. It
 *           carries an opaque token whose meaning lives entirely in the database, so the
 *           phone holds no bill, no total and no table - only a key that the server resolves
 *           (Standard 6.5). Closing the browser therefore loses nothing, and editing the
 *           cookie buys nothing.
 *
 * WHY A SIGNED COOKIE AND NOT A LIBRARY
 *   The payload is four short fields and the requirement is "the browser cannot change it".
 *   HMAC over a JSON payload does exactly that in twenty lines, with no dependency to keep
 *   current. There is deliberately no encryption: the contents are the signed-in person's own
 *   name and role, which they can already see on screen.
 */

const STAFF_COOKIE = COOKIE_NAMES.staff;
const GUEST_COOKIE = COOKIE_NAMES.guest;

/** A shift, not a week. Long enough to survive a phone locking; short enough that a handset
 *  left on a counter overnight is signed out by morning. */
const STAFF_TTL_SECONDS = 14 * 60 * 60;

export interface StaffSession {
  staffId: string;
  name: string;
  role: string;
  initials: string;
  /**
   * True while the PIN is still the one somebody ELSE issued.
   *
   * A session in this state proves who typed the code, not that the code is theirs — so it opens
   * "choose your own PIN" and nothing else. It is carried in the signed cookie so the check
   * costs no query, and it is re-derived from the database on every sign-in, so a person who
   * has since chosen their own never sees the prompt again.
   */
  provisional: boolean;
  /** Seconds since epoch. */
  issuedAt: number;
}

const b64url = (b: Buffer): string => b.toString('base64url');

function sign(payload: string): string {
  return b64url(crypto.createHmac('sha256', serverConfig().sessionSecret).update(payload).digest());
}

export function encodeStaffSession(s: StaffSession): string {
  const payload = b64url(Buffer.from(JSON.stringify(s), 'utf8'));
  return `${payload}.${sign(payload)}`;
}

export function decodeStaffSession(raw: string | undefined): StaffSession | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);

  // timingSafeEqual throws on a length mismatch, which is itself a signal - so the length is
  // checked first and both paths return the same "no session".
  const expected = sign(payload);
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as StaffSession;
    if (typeof s.staffId !== 'string' || typeof s.issuedAt !== 'number') return null;
    if (Date.now() / 1000 - s.issuedAt > STAFF_TTL_SECONDS) return null;
    return s;
  } catch {
    return null;
  }
}

export async function readStaffSession(): Promise<StaffSession | null> {
  const jar = await cookies();
  return decodeStaffSession(jar.get(STAFF_COOKIE)?.value);
}

export async function writeStaffSession(s: StaffSession): Promise<void> {
  const jar = await cookies();
  jar.set(STAFF_COOKIE, encodeStaffSession(s), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STAFF_TTL_SECONDS,
  });
}

export async function clearStaffSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(STAFF_COOKIE);
}

/* --- Guest ------------------------------------------------------------- */

export function newGuestToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export async function readGuestToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value ?? null;
}

export async function writeGuestToken(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // A seating, generously. The bill is the real lifetime - this is only how long the phone
    // keeps its key to it.
    maxAge: 8 * 60 * 60,
  });
}

export async function clearGuestToken(): Promise<void> {
  const jar = await cookies();
  jar.delete(GUEST_COOKIE);
}

export { COOKIE_NAMES };
