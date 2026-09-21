# Promotion Candidates

> The parking lot between "an app learned something" and "the framework changed".
>
> **Nothing is promoted on first sighting (n=1).** Promoting the first time you see something is
> how a framework becomes a museum of one app's accidents. A candidate parks here; on the
> **second sighting from a different app**, it is promoted through `/framework-update`.
>
> Append-only, newest first. A rejected candidate stays, with its reason — the reason it lost is
> the most valuable line when someone proposes it again.

---

## How an entry gets here

Via [workflows/promote.md](../../workflows/promote.md), after passing the first two filters:

1. **Path test** — the lesson touches framework-origin behaviour, not only app feature code.
2. **Domain-word test** — the rule can be stated **without naming any business concept**.
   (Checked against the source app's `PRODUCT_LEXICON.md`: if a lexicon word appears in the
   rule, it is app-specific by definition.)

The third filter is this register itself: the sighting count.

## Statuses

`PARKED (n=1)` → `PROMOTED → <RC/rule id>` or `REJECTED — <reason>`

---

## Candidates

| ID | Candidate rule (domain-free wording) | Source app · date | Sightings | Status |
|---|---|---|---|---|
| CAND-003 | "Test files are append-only — except where a module's contract changes, in which case the superseded assertions may be rewritten in place with a dated supersession note recording what they previously asserted. The exception covers spec files only; registers stay append-only without exception." | jalsa · 19-Sep-2026 | n=1 | **PARKED (n=1)** |
| CAND-001 | "A table with more than three columns must let the user choose which columns show and in what order, and must remember the choice. A column the table is unreadable without is reorderable but never hideable." | academies-dashboard · 30-Aug-2026 | n=1 | **PROMOTED → CP-21, v1.3.0** — *owner override of the n=2 rule, recorded deliberately (see note below)* |
| CAND-000 | *(example)* "A list that can be reordered must persist the order through the same code path that displays it — two paths drift." | — | — | *(template row — replace on first real entry)* |

### Note on CAND-003 — why it is parked and not applied to the template

The rule it amends lives in **three** places: `jalsa/CLAUDE.md` (the app's binding rules),
`templates/docs/AGENTS.md` (what every future app is scaffolded with), and — as the summary
phrase *"append-only registers and spec files"* — the safety floor in the framework's own
`CLAUDE.md` and `workflows/framework-update.md`.

Only the first was amended. Changing the template would hand the exception to every application
that has not yet been written, on **one** sighting, which is the precise thing this register
exists to prevent; and the safety-floor line is one `framework-update.md` names as un-weakenable
without a push-back first. So the app took the exception it needed and the framework kept the
unqualified rule.

That leaves a known, deliberate skew: `jalsa/CLAUDE.md` and `templates/docs/AGENTS.md` now state
this rule differently. **That is the parked state, not an oversight.** On a second sighting from
a different app, promotion reconciles all three together — template, safety floor and this row —
in one `/framework-update` run with its own VERSION bump, rather than in an app's feature branch.

**The push-back happened.** `framework-update.md`'s safety floor says of these rules: *"If asked
to weaken one, push back and propose the safe alternative."* The collision was raised at the
Phase 1 gate before any rule was touched, the narrow contract-change exception was the proposed
safe alternative, and the amendment was made only after explicit human approval of that exact
wording. Registers — the other half of that safety-floor line — were not touched at all.

---

### Note on CAND-001 — an override, not a precedent

This register's rule is **n=2 from a different app**. CAND-001 was promoted at **n=1**, by an
explicit owner decision, and this row says so rather than quietly presenting it as normal.

The case for it: the rule states cleanly without any business noun, the pure part of the
implementation (`reconcileOrder`) was already domain-free, and the failure it prevents is one of
gradual decay — a table nobody notices becoming unusable — which is exactly the class a single
sighting is enough to recognise.

The case against, kept because the reason a rule lost is the most valuable line when someone
proposes the next one: **one app's habits are not evidence of generality.** If a second app finds
the three-column threshold wrong, or wants server-persisted preferences, the threshold is
`--threshold` on the audit and the rule text is amendable in place. Do not read this row as
permission to skip the rule of three.
