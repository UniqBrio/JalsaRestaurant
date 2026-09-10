'use client';
/**
 * CP-21 — a wide table is CONFIGURABLE, and the configuration is remembered.
 *
 * THE PROBLEM THIS SOLVES
 *   Past three or four columns, a table stops fitting and starts scrolling sideways, so most of
 *   it is off screen at any moment. Which columns matter is not a property of the table — it is
 *   a property of the task. Chasing renewals wants the dates; checking setup wants the flags.
 *   A fixed layout cannot guess, so it guesses wrong for everyone, and the columns someone
 *   actually needs are the ones they scroll to every single time.
 *
 * WHY THE PREFERENCE PERSISTS
 *   The entire point of hiding a column is not wanting to see it again. Re-hiding six columns
 *   after every reload makes the feature worse than not having it.
 *
 * WHY BROWSER STORAGE AND NOT THE DATABASE
 *   This is one person's view of one table on one screen. It has no meaning on another device
 *   and none to anyone else. Putting it in the database costs a migration, an endpoint and a
 *   round trip before the table can render — paid on every page load, forever, to persist a
 *   preference nobody else can read.
 *
 * Storage is best-effort throughout: private windows and blocked site data make every access
 * THROW rather than return null, so a read that fails falls back to the declared defaults and
 * the table still renders.
 */
import { useCallback, useMemo, useState } from 'react';

export interface ColumnDef {
  /** Stable identity. Never the array index — an inserted column renumbers every one after it. */
  key: string;
  label: string;
  /** A column the table is unreadable without. It may be reordered but never hidden. */
  required?: boolean;
}

export interface ColumnPrefs {
  /** Left-to-right render order, every known key exactly once. */
  order: string[];
  hidden: Set<string>;
  toggle: (key: string) => void;
  move: (key: string, direction: -1 | 1) => void;
  reset: () => void;
  /** True when the user has changed anything — lets the control advertise that a filter is on. */
  customised: boolean;
}

/**
 * Reconcile a stored preference against the columns that exist NOW.
 *
 * Both directions matter, and both are release-day bugs:
 *   - a column ADDED in a later release must appear, not vanish because an old stored order
 *     never mentioned it;
 *   - a column REMOVED must be dropped, not leave a key that later indexes into nothing.
 *
 * A new column is inserted where the CODE says it belongs — anchored after the last column it
 * normally follows, rather than before the first one it normally precedes. Those differ once the
 * user has reordered anything: if someone moved a normally-last column to the front, "before the
 * first column I precede" puts the newcomer at position 0 — the most prominent slot in the
 * table, for a column nobody asked for.
 *
 * Pure and exported on purpose: this is the part with all the branches, so it is the part worth
 * testing exhaustively without a browser.
 */
export function reconcileOrder(storedOrder: string[] | null | undefined, allKeys: string[]): string[] {
  const known = (storedOrder ?? []).filter((k) => allKeys.includes(k));
  // De-duplicate: a corrupted or hand-edited entry must not render a column twice.
  const out: string[] = [];
  for (const k of known) if (!out.includes(k)) out.push(k);

  for (const key of allKeys) {
    if (out.includes(key)) continue;
    const home = allKeys.indexOf(key);
    let pos = 0;
    for (let i = 0; i < out.length; i++) {
      if (allKeys.indexOf(out[i]!) < home) pos = i + 1;
    }
    out.splice(pos, 0, key);
  }
  return out;
}

/** Every storage touch is wrapped: access itself throws in a private window. */
function readStored(storageKey: string): { order?: string[]; hidden?: string[] } | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as { order?: string[]; hidden?: string[] }) : null;
  } catch {
    return null;
  }
}

function writeStored(storageKey: string, value: { order: string[]; hidden: string[] }): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* storage unavailable — the session still works, it just will not persist */
  }
}

/**
 * @param columns  The full column set, in the order the code considers canonical.
 * @param storageKey  Unique per table. Version it (`invoices.columns.v1`) so a future change to
 *                    the stored SHAPE cannot be misread as a user preference.
 */
export function useColumnPrefs(columns: ColumnDef[], storageKey: string): ColumnPrefs {
  const allKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const requiredKeys = useMemo(() => new Set(columns.filter((c) => c.required).map((c) => c.key)), [columns]);

  const [order, setOrder] = useState<string[]>(() => allKeys);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [customised, setCustomised] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Hydration happens on the first client render for a given key, by adjusting state DURING
  // render rather than in an effect. React re-runs this component before painting, so there is
  // no flash of the default column set - and unlike an effect, it never causes a second commit.
  // It still never runs on the server: `hydratedFor` starts null there and storage is not read
  // until the first client pass.
  if (typeof window !== 'undefined' && hydratedFor !== storageKey) {
    const stored = readStored(storageKey);
    setHydratedFor(storageKey);
    setOrder(reconcileOrder(stored?.order, allKeys));
    // A column that became required since the preference was stored must not stay hidden.
    setHidden(new Set((stored?.hidden ?? []).filter((k) => allKeys.includes(k) && !requiredKeys.has(k))));
    setCustomised(Boolean(stored));
  }

  const persist = useCallback(
    (nextOrder: string[], nextHidden: Set<string>) => {
      setOrder(nextOrder);
      setHidden(nextHidden);
      setCustomised(true);
      writeStored(storageKey, { order: nextOrder, hidden: [...nextHidden] });
    },
    [storageKey]
  );

  const toggle = useCallback(
    (key: string) => {
      if (requiredKeys.has(key)) return; // a required column is reorderable, never hideable
      const next = new Set(hidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(order, next);
    },
    [hidden, order, persist, requiredKeys]
  );

  const move = useCallback(
    (key: string, direction: -1 | 1) => {
      const from = order.indexOf(key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= order.length) return; // ends are a no-op, never a wrap
      const next = [...order];
      next.splice(to, 0, ...next.splice(from, 1));
      persist(next, hidden);
    },
    [hidden, order, persist]
  );

  const reset = useCallback(() => {
    setOrder(allKeys);
    setHidden(new Set());
    setCustomised(false);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* nothing to clear if storage was never reachable */
    }
  }, [allKeys, storageKey]);

  return { order, hidden, toggle, move, reset, customised };
}
