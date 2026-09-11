# Track D — Refactor

> Same behaviour, better structure. **No functional change may be smuggled in.**

**SCOPE:** `<what is being restructured, and why now>`

---

## D0 — Scope approval → GATE

Refactors expand. State the boundary up front and get it approved:
what moves, what does not, and what "done" looks like.

→ **GATE — confirm mode: the requester approves the scope. Auto mode:** log the scope
statement and proceed; growing the scope mid-run is a hard stop in any mode.

---

## D1 — Characterization first

> **"Tests green before and after" is evidence only where tests actually cover the code being
> moved.** Refactoring uncovered code with a green suite proves the suite did not look.

Before touching a module, state **how many specs reference it**. If the answer is zero, the
first commit of the refactor **adds characterization tests that pin current behaviour** —
including the behaviour you believe is wrong.

Those tests are written against the OLD code and must pass unchanged against the new. That is
the entire safety property of a refactor; without it you are rewriting, not refactoring.

---

## D2 — Blast radius

Every importer of every symbol you move. Every dynamic reference a static search misses —
string-keyed lookups, file-based routing, reflection, configuration referring to a class name.
These are exactly what a rename breaks silently.

---

## D3 — Refactor in small steps

- One behaviour-preserving transformation per commit, each with the suite green.
- Follow the canonical pattern for anything you touch. A refactor that introduces a *second*
  way of doing something has made the codebase worse while looking tidier.
- No opportunistic feature work, no "while I'm here" fixes. If you find a bug, note it and
  raise it as Track C.

---

## D4 — Test-case lifecycle: UPDATE, not ADD

A behaviour-preserving change moves selectors and entry points, so existing cases are **edited
in place** with a refreshed date.

Needing to *add* cases usually means behaviour changed — in which case it is not a refactor and
belongs in Track B or C. Notice that signal rather than routing around it.

---

## D5 — Delete what you finished with

A refactor deletes the superseded module, the one-off migration script, the now-unimported
helper. Otherwise the codebase grows a second copy of everything and the next reader cannot
tell which one is live.

Run the dead-weight audit if present: `npm run audit:deadweight` in the framework repo, or
`node <framework>/scripts/audits/check-dead-weight.mjs` from an app (a workspace app has no
`scripts/` of its own).
**Unreferenced is not the same as unused** — some scripts are run by hand and appear in no
file. Treat the output as a review candidate list, never a delete list, and record a reason
for each entry you keep.

---

## D6 — Close out

Diff review: every changed line is a structural move, and you can say which one. Then the
close-out checklist and the test gate — with the **full** suite, not a scoped selection: a
refactor's whole risk is in the places you did not think you had touched.
