# 04 — Architecture and Design

---

## 1. Canonical patterns: one blessed idiom per concern

For every cross-cutting concern there is **exactly one** approved way to do it, recorded in
[registers/CANONICAL_PATTERNS.md](./registers/CANONICAL_PATTERNS.md) with a working reference
file.

Inventing a second way is a defect, not a preference. Two ways means:

- a bug fixed in one and shipped in the other;
- a reviewer who cannot tell which is intended;
- a newcomer who copies whichever they found first — a coin flip;
- and every future change costing double.

Each row is `ID | Concern | The blessed pattern | Reference file`. Read the reference and mirror
it. If a concern has no row yet, **bless one first**, then follow it.

Concerns that reliably need a row: identity resolution and its "still loading" tri-state ·
guarding derived values until authentication has hydrated · async loader termination · the
single data-access client · error classification · permission-denied UX · how sub-pages mount ·
clearance under fixed chrome via a named constant · safe writes against unique constraints ·
multi-write flows as one transaction · customer-facing failure text · calling an external model
provider · animation configuration · date entry vs display vs storage · focus management ·
overflowing tab rows · bulk selection and its write shape.

---

## 2. Where logic belongs

| Placement | Use for | Do not use for |
|---|---|---|
| **Database constraint** | Invariants that must hold no matter what wrote the row | Anything needing a user-facing message |
| **Database function** | Multi-table transactions; logic several services share | Anything you want to unit test easily |
| **Server endpoint** | Authorisation; anything touching a secret; anything a client must not be able to skip | Presentation |
| **Shared library** | Pure business rules — pricing, validity, formatting | I/O |
| **Component** | Presentation and local interaction | Business rules |

**The test:** *if a malicious client called the API directly, would this rule still hold?*
If the rule matters and the answer is no, it is in the wrong place.

Corollary that catches most permission bugs: **hiding a button is not access control.** The
route and the API path must deny too.

---

## 3. Multi-tenancy

If more than one customer's data lives in one database, this section is the highest-stakes part
of the architecture.

1. **Every tenant-scoped table carries `tenant_id`, from the migration that creates it.** Added
   later, it is already missing from the joins, indexes and caches built in between.
2. **Enforce isolation at the database**, with row-level security, not only in query code.
   Application-level scoping fails open: forget one `where` clause and you have a cross-tenant
   leak with no error.
3. **Separate policies per operation.** A single all-operations policy makes it impossible to
   grant read without also granting write — which is the split you actually wanted.
4. **Elevated credentials belong only on the server**, and every query made with them scopes by
   tenant explicitly. A service key bypasses row-level security entirely; that is its purpose
   and its danger.
5. **Test isolation as a first-class case.** Two tenants, one asks for the other's record,
   assert the denial. It should be one of the first tests in the project.

---

## 4. Writes that survive reality

Users double-tap. Networks retry. Webhooks deliver twice. To your API these are the *same
event*, and only the database can reliably tell them apart.

- Name every business uniqueness rule as a **constraint**, then design each write against it —
  an upsert, or an explicit conflict clause.
- Non-idempotent operations take a **client-supplied retry key**, so a repeated request is
  recognised as the same intent rather than a second one.
- **Multi-step writes go through one transaction.** A cascade that can half-apply eventually
  will, at the worst possible moment, and the partial state is usually invisible until someone
  reconciles by hand.
- **A raw constraint error must never reach a user.** Catch it, classify it (see
  [06](./06-ERROR-HANDLING.md)), and say something a human can act on.

---

## 5. Interface design

### Fewest actions wins
When several designs work, choose the one with fewest taps. The most common case should need
**zero** actions — the right default is already selected.

### Substitute before you add
| Instead of | Use |
|---|---|
| N buttons per row | a swipe/context action + a smart default |
| dropdown + "add new" dialog | a type-to-create combobox |
| a separate edit screen | inline edit |
| a confirmation dialog | immediate action + undo *(destructive excepted)* |
| a long form | smart defaults + progressive disclosure |

### Emphasis is a claim
A filled or coloured control **claims a meaning** — primary, selected, active, current state,
success, warning, destructive. Peer actions share one treatment and **at most one is primary**.

Two filled peers tell the user both already happened. Availability is not importance: emphasis
is earned by consequence, not by being tappable. Styling changes when the **state** changes,
never because an action exists. A treatment that names no meaning is decoration — use neutral.

### Destructive actions are isolated
A delete control is never adjacent to the primary action. Opposite side of the row, or rendered
as an outline or icon. Primary actions group together; destructive ones stand apart.

### Configuration is not a peer of daily work
A settings screen does not earn a slot beside the lists a user touches every day. Before adding
an item to any navigation row, ask what **kind** it is and how often it is opened. If the answer
differs from its neighbours, it is not their sibling.

### Dialogs never eat work
A backdrop tap does not dismiss an input dialog. Typed data survives until the user
intentionally closes. Closing with unsaved changes asks first. One stray tap should never cost
a user five minutes of typing.

### A wide table is the user's to arrange
Past **three** columns a table stops fitting and starts scrolling sideways, so most of it is off
screen at any moment. Which columns matter is a property of the **task**, not of the table:
chasing renewals wants the dates, checking setup wants the flags. A fixed layout cannot guess,
so it guesses wrong for everyone — and the columns someone actually needs become the ones they
scroll to every single time.

So: more than three columns means the user picks which columns show and in what order, and
**the choice persists** — the entire point of hiding a column is not wanting to see it again.
A column the table is unreadable without is marked `required`: reorderable, never hideable.
Reset is always reachable, or someone who hides the wrong column has no way back.

Reorder with buttons, not drag-only. Dragging needs pointer heuristics, an autoscroll for a
list taller than its popup, and a keyboard alternative anyway to be operable at all — more code,
more failure modes, and worse for the people most likely to need the feature.

This needs a gate rather than good intentions because the table is *fine* on the day it is
written, with four columns of seed data. It degrades one column at a time, and no single change
is ever the one that broke it. CP-21 · `scripts/audits/check-column-control.mjs` catches literal
`<th>` tables; a table built by mapping a column definition is a **review** item, and the code
review checklist carries it.

---

## 6. Architecture decision records

Any decision that is expensive to reverse gets a short record in `docs/decisions/`:
context · options considered · decision · consequences.

Template: [templates/docs/ADR.md](../templates/docs/ADR.md).

The value is almost entirely in the **rejected options**. Six months later someone proposes one
of them again, and the reason it lost is the most useful sentence in the file.
