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

const g = globalThis as unknown as { __fakeSession?: { guestToken?: string | null; staff?: StaffSession | null } };

export async function readGuestToken(): Promise<string | null> {
  return g.__fakeSession?.guestToken ?? null;
}
export async function writeGuestToken(): Promise<void> {}
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
export { COOKIE_NAMES };
