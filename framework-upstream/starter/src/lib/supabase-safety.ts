/**
 * supabase-safety - the three sanctioned shapes for reading from Supabase, and the guard that
 * makes the fourth shape impossible to ship by accident (CP-34, docs/28).
 *
 * THE FACT EVERYTHING HERE RESTS ON
 *   PostgREST answers an unbounded read with HTTP 200 and the FIRST `max-rows` rows - 1,000 by
 *   default, project-wide, every table, every view, every set-returning RPC. No error. No flag on
 *   the response a client would look at. The application receives a complete-looking array that
 *   is not complete, and every piece of logic downstream - a count, a total, a "nobody attended",
 *   a "not uploaded" - is now confidently wrong. Nothing about the code changed; the table grew.
 *
 * THE THREE SHAPES, IN ORDER OF PREFERENCE
 *   1. AGGREGATE IN THE DATABASE. A count, a total, a percentage, a status, a dashboard figure,
 *      an existence check: ask the database for the answer, never for the rows it is made of.
 *      This file has nothing to add for that shape - it is a query, not a helper.
 *   2. BOUND THE READ. A user-facing list asks for one page below the cap, in a deterministic
 *      order, and fetches ONE extra row to learn whether there is more. `readBounded` below.
 *   3. PAGE TO COMPLETION BY KEY. When the whole dataset is genuinely required - an export, a
 *      reconciliation, a batch - walk it by a unique indexed key, one fresh query per page, and
 *      stop ONLY when a page comes back EMPTY. `pageAllByKey` below.
 *
 * WHY "STOP ON EMPTY", NOT "STOP ON SHORT" - the rule that matters most
 *   A page shorter than the page size looks like the last page. It is also exactly what a
 *   capped response looks like when the page size is above the cap, and exactly what a test
 *   environment with a deliberately low cap produces. Stopping on a short page reproduces the
 *   truncation bug INSIDE the pagination helper that was written to fix it. Stopping only on an
 *   empty page costs one extra request per traversal and cannot be fooled by any cap.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   No `@supabase/supabase-js` import. The helpers are typed against the SHAPE of a query - a
 *   thing you can call to get `{ data, error }` - so they compile in this repository, which has
 *   no Supabase client, and in any application, whatever client version it runs. Every rule
 *   above is therefore unit-testable with a fake in this tree, and the fakes are the fail-first
 *   evidence for each one.
 */

/** What one page of a keyset read returns. The PostgREST client resolves to exactly this shape. */
export interface PageResult<Row> {
  readonly data: readonly Row[] | null;
  readonly error: { readonly message: string } | null;
}

/** The configured PostgREST cap. Read from config so a test project can set it deliberately low. */
export const DEFAULT_MAX_ROWS = 1000;

export class TruncationRisk extends Error {
  constructor(message: string, public readonly received: number, public readonly cap: number) {
    super(message);
    this.name = 'TruncationRisk';
  }
}

export class PageReadFailed extends Error {
  constructor(message: string, public readonly pageIndex: number, public readonly rowsSoFar: number) {
    super(message);
    this.name = 'PageReadFailed';
  }
}

/**
 * THE TRUNCATION GUARD. A response that reaches the cap on a read that did not bound itself is
 * not a full result - it is the first `cap` rows of an unknown number. Throw, because the
 * alternative is that a count, a total or an emptiness check is computed from it.
 *
 * `bounded` is the caller saying "I asked for fewer rows than the cap, so reaching my own limit is
 * expected". A bounded read reaching the CAP rather than its own limit is still flagged - that
 * means the bound was not below the cap, which is the misconfiguration this exists to catch.
 */
export function assertNotCapped<Row>(
  rows: readonly Row[],
  opts: { cap?: number; bounded?: number | false; what?: string } = {},
): readonly Row[] {
  const cap = opts.cap ?? DEFAULT_MAX_ROWS;
  const what = opts.what ?? 'read';
  if (opts.bounded && opts.bounded < cap) return rows;   // legitimately bounded below the cap
  if (rows.length >= cap) {
    throw new TruncationRisk(
      `${what}: received ${rows.length} rows, which reaches the configured maximum of ${cap}. `
      + 'This is not a complete result; it is the first page of an unbounded read. '
      + 'Aggregate in the database, bound the list, or page by key (CP-34).',
      rows.length, cap,
    );
  }
  return rows;
}

/**
 * SHAPE 2 - a bounded read for a user-facing list.
 *
 * `fetch(limit)` runs the caller's query with `.order(...)` already applied and `.limit(limit)`
 * set to the value given. It is called with pageSize + 1: the extra row is how `hasMore` is
 * learned without a count query, and it is discarded from the returned page.
 */
export async function readBounded<Row>(opts: {
  pageSize: number;
  cap?: number;
  fetch: (limit: number) => Promise<PageResult<Row>>;
  what?: string;
}): Promise<{ rows: Row[]; hasMore: boolean }> {
  const cap = opts.cap ?? DEFAULT_MAX_ROWS;
  if (!(opts.pageSize > 0) || opts.pageSize + 1 > cap) {
    throw new RangeError(`${opts.what ?? 'readBounded'}: pageSize ${opts.pageSize} must be positive and below the cap of ${cap} (with one row to spare for hasMore)`);
  }
  const { data, error } = await opts.fetch(opts.pageSize + 1);
  if (error) throw new PageReadFailed(`${opts.what ?? 'readBounded'}: ${error.message}`, 0, 0);
  const rows = [...(data ?? [])];
  const hasMore = rows.length > opts.pageSize;
  return { rows: hasMore ? rows.slice(0, opts.pageSize) : rows, hasMore };
}

/**
 * SHAPE 3 - keyset pagination to completion.
 *
 *   fetchPage(afterKey, pageSize)  builds a FRESH query each call:
 *                                  .order(key, { ascending: true }).gt(key, afterKey).limit(pageSize)
 *                                  - afterKey is null for the first page.
 *   keyOf(row)                     the unique, indexed, ascending ordering key - a single column,
 *                                  or a tuple for a composite key (the caller's fetchPage then
 *                                  expresses the tuple comparison; this helper only carries it).
 *
 * The contract, each line of which a unit case asserts:
 *   - one fresh query per page, cursor = key of the last row of the previous page
 *   - terminates ONLY on an empty page - never because a page was short
 *   - throws on the first error; nothing collected so far is returned
 *   - throws if a page is LARGER than asked, because that means the query ignored its limit
 *   - throws if the cursor does not advance, because that is an infinite loop about to happen
 */
export async function pageAllByKey<Row, Key>(opts: {
  pageSize: number;
  fetchPage: (afterKey: Key | null, pageSize: number) => Promise<PageResult<Row>>;
  keyOf: (row: Row) => Key;
  /** Only needed when Key is a tuple/object: says whether the cursor moved. Defaults to `!==`. */
  sameKey?: (a: Key, b: Key) => boolean;
  /** A ceiling on total rows, as a safety net against a broken key - NOT a completeness test. */
  maxTotal?: number;
  what?: string;
}): Promise<Row[]> {
  const what = opts.what ?? 'pageAllByKey';
  if (!(opts.pageSize > 0)) throw new RangeError(`${what}: pageSize must be positive`);
  const same = opts.sameKey ?? ((a: Key, b: Key) => a === b);
  const out: Row[] = [];
  let cursor: Key | null = null;
  for (let page = 0; ; page++) {
    const { data, error } = await opts.fetchPage(cursor, opts.pageSize);
    if (error) throw new PageReadFailed(`${what}: page ${page} failed: ${error.message}`, page, out.length);
    const rows = data ?? [];
    if (rows.length === 0) return out;                       // THE ONLY exit that returns data
    if (rows.length > opts.pageSize) {
      throw new PageReadFailed(`${what}: page ${page} returned ${rows.length} rows for a limit of ${opts.pageSize} - the query is not applying its limit`, page, out.length);
    }
    const last = opts.keyOf(rows[rows.length - 1] as Row);
    if (cursor !== null && same(cursor, last)) {
      throw new PageReadFailed(`${what}: page ${page} did not advance the cursor - the key is not unique or not ordered`, page, out.length);
    }
    out.push(...rows);
    if (opts.maxTotal !== undefined && out.length > opts.maxTotal) {
      throw new PageReadFailed(`${what}: exceeded maxTotal ${opts.maxTotal} - the key is not advancing the way it should`, page, out.length);
    }
    cursor = last;
    // A short page is NOT a stop condition. See the header. The next call returns empty, and
    // that is the signal.
  }
}

/* ------------------------------------------------------------------------------------------
 * UI TRUST. The four states a data-backed surface can be in, and they are not interchangeable.
 *
 * A screen that shows "No records" after a fetch failed has told the user something about
 * their business that the system does not know. "Nobody attended" and "the attendance read
 * failed" must not share a pixel. The state is a discriminated union so that a component cannot
 * reach `rows` without first saying which case it is handling.
 * ---------------------------------------------------------------------------------------- */
export type LoadState<Row> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'present'; readonly rows: readonly Row[]; readonly hasMore: boolean }
  | { readonly kind: 'empty' }                       // the read SUCCEEDED and there is nothing
  | { readonly kind: 'failed'; readonly message: string }   // the read did not succeed
  | { readonly kind: 'incomplete'; readonly message: string; readonly received: number }; // capped

/** Turn a settled read into a LoadState - the one place the four are told apart. */
export function loadStateOf<Row>(
  result: { rows?: readonly Row[]; hasMore?: boolean; error?: unknown },
  opts: { cap?: number; bounded?: number | false; failureMessage?: string } = {},
): LoadState<Row> {
  if (result.error !== undefined && result.error !== null) {
    return { kind: 'failed', message: opts.failureMessage ?? 'Could not load this. Please try again.' };
  }
  const rows = result.rows ?? [];
  try {
    // Spread only what was given: under exactOptionalPropertyTypes an explicit `undefined` is
    // not the same as an absent key, and the guard's own defaults must be the ones that apply.
    assertNotCapped(rows, {
      ...(opts.cap !== undefined ? { cap: opts.cap } : {}),
      ...(opts.bounded !== undefined ? { bounded: opts.bounded } : {}),
    });
  } catch (e) {
    if (e instanceof TruncationRisk) {
      return { kind: 'incomplete', message: 'Only part of this could be loaded.', received: e.received };
    }
    throw e;
  }
  return rows.length === 0 ? { kind: 'empty' } : { kind: 'present', rows, hasMore: result.hasMore ?? false };
}
