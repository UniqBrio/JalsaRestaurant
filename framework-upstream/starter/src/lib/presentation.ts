/**
 * presentation - the boundary between a CANONICAL value and what a user reads (CP-32).
 *
 * THE DEFECT THIS EXISTS TO REMOVE
 *   `status` is `'active' | 'paused' | 'archived'`, and the shortest thing a component can
 *   write is `{item.status}`. It renders. It passes every "the field is visible" assertion.
 *   And the user reads `active` - a database value, lowercase, in a product that capitalises
 *   every other label. Nobody decided that; it is simply what came out when nobody decided.
 *
 *   The reason this needs a mechanism rather than care is that the wrong path is SHORTER than
 *   the right one. `{item.status}` is nineteen characters; a label lookup is more. Any rule
 *   that asks people to type more, forever, to avoid a defect they cannot see, loses.
 *
 * THE TWO HALVES, AND WHY BOTH ARE HERE
 *   1. The canonical value NEVER CHANGES. It is what the database stores, what the API sends,
 *      what filters and sorts compare, what permissions and state machines branch on, and what
 *      a `data-testid` is built from. Renaming `active` to `Active` to make it read nicely is
 *      the opposite of this pattern: it makes the defect invisible by spreading it into the
 *      schema.
 *   2. The label is a PRODUCT decision, owned by PRODUCT_LEXICON, and is allowed to change
 *      without a migration - which is the entire reason the two must not be one string.
 *
 * TOTALITY IS ENFORCED BY THE TYPE SYSTEM, NOT BY VIGILANCE
 *   `labels` is `Record<T, string>` over the union itself, so adding `'paused'` to the union
 *   makes the build fail until a label exists for it. That is the protection that actually
 *   holds: the moment a new state is introduced is the moment the question is asked, rather
 *   than six months later when a user reports reading `paused` on a screen.
 */
import { sentenceCase } from './text-format';

export type LabelMap<T extends string> = Readonly<Record<T, string>>;

export interface Presentation<T extends string> {
  /** The canonical members, in declaration order. Use for radio groups, filters, seed data. */
  readonly values: readonly T[];
  /** The label for a value KNOWN to be in the union. Total: there is no missing case. */
  label(value: T): string;
  /**
   * The label for a string that is NOT known to be in the union - one that arrived from an API,
   * an import or a URL. This is the lossy boundary and the only place a fallback exists.
   */
  from(raw: string): string;
  /** `{ value, label }` pairs, for a select, a radio group or a column filter. */
  options(): readonly { readonly value: T; readonly label: string }[];
  /** Review/test helper: which of these raw values have no declared label. */
  unknown(raws: readonly string[]): readonly string[];
}

/**
 * Humanise a machine identifier for display when nothing better is known.
 *
 * `in_progress` becomes `In progress`, not `In_progress`: an underscore on screen is the raw
 * identifier leaking through with a capital letter on it, which is the same defect wearing a
 * hat. This is a DEGRADATION, not a substitute for a declared label - a declared label can say
 * "Awaiting approval" for a value called `pending_2`, and no transformation ever will.
 */
export function humanise(raw: string): string {
  // ONLY separators are split. A camelCase split was here and was removed: it turns
  // `sent_to_WhatsApp` into "Sent to Whats App", which is the precise corruption DR-1 exists
  // to prevent - and it was covering a shape that is not canonical anyway, since a machine
  // identifier is lower/snake/kebab by definition (see check-presentation-labels).
  const spaced = raw.replace(/[_-]+/g, ' ').trim();
  // The tail is NOT lowercased, for the reason text-format gives at length: that is how
  // "WhatsApp" becomes "Whatsapp". `inProgress` reads as "In Progress", which is acceptable;
  // silently corrupting a product name is not.
  return sentenceCase(spaced);
}

/**
 * Declare the presentation of one canonical vocabulary.
 *
 *   export const itemStatus = presentation<ItemStatus>({ active: 'Active', archived: 'Archived' });
 *   itemStatus.label(item.status)   // 'Active'  - what the user reads
 *   item.status                     // 'active'  - what everything else uses, unchanged
 */
export function presentation<T extends string>(labels: LabelMap<T>): Presentation<T> {
  const values = Object.keys(labels) as T[];
  const known = new Set<string>(values);
  return {
    values,
    label: (value: T) => labels[value],
    from: (raw: string) => (known.has(raw) ? labels[raw as T] : humanise(raw)),
    options: () => values.map((value) => ({ value, label: labels[value] })),
    unknown: (raws: readonly string[]) => [...new Set(raws.filter((r) => !known.has(r)))],
  };
}
