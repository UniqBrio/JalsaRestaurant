/**
 * select-options - the PURE logic behind the searchable select (DR-5). No DOM, no React, no I/O.
 *
 * WHY THE SPLIT
 *   Filtering, duplicate detection and "may this be added?" are where all the branches live, and
 *   therefore all the bugs. Kept free of the DOM they are exhaustively testable in a plain test
 *   runner, with no browser and no mocks - which is the only reason the edge cases below are
 *   covered at all, because none of them is visible by clicking around.
 *
 * THE RULE THIS EXISTS TO KEEP (DR-5)
 *   A dropdown shows what it already has, filters as you type, and can GROW - `+ Add` when
 *   nothing matches, and what is added is kept.
 *
 * THE DEFECT THIS FILE IS SHAPED AROUND
 *   A list that grows will be offered "Mumbai" when it already holds "mumbai ", and then holds
 *   both. Two entries that look identical to a human are two different values to a database, a
 *   filter and a report - and the report is where somebody finally notices, months later, with
 *   the totals split across a capital letter. So **comparison is normalised and storage is
 *   not**: `+ Add` is refused when a normalised match exists, and the label that IS stored keeps
 *   the user's own capitalisation. Lower-casing it would turn "PDF", "WhatsApp" and every
 *   customer's name into a typo, which is DR-1's rule applied to stored values.
 */

export interface Option {
  /** Stable identity. For a newly added option this is the normalised label until the store assigns one. */
  readonly id: string;
  /** What the user reads - stored EXACTLY as they typed it, capitalisation included. */
  readonly label: string;
}

/**
 * The comparison form: trimmed, inner whitespace collapsed, case-folded.
 *
 * `toLocaleLowerCase` rather than `toLowerCase`: the Turkish dotless i is the standing example -
 * "I".toLowerCase() is "i" in every locale, which silently merges two distinct Turkish letters.
 * This only decides EQUALITY, never what is displayed or stored.
 */
export function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** The display form: trimmed and collapsed, but the user's capitalisation left exactly alone. */
export function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Case-insensitive substring match over the visible label.
 *
 * An EMPTY query returns everything, and that is load-bearing rather than a convenience: DR-5
 * requires the existing options to be visible BEFORE a keystroke. A box that opens empty asks
 * the user to guess what is in it, and they guess by typing something that is already there
 * under a different name - which is how the duplicate problem above starts.
 */
export function filterOptions(options: readonly Option[], query: string): Option[] {
  const q = normalizeLabel(query);
  if (!q) return [...options];
  return options.filter((o) => normalizeLabel(o.label).includes(q));
}

/**
 * May the typed text be added as a new option?
 *
 * No when it is blank, and no when an option already exists whose NORMALISED label matches -
 * even though the raw strings differ. Offering `+ Add "Mumbai"` beside an existing "mumbai" is
 * the duplicate defect being created by the very control meant to prevent it.
 */
export function canAddOption(options: readonly Option[], query: string): boolean {
  const q = normalizeLabel(query);
  if (!q) return false;
  return !options.some((o) => normalizeLabel(o.label) === q);
}

/** The existing option a query duplicates, if any - so the UI can point at it instead of adding. */
export function findExisting(options: readonly Option[], query: string): Option | undefined {
  const q = normalizeLabel(query);
  if (!q) return undefined;
  return options.find((o) => normalizeLabel(o.label) === q);
}

/**
 * Insert a new option, or return the list unchanged when it would duplicate one.
 *
 * Returns the list AND the option that is now current, so a caller never has to re-find it -
 * and when the label duplicated an existing entry, the current option is that EXISTING one.
 * Selecting what the user meant is better than adding what they typed.
 */
export function addOption(
  options: readonly Option[],
  rawLabel: string,
  makeId: (label: string) => string = normalizeLabel,
): { options: Option[]; option: Option | undefined; added: boolean } {
  const label = cleanLabel(rawLabel);
  if (!label) return { options: [...options], option: undefined, added: false };

  const existing = findExisting(options, label);
  if (existing) return { options: [...options], option: existing, added: false };

  const option: Option = { id: makeId(label), label };
  return { options: [...options, option], option, added: true };
}

/**
 * Keyboard navigation over the FILTERED list, with the `+ Add` row counted as one more landing
 * place when it is offered.
 *
 * Index -1 means "on the + Add row". Movement stops at both ends rather than wrapping: a list
 * that wraps sends a user holding the down arrow silently back to the top, and they overshoot
 * the item they were heading for every time.
 */
export function moveActive(
  current: number,
  count: number,
  direction: 1 | -1,
  addRowOffered: boolean,
): number {
  const min = addRowOffered ? -1 : 0;
  const max = count - 1;
  if (max < min) return min;
  const next = current + direction;
  if (next < min) return min;
  if (next > max) return max;
  return next;
}
