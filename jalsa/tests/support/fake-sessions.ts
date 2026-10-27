/**
 * fake-sessions — stands in for `@/lib/sessions` in round-budget scenarios (round-rig.ts).
 * The real module reads cookies through `next/headers`, which only exists inside a request.
 * A scenario sets `globalThis.__fakeSession` to say who is calling.
 */
import { COOKIE_NAMES } from '@/lib/cookie-names';

export interface StaffSession {
  staffId: string;
  name: string;
  role: string;
  initials: string;
  provisional: boolean;
  issuedAt: number;
}

const g = globalThis as unknown as {
  __fakeSession?: { guestToken?: string | null; staff?: StaffSession | null; address?: string };
};

export async function readGuestToken(): Promise<string | null> {
  return g.__fakeSession?.guestToken ?? null;
}
/** Records the token a route handler persisted, so a scenario can see the minted-token path ran. */
export async function writeGuestToken(token: string): Promise<void> {
  (globalThis as unknown as { __fakeWrittenToken?: string }).__fakeWrittenToken = token;
}
export function newGuestToken(): string {
  return 'minted-token';
}
export async function clearGuestToken(): Promise<void> {}
export async function readStaffSession(): Promise<StaffSession | null> {
  return g.__fakeSession?.staff ?? null;
}
export async function writeStaffSession(): Promise<void> {}
export async function clearStaffSession(): Promise<void> {}
export function encodeStaffSession(): string {
  return '';
}
export function decodeStaffSession(): StaffSession | null {
  return null;
}
/** As the real one: anything but exactly 'owner' is the staff app (27-Oct-2026, sign-in scenarios). */
export function surfaceFrom(value: unknown): 'owner' | 'staff' {
  return value === 'owner' ? 'owner' : 'staff';
}
/** The caller's address (27-Oct-2026, sign-in throttle): `__fakeSession.address`, else none. */
export async function clientAddress(): Promise<string> {
  return g.__fakeSession?.address ?? '';
}
export { COOKIE_NAMES };
