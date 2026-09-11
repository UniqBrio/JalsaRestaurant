/**
 * The reference record. Deliberately domain-free (an "item" with a name and a status), because
 * the starter is a worked example of the PATTERNS, not of any business.
 *
 * `status` is the delete model (CP-26): the reference schema ARCHIVES. There is no delete -
 * the read filters archived rows out, the partial unique index frees the name, and the verb on
 * every control says "archive", because a control that says Delete and archives is a lie the
 * user acts on.
 *
 * `schedule` exists to be NOT rendered by the form. The unchanged-edit spec proves that a field
 * the form never loaded still round-trips on save; without such a field there would be nothing
 * for that proof to be about.
 */
export type ItemStatus = 'active' | 'archived';

// A type alias, not an interface, on purpose: the list controls take `Row = Record<string,
// unknown>`, and an object type satisfies that while an interface (no index signature) does
// not. The alias lets the generic hook be used directly, with no cast in either direction.
export type Item = {
  readonly id: string;
  readonly name: string;
  readonly status: ItemStatus;
  readonly schedule?: readonly string[];
};

/** What the form edits. Everything else on the record rides along untouched (CP-25). */
export interface ItemDraft {
  readonly name: string;
  readonly status: ItemStatus;
}
