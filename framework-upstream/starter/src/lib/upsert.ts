/**
 * CP-9 — safe writes against a real unique constraint.
 *
 * THE BUG THIS PREVENTS
 *   A double-tap, a network retry and a duplicated webhook are the SAME event as far as your
 *   API can tell. Only the database can distinguish them, and only if you asked it to.
 *
 *   The naive version — "check whether it exists, then insert" — is a race, not a guard: two
 *   concurrent requests both see nothing and both insert. The window is small and therefore
 *   the bug is rare, intermittent, and extremely expensive to reproduce.
 *
 * THE RULE
 *   Enumerate the table's unique constraints from the LIVE schema (never from memory, and
 *   never from the migration files alone — an object can exist in the database and in no
 *   migration). Then make the write idempotent against each one.
 */

export interface UpsertOptions<T> {
  /** The columns of the real unique constraint. Naming them is what makes this reviewable. */
  conflictColumns: (keyof T)[];
  /** Columns to update on conflict. Omit to make the conflict a no-op. */
  updateColumns?: (keyof T)[];
}

/**
 * Prefer a single database-level upsert over read-then-write. It is atomic; the read-then-write
 * pattern is not, however carefully it is written.
 */
export function buildUpsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
  { conflictColumns, updateColumns }: UpsertOptions<T>
): { sql: string; params: unknown[] } {
  const cols = Object.keys(row);
  const params = Object.values(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`);

  const conflict = conflictColumns.map(String).join(', ');
  const setClause = (updateColumns ?? [])
    .map(String)
    .filter((c) => !conflictColumns.map(String).includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  const action = setClause ? `do update set ${setClause}` : 'do nothing';

  return {
    sql: `insert into ${table} (${cols.join(', ')}) values (${placeholders.join(', ')})
          on conflict (${conflict}) ${action}
          returning *`,
    params,
  };
}

/**
 * Client-side dedupe key for a non-idempotent action. Generated ONCE when the user opens the
 * form — not when they press Save. Generated at submit time it is different on every tap,
 * which is precisely the case it is supposed to collapse.
 */
export const newIdempotencyKey = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
