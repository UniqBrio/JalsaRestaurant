# Technical Debt

> Debt nobody wrote down is not debt. It is a surprise with a delay fuse.
>
> Writing it down also makes the cost **arguable**, which is the only way it ever gets
> prioritised over the next feature.

| ID | What | Why accepted | What it costs | Paid down when | Added |
|---|---|---|---|---|---|
| _TD-001_ | | | _the ongoing cost: slower changes, a recurring bug class, a class of test that cannot be written_ | _the condition that makes it worth paying_ | |

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
