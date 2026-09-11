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

### Navigation is predictable
A user should be able to guess where a thing lives before looking. Screens in one area mount,
navigate back, and carry chrome the way their siblings do; an entry point is named with the
word the user would say (the lexicon), not the word the code uses; and nothing moves between
visits. Every surprising placement is paid for on every visit, forever.

### The three-interaction budget
A key action or key piece of information is reachable within **three interactions** of where
the user starts, wherever practical. This is a *measured* number, not a mood: the design
stage's scenario dry run counts the taps for the most frequent real scenarios. A scenario
over budget is a design finding with exactly two honest resolutions — remove a step (a
confirmation that could be an undo, a screen that could be a contextual dialog, a navigation
hop that could be an action at the point of need), or state in the design why the longer path
is deliberate (a wizard that prevents expensive errors may earn its steps). What is not
allowed is silently shipping the fourth and fifth click because nobody counted.

### Every screen names its primary action
Each screen states, in its design spec, the ONE thing a user most often comes there to do —
and renders it unmistakably (see *Emphasis is a claim*: at most one primary). If no primary
action can be named, that is a finding about the screen, not an exemption: either it is a
read-only surface and says so, or it is two screens wearing one route.

### Substitute before you add
| Instead of | Use |
|---|---|
| N buttons per row | a swipe/context action + a smart default |
| dropdown + "add new" dialog | a type-to-create combobox |
| a separate edit screen | inline edit |
| a separate screen for a quick action | a small contextual dialog at the point of need |
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

### The reversibility decision, made once per action (CP-28)
Every action that changes something answers one question before it is built: **can this be
undone?**

**No** → it confirms **first**, through the shared confirm dialog, and the message names what
will happen in specifics — the record, the count, the scope. "Are you sure?" is not a question
anyone can answer, and a button labelled "OK" tells the user nothing about what they agreed to.

**Yes** → it acts immediately, says what happened, and carries **Undo in the message**. Do not
confirm it. A confirmation on something reversible is not extra safety: it teaches the user
that confirmations are noise to click past, and the one that mattered gets clicked past too.

The undo is a **deferred commit**, not a compensating write. The effect is held for the undo
window and committed when the window closes, so Undo is a local cancel that cannot fail. The
tempting version — write now, write the opposite on Undo — fails in production exactly once and
then tells the user "Undone" about a change that is still there. Where a write genuinely cannot
be deferred, do not offer undo at all: confirm instead, and say why in the module document.

The message says what happened **in specifics**, composed from the real values — "Archived 3
invoices", never "Saved", and never "1 invoices".

### A waiting screen is a designed screen (CP-3)
"Loading…" tells a user the page is not broken and nothing else. Where a whole surface has
nothing to show yet, it says **what is being made for them**, from configurable copy — and past
a threshold it **stops pretending**: it reports that the wait is abnormal and offers a route
onward. A waiting screen is the one surface where the user has nothing else to click, so a dead
end there is an abandoned session. Thresholds are settings, not constants, and a misconfigured
pair is repaired rather than left with the failure state unreachable.

### Money is itemised, never one opaque total (CP-29)
Wherever an amount is payable, its components are separate rows — items, adjustments, tax, then
the payable emphasised — in one order, on every surface showing that money, print included. An
unexplained total is the most disputed element in any interface, and the dispute costs more than
the line items.

Three rules keep the figures trustworthy. **The rows shown add up to the total shown** — round
each row once and sum the rounded rows, because a breakdown off by a paisa reads as an
arithmetic bug, which it is. **Pass-through money is not income** — tax, deposits, tips and
agent collections appear in what the payer owes and stay out of revenue; folding them in
overstates revenue and understates a liability. **An impossible total is reported, not clamped**
— a discount larger than the charge is a data-entry mistake, and flooring it at zero hides the
mistake and gives the money away.

One calculation, one renderer: checkout, the quote dialog, the invoice and the receipt are four
screens showing one number, and two of them disagreeing is how a customer stops believing every
figure the product shows, including the correct ones.

### Selecting rows, and acting on many at once (CP-18)
A list that supports multi-select carries a checkbox on **every row** and a **three-state**
checkbox in the header: none · some · all, where `some` renders indeterminate. A header
checkbox showing plain "off" over four selected rows is not a cosmetic problem — it is the
screen telling the user something false about what their next click will act on.

"Select all" means the rows **currently in view**, and the bar says so in words. The other
reading — every record matching the filter — is how a user deletes a year of data intending to
delete a page of it. When the filter changes, rows that left the view leave the selection, and
the screen says how many: a selection that outlives its filter reaches records the user cannot
see, which is the same defect arrived at slowly.

Bulk actions then obey the reversibility decision above: the destructive one confirms with the
count and the scope named, the reversible one goes straight through with Undo.

### Configuration is not a peer of daily work
A settings screen does not earn a slot beside the lists a user touches every day. Before adding
an item to any navigation row, ask what **kind** it is and how often it is opened. If the answer
differs from its neighbours, it is not their sibling.

### Dialogs never eat work
A backdrop tap does not dismiss an input dialog. Typed data survives until the user
intentionally closes. Closing with unsaved changes asks first. One stray tap should never cost
a user five minutes of typing.

### Every list is searchable, filterable and sortable — by default
A list or table view is never shipped bare. It carries, through the shared implementation
(CP-23), one search box across the module's key fields, the contextual filters its data
supports, the date presets where the data is dated (Today · This week · Last week · This
month · Custom range), and ascending/descending sort on the relevant columns — with the count
shown as *matching / total* so a narrowed list never reads as missing data. These are not
per-module decisions: a user who has learned one list has learned them all, and the module's
only job is to say which fields are searchable, which filters apply, and which columns sort.

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
