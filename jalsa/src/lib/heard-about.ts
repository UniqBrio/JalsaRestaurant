/**
 * heard-about — how guests said they found Jalsa, counted (24-Sep list, H2).
 *
 * The answers live in ONE place, `guest_session.heard_about`, written by the guest's welcome
 * screen. This module only counts them; it stores nothing and invents no second field.
 *
 * WHY THE COUNT FOLDS CASE AND SPACING
 *   The picker lets a guest type their own answer, so "Instagram", "instagram " and "INSTAGRAM"
 *   all arrive. Counted as three sources, the biggest channel would look like three small ones.
 *   They are folded together and shown with the spelling seen first.
 */
export interface HeardTally {
  source: string;
  count: number;
  /** Whole-number percent of all answers in the range. */
  share: number;
}

export function tallyHeard(answers: readonly string[]): HeardTally[] {
  const seen = new Map<string, { source: string; count: number }>();
  for (const raw of answers) {
    const source = raw.trim().replace(/\s+/g, ' ');
    if (!source) continue;
    const key = source.toLowerCase();
    const row = seen.get(key) ?? { source, count: 0 };
    row.count += 1;
    seen.set(key, row);
  }
  const total = [...seen.values()].reduce((a, r) => a + r.count, 0);
  return [...seen.values()]
    .map((r) => ({ ...r, share: total > 0 ? Math.round((r.count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}
