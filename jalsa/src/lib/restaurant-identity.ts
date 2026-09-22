/**
 * restaurant-identity — who this restaurant is, read from the one place that knows.
 *
 * WHY THIS MODULE EXISTS AT ALL
 *   Three screens read the restaurant's own name off the owner payload, and every one of them
 *   asked for a column that does not exist. `restaurant` has `legal_name` and `display_name`;
 *   none of it has ever had `name`. So every read was `undefined`, every fallback fired, and the
 *   printer preview, the WhatsApp bill and the HR documents each quietly printed a constant.
 *
 *   The reason it went unnoticed for so long is worth recording: `address`, `phone`,
 *   `signatory_name` and the rest ARE real columns and DO resolve. Only the name was wrong, on a
 *   header where every other line was right — so it read as a configured value rather than a
 *   default, and renaming the restaurant in Settings changed nothing anywhere.
 *
 * WHAT IT REFUSES TO DO
 *   It does not fall back to a restaurant's name. A hardcoded "Jalsa Restaurant" in a shared
 *   module would be the same defect with better manners: correct for exactly one customer and
 *   silently wrong for the next. An unconfigured field comes back as an empty string, and the
 *   screen decides what to say about it.
 *
 * THE TWO NAMES, AND WHICH ONE TO USE
 *   `legal_name` is the REGISTERED name ("Registered name" on the Restaurant details screen) and
 *   belongs on anything that is a record: a tax invoice, a payslip, an offer letter.
 *   `display_name` is "Name guests see" and belongs on anything a guest reads as hospitality.
 *   A ticket the guest is handed is both, so `billName` takes the display name and falls back to
 *   the registered one rather than to nothing.
 */

export interface RestaurantIdentity {
  /** "Registered name" — the legal entity. */
  legalName: string;
  /** "Name guests see" — the trading name. */
  displayName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
}

const str = (row: Record<string, unknown>, key: string): string => {
  const v = row[key];
  return typeof v === 'string' ? v.trim() : '';
};

/**
 * Reads the identity off the raw `restaurant` row the owner payload carries.
 *
 * `gstin` is NOT on that row — it is an owner setting, under `settings.tax` — so it is passed in
 * rather than guessed at. Two sources, named honestly, beats one source that is wrong about half
 * of what it claims.
 */
export function restaurantIdentity(
  row: Record<string, unknown> | null | undefined,
  tax?: { gstin?: unknown }
): RestaurantIdentity {
  const r = row ?? {};
  return {
    legalName: str(r, 'legal_name'),
    displayName: str(r, 'display_name'),
    address: str(r, 'address'),
    phone: str(r, 'phone'),
    email: str(r, 'email'),
    gstin: typeof tax?.gstin === 'string' ? tax.gstin.trim() : '',
  };
}

/**
 * The name to put on something a guest receives — a ticket, a WhatsApp bill.
 *
 * Empty when the restaurant has configured neither, and that emptiness is deliberate: a screen
 * that shows nothing prompts somebody to go and fill it in, while a screen showing a default
 * prompts nobody and ships the default to a customer.
 */
export function billName(identity: RestaurantIdentity): string {
  return identity.displayName || identity.legalName;
}
