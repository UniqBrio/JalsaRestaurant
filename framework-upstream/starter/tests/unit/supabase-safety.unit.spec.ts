/**
 * supabase-safety unit spec — CP-34's contract, executed against fakes.
 *
 * WHAT IS WORTH PINNING
 *   Every line of the helper's contract is a way the RosiFit-class bug comes back: a helper that
 *   stops on a short page, returns what it had when an error hits, or trusts a count. Each of
 *   those is a case here, run at a LOW CAP - the test project's `PUBLIC_SUPABASE_MAX_ROWS=50` -
 *   because a cap of 1,000 hides every one of them behind a fixture nobody makes that big.
 *
 * FAIL-FIRST EVIDENCE: see TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import {
  assertNotCapped, loadStateOf, pageAllByKey, readBounded, PageReadFailed, TruncationRisk,
} from '../../src/lib/supabase-safety';

/** The low cap the test project configures. Read here so the spec and .env.test cannot drift. */
const CAP = Number(process.env.PUBLIC_SUPABASE_MAX_ROWS ?? 50);

type Row = { id: number; name: string };
const table = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `r${i + 1}` }));

/** A fake PostgREST that applies the CAP exactly the way the real one does: silently, HTTP 200. */
function fakeSource(rows: Row[], opts: { cap?: number; failAtPage?: number; ignoreLimit?: boolean } = {}) {
  const cap = opts.cap ?? CAP;
  const calls: Array<{ after: number | null; limit: number }> = [];
  const fetchPage = async (after: number | null, limit: number) => {
    const page = calls.length;
    calls.push({ after, limit });
    if (opts.failAtPage === page) return { data: null, error: { message: 'connection reset' } };
    let slice = rows.filter((r) => after === null || r.id > after);
    if (!opts.ignoreLimit) slice = slice.slice(0, limit);
    slice = slice.slice(0, cap);                               // the cap, as PostgREST applies it
    return { data: slice, error: null };
  };
  return { fetchPage, calls };
}

test('CAP is genuinely low in this project - the cases below would be vacuous otherwise', () => {
  // PRESENT, not merely defaulted: the first version of this spec fell back to 50 when the
  // variable was absent, and .env.test turned out to be gitignored - so a fresh clone would have
  // run the helper at 50 here while the application ran at 1,000, and nothing would have said so.
  expect(process.env.PUBLIC_SUPABASE_MAX_ROWS, 'PUBLIC_SUPABASE_MAX_ROWS must be set by starter/.env.test').toBeDefined();
  expect(CAP).toBeLessThanOrEqual(50);
});

/* ----------------------------------------------------------------- pageAllByKey */

test('keyset pagination reads a dataset LARGER than the cap to completion', async () => {
  const src = fakeSource(table(CAP * 3 + 7));
  const all = await pageAllByKey<Row, number>({ pageSize: 20, fetchPage: src.fetchPage, keyOf: (r) => r.id });
  expect(all.length).toBe(CAP * 3 + 7);
  expect(all[all.length - 1]?.id).toBe(CAP * 3 + 7);
});

test('every page is a FRESH query with the cursor at the last key, ascending', async () => {
  const src = fakeSource(table(45));
  await pageAllByKey<Row, number>({ pageSize: 20, fetchPage: src.fetchPage, keyOf: (r) => r.id });
  expect(src.calls.map((c) => c.after)).toEqual([null, 20, 40, 45]);
  expect(src.calls.every((c) => c.limit === 20)).toBe(true);
});

test('TERMINATES ONLY ON AN EMPTY PAGE - a short page is not the end', async () => {
  // 45 rows, page size 20: pages of 20, 20, 5, then EMPTY. Four calls, not three.
  const src = fakeSource(table(45));
  const all = await pageAllByKey<Row, number>({ pageSize: 20, fetchPage: src.fetchPage, keyOf: (r) => r.id });
  expect(all.length).toBe(45);
  expect(src.calls.length).toBe(4);
  expect((await src.fetchPage(45, 20)).data).toEqual([]);   // the fourth page really is empty
});

test('a page size ABOVE the cap still reads to completion - stop-on-short would have truncated here', async () => {
  // pageSize 200 > cap 50: every page comes back short (50 rows). A helper that stopped on a
  // short page would return 50 rows and call it complete. This one keeps going until empty.
  const src = fakeSource(table(CAP * 2 + 3));
  const all = await pageAllByKey<Row, number>({ pageSize: 200, fetchPage: src.fetchPage, keyOf: (r) => r.id });
  expect(all.length).toBe(CAP * 2 + 3);
});

test('an error on any page THROWS and nothing collected so far is returned', async () => {
  const src = fakeSource(table(45), { failAtPage: 1 });
  let caught: unknown;
  try { await pageAllByKey<Row, number>({ pageSize: 20, fetchPage: src.fetchPage, keyOf: (r) => r.id }); }
  catch (e) { caught = e; }
  expect(caught).toBeInstanceOf(PageReadFailed);
  expect((caught as PageReadFailed).pageIndex).toBe(1);
  expect((caught as PageReadFailed).rowsSoFar).toBe(20);   // known, reported, NOT returned
});

test('a page larger than asked is a broken query, not a bonus', async () => {
  const src = fakeSource(table(45), { ignoreLimit: true, cap: 1000 });
  await expect(pageAllByKey<Row, number>({ pageSize: 20, fetchPage: src.fetchPage, keyOf: (r) => r.id }))
    .rejects.toThrow(/not applying its limit/);
});

test('a cursor that does not advance throws instead of looping forever', async () => {
  // A key that is not unique: every row has id 7, so `.gt(id, 7)` would return nothing in a real
  // database - but a broken fetchPage that ignores the cursor returns the same page forever.
  const rows: Row[] = [{ id: 7, name: 'a' }, { id: 7, name: 'b' }];
  const fetchPage = async () => ({ data: rows, error: null });
  await expect(pageAllByKey<Row, number>({ pageSize: 2, fetchPage, keyOf: (r) => r.id }))
    .rejects.toThrow(/did not advance/);
});

test('composite keys work through keyOf + sameKey', async () => {
  type R2 = { day: string; seq: number };
  const rows: R2[] = [{ day: 'a', seq: 1 }, { day: 'a', seq: 2 }, { day: 'b', seq: 1 }];
  const fetchPage = async (after: [string, number] | null, limit: number) => {
    const rest = rows.filter((r) => after === null || r.day > after[0] || (r.day === after[0] && r.seq > after[1]));
    return { data: rest.slice(0, limit), error: null };
  };
  const all = await pageAllByKey<R2, [string, number]>({
    pageSize: 2, fetchPage, keyOf: (r) => [r.day, r.seq], sameKey: (a, b) => a[0] === b[0] && a[1] === b[1],
  });
  expect(all).toEqual(rows);
});

/* ----------------------------------------------------------------- readBounded */

test('a bounded list read fetches one extra row to learn hasMore, and never returns it', async () => {
  const src = fakeSource(table(30));
  const page = await readBounded<Row>({ pageSize: 10, cap: CAP, fetch: (limit) => src.fetchPage(null, limit) });
  expect(src.calls[0]?.limit).toBe(11);
  expect(page.rows.length).toBe(10);
  expect(page.hasMore).toBe(true);
  const last = await readBounded<Row>({ pageSize: 10, cap: CAP, fetch: (limit) => src.fetchPage(25, limit) });
  expect(last.rows.length).toBe(5);
  expect(last.hasMore).toBe(false);
});

test('a page size at or above the cap is refused - a "bound" the cap reaches first is not a bound', async () => {
  const src = fakeSource(table(10));
  await expect(readBounded<Row>({ pageSize: CAP, cap: CAP, fetch: (limit) => src.fetchPage(null, limit) }))
    .rejects.toThrow(RangeError);
});

/* ----------------------------------------------------------------- the truncation guard */

test('a capped response on an unbounded read THROWS - it cannot silently become a complete dataset', () => {
  expect(() => assertNotCapped(table(CAP), { cap: CAP, what: 'attendance' })).toThrow(TruncationRisk);
  expect(() => assertNotCapped(table(CAP - 1), { cap: CAP })).not.toThrow();
});

test('a legitimately bounded read reaching ITS OWN limit is fine; one reaching the CAP is not', () => {
  expect(() => assertNotCapped(table(20), { cap: CAP, bounded: 20 })).not.toThrow();
  // The caller said "bounded", but the bound was not below the cap - that is the misconfiguration.
  expect(() => assertNotCapped(table(CAP), { cap: CAP, bounded: CAP })).toThrow(TruncationRisk);
});

test('an estimated count cannot establish completeness - the guard reads the rows, not a header', () => {
  // A response claiming count: 1500 with 50 rows is still a capped response. There is no
  // parameter for "but the count says", on purpose.
  const rows = table(CAP);
  expect(() => assertNotCapped(rows, { cap: CAP })).toThrow(/reaches the configured maximum/);
});

/* ----------------------------------------------------------------- UI trust */

test('LOAD FAILED is not EMPTY - a fetch error never becomes a business statement', () => {
  const failed = loadStateOf<Row>({ error: new Error('boom') });
  expect(failed.kind).toBe('failed');
  const empty = loadStateOf<Row>({ rows: [] });
  expect(empty.kind).toBe('empty');
  const present = loadStateOf<Row>({ rows: table(3), hasMore: false });
  expect(present.kind).toBe('present');
});

test('a capped read is INCOMPLETE, not present and not empty', () => {
  const s = loadStateOf<Row>({ rows: table(CAP) }, { cap: CAP });
  expect(s.kind).toBe('incomplete');
  if (s.kind === 'incomplete') expect(s.received).toBe(CAP);
});
