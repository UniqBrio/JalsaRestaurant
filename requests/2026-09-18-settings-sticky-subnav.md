# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: `Owner → Settings (the sub-tab row: Opening hours … Printers & machines)`
- CURRENT BEHAVIOUR: `The Settings sub-tab row is an ordinary element in the page flow inside <main>. Scrolling down through a panel's content carries it off the top of the viewport, so switching to another Settings screen costs a scroll back to the top.`
- DESIRED BEHAVIOUR:
  - `The Settings sub-tab row stays reachable at every scroll position.`
  - `position: sticky, with the top offset derived from the real Owner header — NOT position: fixed, and not a hardcoded pixel constant.`
  - `Content scrolls beneath it and is never hidden behind it.`
  - `The active sub-tab stays visually identifiable; clicking one behaves exactly as today; URL/state/deep-link behaviour is unchanged.`
  - `Existing responsive wrapping is preserved — no clipping, no horizontal overflow, no shrunken text, no second scrollbar.`
- WHY: `Long settings areas are where the owner hops between siblings most; pinning the parent bar and not the child solves half the problem.`
- MUST NOT CHANGE:
  - `Tab names, tab order, active-state styling, typography, colours. Spacing only where sticky positioning genuinely requires it (requester's own carve-out).`
  - `Settings content, Settings functionality, database behaviour, navigation semantics.`
  - `Global navigation behaviour and every other Owner section.`
  - `Everything not named in DESIRED BEHAVIOUR — and explicitly the other seven uncommitted workstreams in this tree.`
- CORRECTION ROUND: `1`

## DESIGN SURFACE
- VISUAL?: `yes`
- SCREENS & STATES TOUCHED: `Owner → Settings only. No new states: loading, error, offline and permission-denied are untouched — this is layout, not data. The permission-gated panel list is unchanged.`
- STRINGS ADDED OR ALTERED: `none. Every string on the screen is frozen.`
- PERMISSIONS: `no. The sub-tab row already renders only the panels the viewer holds a grant for; that filter is untouched.`
- USAGE: `The owner, whenever configuring the restaurant. Ten sub-sections, several with long panels — Opening hours is seven day-rows plus the last-order rule, and Tables & QR and Printers & machines are longer still.`
- RUN MODE: `auto`
- SCALE: `scoped`

## B1 — WHAT THE CODE ALREADY DEFINES (read before any change, as the requester required)

**The requester asked for the actual reason, not a guess. It is an ABSENT property, not a blocked
one.** No ancestor of the sub-tab row carries `overflow`, `transform`, `contain` or a filter that
would break `position: sticky`. The chain is
`div.min-h-dvh › main.mx-auto.flex.flex-col › div.flex.flex-col.gap-4 › nav`.
Sticky was simply never applied — the row is a static element in normal flow, so it scrolls with
the page exactly as any other element would. Nothing has to be *unblocked*; something has to be
*added*.

| Question | The existing code |
|---|---|
| Is the primary bar pinned? | Yes — `OwnerConsole.tsx:126`, `<header className="sticky top-0 z-30 …">`, holding the identity row **and** the sections nav |
| Where does the Settings sub-nav live? | `SettingsSection.tsx:82`, `<nav className={CHIP_NAV_WRAP} aria-label="Settings sections">`, inside `<main>` — a different block from the header |
| Is the header a fixed height? | **No.** Its first row is `flex flex-wrap items-center gap-3 px-4 py-3`; at narrow widths the name, the counts and the sign-out group wrap onto further lines and the header grows |

**Consequence that decides the implementation:** because the header height is variable, a
hardcoded `top` would be correct at one width and wrong at the rest — precisely the "fixed pixel
hack without understanding the layout" the requester forbade, and precisely the overlap that
`OwnerConsole.tsx:29-31` already names as *"the failure mode of pinning them separately"*.

## THE SPECIFICATION ALREADY REQUIRES THIS

This is not a new idea; it is an unimplemented standard. `Reusable Design Standards.dc.html`,
**Standard 1.2 — "Sub-navigation gets the same treatment"**:

> Secondary tabs pin below the primary bar and stay visible while their panel scrolls. Long
> settings and report areas are exactly where users hop between siblings most. Pinning the parent
> and not the child solves half the problem.
> **USE IN** settings, reports, profile areas, anything with six or more sub-sections.
> **PATTERN** One visual step down from the primary bar — smaller type, thinner underline,
> identical interaction. **Stack both into one sticky block so they can never overlap.**

`OwnerConsole.tsx:24-31` already cites Standards 1.1 and 1.2 by number and implements the
*first* half ("the two bars stack into ONE sticky block"). The Settings sub-bar is the third bar
and was left outside that block.

**ASSUMPTION, STATED BECAUSE IT IS BINDING ON THE RESULT:** the standard's prescribed pattern —
one sticky block — is followed, rather than a second sticky element with a measured offset. That
means the sub-tab row renders inside the header block and therefore sits on the header surface
above its bottom border, roughly 20px higher than today. That is a visible change, it is what
Standard 1.2 asks for ("one visual step down from the primary bar"), and it is the only approach
that cannot overlap *by construction* and needs no JavaScript, no measurement and no constant.
**If the requester would rather the row stayed visually exactly where it is, say so and it
becomes a sticky element with a ResizeObserver-driven offset instead — same behaviour, a
one-frame lag, and JavaScript the requester asked to avoid.**

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks
  (B4) — confirm mode waits for approval; auto mode (default) logs it and applies — touching
  only what DESIRED BEHAVIOUR requires. Every changed line must trace to this request.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4), scoped to the touched
  area: states, both themes in semantic tokens, the string table, the permission answer.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why (B1). If the miss was the process's fault, flag `/framework-update` too.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.
