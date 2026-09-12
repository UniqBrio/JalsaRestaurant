/**
 * guest-features — the optional things a guest's phone may show, and what they are OFF or ON
 * by default.
 *
 * WHY THIS IS ITS OWN FILE
 *   Two places need these defaults and they are on opposite sides of the server boundary: the
 *   guest payload (server-only) fills the gaps in the owner's saved document, and the owner's
 *   Settings panel (a client component) has to draw a switch for a key the owner has never
 *   saved. Held in `guest-view.ts` — which is `import 'server-only'` — the panel could not read
 *   them, so it guessed "anything unsaved is ON". That guess is wrong for the first feature
 *   whose default is OFF, and it would have been wrong silently: the switch would have drawn
 *   itself ON while every phone drew the feature OFF.
 *
 *   One file, one set of defaults, both sides importing it. There is no second answer to give.
 */

export interface GuestFeatures {
  captainName: boolean;
  waiterName: boolean;
  askForPerson: boolean;
  water: boolean;
  callCaptain: boolean;
  plates: boolean;
  parcelRest: boolean;
  waterBottle: boolean;
  askBill: boolean;
  special: boolean;
  combos: boolean;
  festival: boolean;
  favourites: boolean;
  hoursBtn: boolean;
  occasion: boolean;
  heart: boolean;
  upsell: boolean;
  takeaway: boolean;
  tip: boolean;
  whatsapp: boolean;
  suggestion: boolean;
  review: boolean;
  /**
   * Whether the running order total is revealed on the guest's phone WITHOUT them asking.
   *
   * OFF by default, and that is the whole point of it: a table watching a number climb orders
   * differently from a table reading a menu. The guest is never denied the figure — the tick
   * box in the bottom bar is theirs and it is always there — but the default is "eat first".
   * Per-dish prices are untouched by this switch; nobody orders blind.
   */
  orderTotal: boolean;
}

export const DEFAULT_FEATURES: GuestFeatures = {
  captainName: true,
  waiterName: false,
  askForPerson: true,
  water: true,
  callCaptain: true,
  plates: true,
  parcelRest: true,
  waterBottle: true,
  askBill: false,
  special: true,
  combos: true,
  festival: true,
  favourites: true,
  hoursBtn: true,
  occasion: true,
  heart: true,
  upsell: true,
  takeaway: true,
  tip: true,
  whatsapp: true,
  suggestion: true,
  review: true,
  orderTotal: false,
};

/**
 * The owner's saved document, with every gap filled from the defaults above.
 *
 * WHY A FUNCTION RATHER THAN A SPREAD AT EACH CALL SITE
 *   There were two call sites and they disagreed. The guest payload spread the defaults; the
 *   owner's Settings panel had no access to them (they lived behind `server-only`) and read an
 *   absent key as "on" instead. For twenty-two features that guess was right by luck. For a
 *   feature that is off by default it is wrong, and wrong in the worst direction: the switch
 *   says the guest can see their total, and the guest cannot.
 *
 *   One function, both sides, no second answer.
 */
export function resolveFeatures(stored: unknown): GuestFeatures {
  const saved = typeof stored === 'object' && stored !== null ? (stored as Partial<GuestFeatures>) : {};
  return { ...DEFAULT_FEATURES, ...saved };
}
