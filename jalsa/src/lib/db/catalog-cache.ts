/**
 * catalog-cache — the menu, the settings and the restaurant row, kept between requests on one
 * server instance, and trusted only while the catalog counter says nothing in them has moved
 * (27-Oct-2026, requests/2026-10-27-performance-security-delivery.md, P-1).
 *
 * WHY
 *   Every full read of every screen re-read the same five catalog tables — the owner's console,
 *   each captain's phone, each guest phone — although they change a few times a day. On the rig
 *   that was 5 of the owner's 31 calls, 4 of a captain's 14 and 4 of a guest's 12, and in
 *   production a call's cost is its place in the burst (402 ms p50 per call in bursts of 21+).
 *
 * WHY IT CANNOT SERVE A STALE MENU
 *   The key is the catalog counter, which a statement-level trigger moves in the SAME transaction
 *   as any write to these tables (migration 20260924120000). The route reads the counter in its
 *   first round and the rows only after it — so rows cached under version V are at least as new
 *   as V, and a request that reads V again finds nothing has committed since. A request that
 *   holds no version (a page's first render, a write's echo, an unmigrated database) never
 *   touches the cache: it reads exactly as it did before this file existed.
 *
 * THE ONE CASE THE COUNTER CANNOT SEE, AND ITS BOUND
 *   A database restored from a backup can count up to an old number again with different rows
 *   behind it. MAX_AGE_MS bounds that to one minute — the same minute the screens' own full-read
 *   clock already allows.
 *
 * WHAT IS CACHED: ROWS, NEVER A SHAPED ANSWER
 *   The menu's shaping reads the clock (a dated closure expires on read), so it runs on every
 *   request over the cached rows. Callers get a copy, so nothing they do can change the next
 *   caller's rows. A failed read is never kept.
 *
 * Pure (no database import), so the rules above are tested directly.
 */

export const MAX_AGE_MS = 60_000;

interface Entry {
  version: string;
  at: number;
  value: Promise<unknown>;
}

const entries = new Map<string, Entry>();

/**
 * `load()` once per (key, version) per instance; `keep` decides whether an answer may be kept
 * (an answer carrying a database error may not).
 */
export function catalogRead<T>(
  key: string,
  version: string | null,
  load: () => Promise<T>,
  keep: (value: T) => boolean = () => true,
  now: number = Date.now()
): Promise<T> {
  if (version === null) return load();
  const hit = entries.get(key);
  if (hit && hit.version === version && now - hit.at < MAX_AGE_MS) {
    return (hit.value as Promise<T>).then((v) => structuredClone(v));
  }
  const value = load();
  const entry: Entry = { version, at: now, value };
  entries.set(key, entry);
  const forget = () => {
    if (entries.get(key) === entry) entries.delete(key);
  };
  value.then((v) => (keep(v) ? undefined : forget()), forget);
  return value.then((v) => structuredClone(v));
}

/** Tests only: start from an empty cache. */
export function clearCatalogCache(): void {
  entries.clear();
}
