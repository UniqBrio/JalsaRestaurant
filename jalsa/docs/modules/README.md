# Module documents

One document per module, written in the same change that builds it.

| Module | Document | What it is |
|---|---|---|
| Guest surface | `guest.md` | screens 1–13 — scan, order, progress, closure |
| Staff surface | `staff.md` | screens 14–21 — the floor, rounds, requests |
| Owner console | `owner.md` | screens 23–29, 33 — live orders, payments, menu, people, audit |
| Data layer | `data.md` | the bill/table model, the permission matrix, the number series |
| Printing | `printing.md` | **written** — the job contract, routing, retry/reprint/redirect, the bridge as built, and the customer setup (pairing, discovery, mapping, installer) |

**None of the four above exist yet** (`printing.md` does). They are named here rather than left to be discovered missing:
the first change that touches a module writes its document in the same commit, which is the rule
that stops documentation becoming a separate project nobody schedules.

Until then the durable reasoning lives in three places, all of which are current:
`../registers/CANONICAL_PATTERNS.md`, `../registers/RBAC_MATRIX.md`, and the header comment on
every file in `src/lib/` — which is where the "why" for this codebase was actually written.
