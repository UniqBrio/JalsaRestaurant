# Product Lexicon

> **One approved word per concept.** This is the file the copy freeze rule enforces against —
> without it, "shipped strings are frozen" has nothing to be frozen to.
>
> Append-only. A superseded term is marked, never deleted: old screenshots, old support answers
> and old test expectations still contain it.

---

## Why terminology is the expensive half

Wording can be improved later at moderate cost. **Terminology cannot.** It changes what users
say on support calls, what they search the help centre for, what appears in every screenshot
ever taken, and what every test expectation asserts.

Two words for one concept is a support problem long before it is a style problem: the user says
"charge", the interface says "fee", the help article says "invoice line", and everybody is
slightly wrong.

**A database column name is not a user-facing word.** `acct_status_cd` is a schema decision;
what the user reads is a product decision, and they are allowed to differ.

---

## Approved terms

| Concept | **Approved term** | Not this | Status | Occurrences | Decided |
|---|---|---|---|---|---|
| _e.g. a recurring amount owed_ | _Monthly fee_ | _charge, dues, billing, subscription_ | FROZEN | _47_ | _DD-MMM-YYYY_ |

- **Approved term** — exactly as it appears in the interface, including capitalisation.
- **Not this** — the synonyms that have actually appeared, or that people reach for. This column
  is what makes the row enforceable in review.
- **Status** — `FROZEN` (shipped; never reworded outside a declared copy pass) · `PROVISIONAL`
  (new, not yet shipped) · `SUPERSEDED BY <term>`.
- **Occurrences** — how many shipped strings use it. Evidence the term is real rather than
  aspirational, and a measure of what a change would cost.

---

## Adding a term

1. **Check for an existing term first.** A new synonym for an approved concept is a defect, not
   a preference. This check is the entire point of the register.
2. Add the row with `PROVISIONAL`, and record the decision — *why* this word and not the
   obvious alternative.
3. It becomes `FROZEN` when it ships.

## Changing a term

Only in a declared copy-migration pass, with approval, **before** any code changes.

The old row is marked `SUPERSEDED BY <term>` and stays. Then: update every shipped string, and
**update every test expectation and text selector that quotes it** — a green suite after a copy
migration usually means the suite is asserting the old words.

## Candidates

Off-voice or inconsistent copy noticed during unrelated work goes here — **logged, never fixed
in that change.** This list is what makes the freeze rule tolerable: you have somewhere to put
the observation instead of acting on it.

| Term seen | Where | Suggested | Noticed |
|---|---|---|---|
