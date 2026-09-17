# 28 — Supabase Large-Data Safety

> **The rule in one line:** no Supabase read or write workflow may assume that one API request
> can safely handle an unbounded number of rows.
>
> **Applies to:** every application on the Supabase stack · every table · every view · every
> set-returning RPC · every feature that reads through any of them. It applies automatically:
> gate step **G14** classifies every read, and unsafe ones are hard findings that no baseline
> absorbs. Nobody has to remember this standard; the gate remembers it.
>
> **Baseline:** the engineering standard *"The Supabase 1,000-Row Limit"*, validated on a real
> incident and restated in the request that produced this document. Every rule it names is
> preserved below; none is weakened. Canonical pattern **CP-34**; the helper is
> `starter/src/lib/supabase-safety.ts`; the audit is `scripts/audits/check-supabase-reads.mjs`.

---

## 1. Why — the fact everything rests on

PostgREST answers an unbounded read with **HTTP 200 and the first `max-rows` rows**. The default
is 1,000. It is **project-wide**: one setting, every table, every view, every RPC that returns a
set. There is no error. There is no flag the client code looks at. The response is a
complete-looking array that is not complete.

## 2. Why that is dangerous

The client receives no signal, so **application logic interprets incomplete data as complete.**
A count computed from the rows is short. A total is short. A "who has not attended" list is the
complement of a truncated set, so it names people who did attend. A dashboard tile reads a
number that is wrong by exactly the amount the table has grown past the cap. And the code that
does this **passed every test it was ever given**, because no fixture had a thousand rows — it
breaks on the day the table does, with no deploy to correlate against.

## 3. The approved solution — three shapes, in order of preference

**A. Aggregate in the database.** When the UI needs a count, total, percentage, status, summary,
dashboard metric, grouped result, or an existence/state answer: ask the database for the answer.
Never download the rows an answer is made of. `{ count: 'exact', head: true }`, a `count(*)`
view, an aggregating RPC.

**B. Bound the read.** For a user-facing list: an explicit page size **below the cap**, a
**deterministic `ORDER BY`**, a Load-more / pagination control, and one extra row fetched to
learn `hasMore` without a count query. `readBounded()`.

**C. Keyset-page to completion.** When the complete dataset is genuinely required — an export,
a reconciliation, a batch: a **unique indexed key**, ascending, a **fresh query per page**
(`.order(key).gt(key, lastKey).limit(n)`), an explicit page size, and **termination ONLY on an
empty page**. Throw on the first error. **Never return a partial dataset.** `pageAllByKey()`.

### Why "stop on empty", never "stop on short"

A page shorter than the page size looks like the last page. It is also exactly what a capped
response looks like when the page size is above the cap — and exactly what a test project with
a deliberately low cap produces. A helper that stops on a short page **reproduces the truncation
bug inside the helper written to fix it.** Stopping only on an empty page costs one extra request
per traversal and cannot be fooled by any cap. This is the rule the unit spec pins hardest.

## 4. The prohibited solution

**Do not raise `max-rows`.** It moves the cliff; it does not remove it, and it does so for every
table at once. The audit reports a raised cap as a hard finding wherever it is typed.

## 5. Prohibited patterns — all hard findings in G14

- an unbounded `.from(...).select(...)` where the result can grow
- an unbounded `.rpc(...)` returning a set — **there is no RPC exemption**
- offset pagination (`.range`/`.offset` in a loop) for full-dataset traversal
- termination on a short page (`.length < pageSize`)
- an estimated or planned count used to decide completeness
- `Content-Range: */*` read as evidence of truncation (it is not one; it is the default)
- an N+1 replacement — one filtered read per row — for a large read
- fetching rows when only an aggregate is required
- returning partial data after a fetch error
- **interpreting missing returned rows as proof that business data does not exist**

## 6. A filter is not a bound

`academy_id = X` is bounded only if the business guarantees one academy can never exceed the cap.
If one academy can have 1,500 members, it is unbounded. The audit therefore treats a filter as a
bound **only** with an explicit, authorised annotation on the line above the read:

```ts
// SUPABASE-BOUND: one venue has at most 40 tables (physical constraint) | max 40 rows | A. Owner 2026-09-14
const tables = supabase.from('tables').select('*').eq('venue_id', v);
```

Constraint, maximum, authority, date. Below the warn threshold → `SAFE-BY-FILTER`. At or above
the threshold (default **70 %** of the cap, `warnAt` in `.supabase-safety.json`) → `BREAKS SOON`,
an early warning that is recorded and ratcheted, not proof of failure. At or above the cap →
`BROKEN NOW`, hard. That annotation is the **exception record** §10 asks for: it lives beside
the read, it names who accepted it, and the gate reads it.

## 7. The data-layer boundary

Supabase access belongs in the application's data layer. `.from(` and `.rpc(` anywhere else are
rejected twice: by ESLint at edit time (`starter/eslint.config.js`, `no-restricted-syntax`) and
by G14 at gate time. The layer is **configurable** — `dataLayer` in `.supabase-safety.json`, and
`DATA_LAYER` in the ESLint config — because the framework does not assume a directory name.
The starter's default is `src/lib/data/**`, `api/**`, `supabase/functions/**`.

## 8. The truncation guard

`assertNotCapped(rows, { cap, bounded })` throws `TruncationRisk` when a response **reaches the
configured maximum on a read that did not bound itself below it**. It does not flag every
`Content-Range` ending in `/*`; it flags the meaningful case. A bounded read that reaches the
cap rather than its own limit is still flagged — that means the bound was not below the cap.

## 9. UI trust — four states that are not interchangeable

`LoadState<Row>` is `loading · present · empty · failed · incomplete`. A fetch failure or a
capped read must **never** render as "No records", "Not uploaded", "Nobody attended", "Nothing
exists". `empty` means *the read succeeded and there is nothing*. The reference list screen
renders a `list-failed` state with a retry; before this standard it rendered "No items yet — Add
the first item" after a failed load, which is the defect class, in the framework's own example.

## 10. Low-cap testing

The test project sets `PUBLIC_SUPABASE_MAX_ROWS=50` (`starter/.env.test`), read through
`publicConfig.supabaseMaxRows`. Every helper and the audit take the cap from there, so a read
that is safe only because the table is small today is exposed by a fixture of fifty-one rows.
**Critical:** because the helper stops only on an empty page, lowering the cap cannot make it
truncate — the unit spec runs a page size *above* the cap and still reads to completion.

## 11. Where it sits in the SDLC

| Stage | What happens |
|---|---|
| DESIGN (A3.3b) | Every list, count and export names its **data volume and growth**: what is the maximum rows this read can see, and which shape (A/B/C) follows from that. |
| IMPLEMENT (A5) | Reads use a sanctioned shape, inside the data layer; a filter-bound read carries its annotation. |
| VERIFY (test-gate) | `npm run audit:supabase`; the unit spec at the low cap; a fixture larger than the cap for any new list or export. |
| GATE | **G14** — unsafe reads are hard findings, never baselined. `npm run audit:all` (CI) and `npm run gate`. |
| RECORD | An accepted exception is the `SUPABASE-BOUND` annotation — constraint, maximum, authority, date — beside the read, and a `BREAKS SOON` acceptance is a knowing `--write-baseline`. |

## 12. What the audit reports, per read

file · line · table/RPC · filter · maximum possible rows · query shape · pagination strategy ·
aggregation · risk (`BROKEN NOW · BREAKS SOON · SAFE-BY-FILTER · SAFE · UNKNOWN`) · remedy.
`UNKNOWN` on an unbounded read is hard: the tool cannot prove it safe, and the standard says
never assume. Zero reads found is printed, never treated as a clean bill.

**Floor, stated:** the audit is a regex over source, not a type checker. A query assembled across
statements or through an app-written wrapper is invisible to it — name the wrapper in
`keysetHelpers`, or annotate. Write paths are not classified.
