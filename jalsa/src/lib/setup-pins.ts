/**
 * setup-pins - the shared setup codes, which open nothing.
 *
 * WHY SIGN-IN REFUSES THEM (26-Oct-2026 audit, SEC-01)
 *   On 10-Sep every account was given the same issued PIN, `1234`, marked provisional (KL-4). The
 *   mitigation was that a provisional PIN opens only "choose your own PIN" - but that screen
 *   accepts `1234` as the current PIN, and it has a "Skip for now". So whoever typed the shared
 *   code FIRST - a member of staff, or anybody on the internet who guessed the most-tried PIN
 *   there is - owned that account. Four live accounts were still on it on 26-Oct (counted
 *   read-only on production), one of them a cashier who may record payments and discounts.
 *
 *   Refusing the code at sign-in closes that door for every account at once, and costs nothing
 *   legitimate: the owner's Generate PIN draws a fresh, unique code and never one of these, and
 *   `set_own_pin` refuses all of them as a new PIN, so the ONLY way an account holds one is the
 *   shared seed. A person still on it signs in with the code the owner issues them instead.
 *
 * The list is exactly the one `set_own_pin` refuses (migration 20260910073000) - a spec parses that
 * file and fails if the two ever differ.
 */
export const SHARED_SETUP_CODES: ReadonlySet<string> = new Set(['1234', '0000', '1111', '4321']);

export const isSharedSetupCode = (pin: string): boolean => SHARED_SETUP_CODES.has(pin);
