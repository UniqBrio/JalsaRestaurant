# Technical Debt

> Debt nobody wrote down is not debt. It is a surprise with a delay fuse.
>
> Writing it down also makes the cost **arguable**, which is the only way it ever gets
> prioritised over the next feature.

| ID | What | Why accepted | What it costs | Paid down when | Added |
|---|---|---|---|---|---|
| _TD-001_ | | | _the ongoing cost: slower changes, a recurring bug class, a class of test that cannot be written_ | _the condition that makes it worth paying_ | |
| TD-002 | **The addressability audit reads an opening tag with a `[^>]` scan**, so it stops at the first `>` — including the `>` of an arrow function — and cannot see attributes after one. It also matches a tag written inside a comment. Both produce FALSE POSITIVES: it reports a missing test id that is present. | Fixing it needs a JSX parser, which is a real dependency and a real change to a gate that is otherwise cheap and reliable. The workaround costs nothing: put `data-testid` ahead of any arrow-function prop, and do not write a literal tag in a comment. Every component in `starter/` already follows it. | An author who does not know the convention loses time to a confusing block, and the audit's count of "interactive elements" is slightly wrong in both directions. It never lets a genuinely missing id through, so the floor still holds. | When a JSX parse is needed for another reason too — then it is one dependency serving two gates rather than one. | 10-Sep-2026 |

---

## What counts

- A shortcut taken deliberately, with a known cost.
- A baselined ratchet entry — the accepted violations in `.baselines/` **are** recorded debt.
- A module everyone avoids editing.
- A test class that cannot currently be written, and why.
- A dependency that is unmaintained or pinned to an old version.

## What does not count

A bug. A missing feature. Something you dislike. Debt is a **decision** that traded future cost
for present speed — if there was no decision, it is just a defect, and it belongs in the
root-cause register or the backlog.
