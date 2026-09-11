# Code Review Checklist

> **Read the files, not just the diff.** A diff shows what changed; only the file shows whether
> it is now correct. Most review misses are things the diff could not display.

---

## Tables and lists
- [ ] **A table with more than three columns offers a column control** (choose · reorder · reset,
      remembered per browser) — CP-21. The automated gate sees only literal `<th>` tables, so a
      table built by mapping over a column definition is **this checklist's job, not the gate's**.
      A column the table is unreadable without is marked `required`: reorderable, never hideable.

## Before reading the code
- [ ] Do I know what this is supposed to do? If not, ask before reviewing.
- [ ] **Re-check the previous round's findings.** A finding that recurs after being marked
      resolved is worth escalating, not repeating.

## Correctness
- [ ] Does it do what the request asked — and **only** that?
- [ ] Every changed line traces to the request.
- [ ] Edge cases: empty, one, many, very many · first and last · concurrent · offline · retried.
- [ ] Time zones and day boundaries, wherever a date is involved.
- [ ] Are the error paths **handled**, or just caught and dropped?

## The things a diff hides
- [ ] **Every other call site.** If this touched a shared write path, does every *other* writer
      of that table carry the same guard? A fix at one site while its twin ships is not a fix.
- [ ] Does a renamed or moved symbol have **dynamic** references a static search missed —
      string-keyed lookups, file-based routing, configuration naming a class?
- [ ] Does the removed code have callers elsewhere?

## Failure modes
- [ ] Does any `catch`, default value or skipped branch **hide** a failure? Could a user mistake
      its output for real data?
- [ ] Is a raw machine error reachable by a user?
- [ ] Does a save report success without asserting the write?

## Security
- [ ] Authenticated by default; any public endpoint has a written justification.
- [ ] Authorisation at the **route and API**, not only in the UI.
- [ ] Tenant scoping on every query.
- [ ] Input validated at the boundary; output escaped by context.
- [ ] No secret in client code, a log, or the repo.

## Appearance
- [ ] No colour literals.
- [ ] Both themes considered — and, for a UI change, actually rendered.
- [ ] Contrast: is any new text guaranteed readable on **every** surface it can appear on?
- [ ] Emphasis names a meaning; at most one primary among peers.
- [ ] Status is never colour alone.

## Tests
- [ ] Do the tests assert the **requirement**, or just restate the implementation?
- [ ] Is there **fail-first evidence** for each new behaviour test?
- [ ] Do they assert the data, or the toast?
- [ ] Geometry cases automated, not left manual.
- [ ] Would these tests survive a refactor? A test pinned to the failing line dies at the next
      one and takes its protection with it.

## Documentation
- [ ] Module document updated in this change.
- [ ] Comments explain **why**, not what.
- [ ] Any new rule names where it is enforced — or says it is not.

## Verdict
`APPROVE` · `REQUEST CHANGES` (list them) · `BLOCKED` (a safety rule is violated).

Be specific. "This looks wrong" costs the author an hour of guessing.
