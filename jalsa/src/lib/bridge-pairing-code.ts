import { randomInt } from 'node:crypto';
import { hashToken } from './bridge-token';

/**
 * bridge-pairing-code — the pure arithmetic of pairing a printing computer.
 *
 * WHAT A PAIRING CODE IS FOR
 *   An owner should never copy a 69-character bearer token into a text file on a kitchen PC. So
 *   Jalsa shows a short code, the Windows installer asks for it once, and the bridge exchanges it
 *   for an ordinary `bridge_token` — hashed, revocable, restaurant-scoped, exactly the Gate 1
 *   credential. The code is a one-time ticket to obtain that credential, and nothing more.
 *
 * WHY EIGHT CHARACTERS FROM THIS ALPHABET
 *   The redeem endpoint is necessarily unauthenticated — the PC has nothing to authenticate with
 *   yet — so the code's entropy IS the protection. Six digits is 10^6, guessable in an afternoon
 *   against a serverless endpoint with no rate limiter. Eight characters from a 31-symbol alphabet
 *   is 31^8 ≈ 8.5 × 10^11, live for ten minutes and single-use. The alphabet drops 0/O, 1/I/L so
 *   a code read across a kitchen is typed right the first time.
 *
 * SEPARATE FROM THE DATABASE CODE ON PURPOSE (same reason as `bridge-token.ts`): a rule nothing can
 * execute is a rule nobody has seen work. Everything here runs in a unit spec.
 */

export const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 8;
/** How long a code may wait to be typed. Long enough to download and install; short enough to be useless if photographed. */
export const PAIRING_TTL_MINUTES = 10;

/** A fresh code, from the CSPRNG. `randomInt` is uniform — no modulo bias. */
export function newPairingCode(): string {
  let out = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i += 1) out += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  return out;
}

/** `ABCD-EFGH`, the way the owner reads it off the screen. */
export const formatPairingCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;

/**
 * What a person typed, reduced to the code — or null when it cannot be one.
 *
 * Case, spaces and dashes are forgiven because people add them. Characters outside the alphabet
 * are NOT silently mapped (no "O means 0"): the alphabet has no ambiguous pairs, so a character
 * outside it is a mistyping, and guessing what was meant would widen the space an attacker hits.
 */
export function normalizePairingCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, '');
  if (code.length !== PAIRING_CODE_LENGTH) return null;
  for (const ch of code) if (!PAIRING_ALPHABET.includes(ch)) return null;
  return code;
}

/** Stored and matched by hash, like a token — a dump of the table yields no usable code. */
export const hashPairingCode = (code: string): string => hashToken(`pair:${code}`);

export const pairingExpiry = (now: Date): string => new Date(now.getTime() + PAIRING_TTL_MINUTES * 60_000).toISOString();

/** Why a code did not redeem, decided from the row the hash found (or did not find). */
export type PairingVerdict = 'ok' | 'unknown' | 'used' | 'expired';

export function pairingVerdict(
  row: { expires_at: string; used_at: string | null } | null,
  now: Date
): PairingVerdict {
  if (!row) return 'unknown';
  if (row.used_at !== null) return 'used';
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'ok';
}

/**
 * What the installer shows the person at the PC. Plain sentences: this is read by whoever is
 * standing at the kitchen computer, often not the owner.
 */
export const PAIRING_MESSAGES: Record<Exclude<PairingVerdict, 'ok'>, string> = {
  unknown: 'That code is not right. Check the code shown in Jalsa under Printers and type it again.',
  used: 'That code has already been used. In Jalsa, open Printers and get a new code.',
  expired: 'That code has expired. In Jalsa, open Printers and get a new code.',
};
