# Implementation Plan — `<feature>`

> The last cheap place to be wrong.

**Approved design:** `<link>` · **Branch:** · **Estimated tasks:**

---

## 1. Summary
What is being built, in three sentences.

## 2. Technical approach
Where each piece of logic lives, and **why there** — see
[docs/04](../../docs/04-ARCHITECTURE-AND-DESIGN.md#2-where-logic-belongs).

## 3. Schema changes
| Migration file | What it does | Reversible? | Rollback |
|---|---|---|---|

**Parity check:** *(result of diffing the environments — any unacknowledged difference blocks)*

**Migration ledger audit:** for every table, index, constraint, trigger and function this change
touches, confirm it is defined in a migration file. An object present in a database but in **no**
migration is a blocking finding — backfill an idempotent migration before building on it.

## 4. Constraint-aware write audit
For every table written:

| Table | Unique constraint (from the LIVE schema) | The guard that makes the write idempotent |
|---|---|---|

A double-tap, a retry and a duplicated webhook are the same event to your API. The database is
the only thing that can reliably tell them apart.

## 5. Tasks
### Task 1 — `<name>`
- **Objective:**
- **Files:**
- **Depends on:**
- **Acceptance criteria:** *(specific enough to be checked, not felt)*

## 6. Permissions
The five questions answered, and the matrix row.
Verification: does disabling this gate the **deep route and the API path**, not just the button?

## 7. Root-cause compliance
| Module | Recorded root-cause classes | How this change avoids each |
|---|---|---|

A new feature must never reintroduce a bug class already paid for once.

## 8. Performance
| Operation | Budget | On what device/network | How it is verified |
|---|---|---|---|

The budget is set on the **slowest** device and network you support, not the developer's machine.

## 9. Security and data
What personal data this stores, and **why**. Which policies change. New endpoints are
authenticated by default; any public one carries its justification here.

## 10. Test plan
| Dimension | Cases | Notes |
|---|---|---|
| Functional | | |
| Responsive | | |
| Performance | | |
| Security | | |

Plus: idempotency cases derived from §4 · non-default configuration cases · the undo round-trip ·
geometry cases (automated).

## 11. Rollback
Specific and executable. Name any **irreversible** step — a destructive migration, a sent
message, an external side effect — and treat it as a one-way door.

## 12. Open questions
Anything still unresolved. **An open question at Gate 4 is cheaper than a wrong assumption at
Gate 5.**
