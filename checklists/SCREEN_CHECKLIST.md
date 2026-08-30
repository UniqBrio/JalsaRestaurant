# Screen Checklist

> Run at build completion for **every new or modified screen**, and re-verify at the test gate.
> Output ✅ / ❌ / N-A **per item, per screen**. Any ❌ means not done.
>
> ### The cap: 20 items. This list is FULL.
> Adding an item means **removing, merging or automating another**. That trade is the mechanism,
> not an inconvenience — a checklist nobody can finish is a checklist nobody runs.

---

## Input

**1.** Numeric fields use a numeric input mode and reject non-numeric characters.

**2.** A required field shows a **visible validation message**. Never a silently disabled submit
button — the user cannot tell whether it is broken or they are.

**3.** Sensible max lengths. Formatted fields use the shared component. Date fields open the
shared picker and render one canonical display format.

**4.** Focus chain: the first field is auto-focused; a searchable dropdown focuses its search
input on open; Enter submits when the form is valid.

## Navigation

**5.** The screen follows the **sibling pattern** — how do the existing screens in this area
mount? Read one before writing this one.

**6.** Back behaviour and application chrome match the siblings.

**7.** If it is a route, a **cold direct load** works — not just arriving via in-app navigation.

## States

**8.** Empty, loading, error and offline all exist, and **loading always terminates** (a
`finally`, not a hope). A never-resolving spinner is a failure, not a skip.

**9.** Destructive actions confirm. Reversible ones use undo, not a dialog. An input dialog
**never dismisses on a backdrop tap**, and closing with unsaved changes asks first.

## Appearance

**10.** **Verified in BOTH themes, by looking at it.** No raw colour literals. "The build
compiled" is not evidence that text is readable.

**11.** At the narrowest supported width, one-handed: no horizontal scroll, touch targets ≥ 44px.

**12.** Content clears any fixed chrome — verified at a viewport **short enough to overflow**,
using the shared clearance constant, never a hand-picked number.

**13.** Emphasis names a meaning. Peer actions share one treatment, **at most one is primary**,
and status is never conveyed by colour alone.

## Data

**14.** All data access goes through the single client. All errors go through the classifier.

**15.** Every query is tenant-scoped. A permission denial shows an honest no-access state —
never an empty list that looks like real data.

**16.** Entity cardinality matches what the requirements actually specified.

## Done

**17.** Test cases added or updated in the registry, with today's date.

**18.** Every new or modified interactive element carries a stable test id:
`<module>-<element>[-<entityId>]`, entity id from the **database**, on the control that handles
the interaction.

**19.** Every new or changed visible string was authored through the copy pass, uses approved
terms, and **no shipped string was reworded** without an explicit request.

**20.** The module document is updated in **this** change.
