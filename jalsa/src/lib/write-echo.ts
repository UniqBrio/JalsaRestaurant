/**
 * write-echo — the two small decisions that sit either side of a write, kept pure so they can
 * be tested without a browser, a network or a database.
 *
 * Both exist because of the same afternoon (12-Sep-2026): "the tip addition or removing tip is
 * taking too long", and a request for a custom tip amount on the same screen.
 */

/**
 * The new state a write answered with, if it answered with one.
 *
 * A write used to answer `{ ok: true }` and the phone would then GO AND FETCH what the server
 * had just finished writing — one round trip to another region, sometimes two, because a read a
 * person caused is never dropped and a poll may already be in flight. The server can simply
 * include it. This decides whether it did.
 *
 * Deliberately strict about what counts: `null` and `undefined` are "no echo, go and read",
 * and so is a primitive. A state is an object or it is not a state, and treating a stray
 * `state: "ok"` as one would blank the screen.
 */
export function echoedState<T>(parsed: unknown): T | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const value = (parsed as { state?: unknown }).state;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as T;
}

export type TipEntry = { ok: true; amount: number } | { ok: false; problem: string };

/**
 * What a typed custom tip means.
 *
 * There is no upper bound, on purpose: judging one needs the bill as a NUMBER on the phone, and
 * this application keeps every rupee of arithmetic on the server. A guest who mistypes taps the
 * amount and corrects it; nothing is charged until a member of staff records the closure.
 */
export function parseCustomTip(draft: string): TipEntry {
  const text = draft.trim();
  if (text === '') return { ok: false, problem: 'Enter an amount first.' };
  if (!/^\d+$/.test(text)) {
    return { ok: false, problem: 'Whole rupees, please — digits only.' };
  }
  const amount = Number(text);
  if (!Number.isSafeInteger(amount)) {
    return { ok: false, problem: 'That is not an amount we can take.' };
  }
  if (amount <= 0) {
    // Zero is not a custom tip, it is "No tip" — and that button is already on the row.
    return { ok: false, problem: 'For no tip at all, tap No tip.' };
  }
  return { ok: true, amount };
}
