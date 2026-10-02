/**
 * heard-about — how guests said they found Jalsa, counted (24-Sep list, H2).
 *
 * The answers live in `guest_attribution` since 02-Oct-2026 (before that, only on
 * `guest_session.heard_about`, which a released table deleted). This module only counts them.
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

/**
 * The standard choices the welcome screen offers, in the order it offers them (H2). A starting
 * point, not a closed set: a guest may type their own. Not a database enum, for exactly that
 * reason. Lives here, in the pure module, so the guest screen and the owner's report agree.
 */
export const SEEDED_HEARD_SOURCES = ['Google review', 'Friend recommended', 'Ordered earlier', 'Regular customer'] as const;

/**
 * The key two answers share when they are the same answer (02-Oct-2026): case, spacing and
 * punctuation folded - "Google review", "google-review!" and " GOOGLE  REVIEW" are one source.
 * Deliberately no synonyms ("google" is not folded into "Google review"): that would be
 * inventing what a guest meant.
 */
export function heardKey(answer: string): string {
  return answer
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** How long a phone's re-pick counts as CORRECTING its answer rather than a new visit's answer. */
export const HEARD_CORRECTION_HOURS = 4;

export function tallyHeard(
  answers: readonly string[],
  presets: readonly string[] = SEEDED_HEARD_SOURCES
): HeardTally[] {
  /* A plural and its singular are one answer ("Friends recommended" / "Friend recommended",
     "Google reviews"): folded into the standard choice, or into whichever was seen first. Only a
     trailing "s" on a word of four letters or more - nothing smarter is guessed. */
  const singular = (key: string): string =>
    key
      .split(' ')
      .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
      .join(' ');
  const standard = new Map(presets.map((p) => [singular(heardKey(p)), p]));
  const seen = new Map<string, { source: string; count: number }>();
  for (const raw of answers) {
    const typed = raw.trim().replace(/\s+/g, ' ');
    const key = heardKey(typed);
    if (!key) continue;
    // A standard choice keeps its standard spelling; anything else keeps the first one seen.
    const row = seen.get(key) ?? { source: standard.get(singular(key)) ?? typed, count: 0 };
    row.count += 1;
    seen.set(key, row);
  }
  const merged = new Map<string, { source: string; count: number }>();
  for (const [key, row] of seen) {
    const base = singular(key);
    const into = [...merged.keys()].find((k) => singular(k) === base);
    const target = into ? merged.get(into)! : null;
    if (target) {
      target.count += row.count;
      if (standard.has(base)) target.source = standard.get(base)!;
    } else merged.set(key, { ...row });
  }
  const total = [...merged.values()].reduce((a, r) => a + r.count, 0);
  return [...merged.values()]
    .map((r) => ({ ...r, share: total > 0 ? Math.round((r.count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}
