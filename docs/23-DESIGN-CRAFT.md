# 23 — Design Craft

> What separates a screen that merely works from one that feels designed by someone with
> twenty years of taste. The design stage ([01 §Stage 3](./01-SDLC.md)) executes this file;
> [checklists/DESIGN_QUALITY_CHECKLIST.md](../checklists/DESIGN_QUALITY_CHECKLIST.md)
> validates it, area by area, before Gate 3.
>
> This file is **reference**, not rules — the enforcement lives in the checklist and the
> Gate 3 validation loop. Interface *rules* live in [04 §5](./04-ARCHITECTURE-AND-DESIGN.md);
> theme, contrast and assets in [11](./11-THEME-AND-COLOR-SYSTEM.md)–[14](./14-LOGO-AND-IMAGE-ASSETS.md).
> This file does not restate them; it covers the craft between the rules.

---

## 1. The bar, stated operationally

"Wow factor" is not decoration. It is the absence of friction so complete that the user
notices — the feeling that someone anticipated exactly what they came to do. It decomposes
into things that can be checked:

| The feeling | The mechanism behind it |
|---|---|
| "It already knew what I wanted" | The most common case needs zero actions; defaults are right; the primary action is where the eye lands first |
| "I never got lost" | Predictable navigation, one named primary action per screen, breadcrumbs of state (where am I, what changed) |
| "It's so clean" | One idea per screen region; information density matched to the task; nothing on screen that doesn't earn its place |
| "It just flows" | Contextual dialogs instead of round-trips; undo instead of interrogation; three interactions to anything key |
| "Even the errors are nice" | Every state designed — error text that says what to do next, empty states that offer the first step |
| "The details are right" | Aligned edges, consistent spacing rhythm, one voice in the copy, both themes flawless, focus rings that look intentional |

None of these is subjective. Each is a property the validation loop can look for and find
missing.

### What NOT to do — sophistication through simplicity, never gimmicks

The fastest way to lose the crafted feeling is to chase it with decoration. Each of these is
banned *when it does no work*:

- **Animation** that delays the user instead of explaining a change — motion is feedback, not
  garnish, and it never gates interactivity ([13](./13-CONTRAST-AND-ACCESSIBILITY.md)).
- **Gradients, shadows, borders** stacked to make things "pop" — if hierarchy needs a shadow,
  the type scale and spacing failed first; fix those.
- **Cards around everything** — a card is a boundary claim; a screen of nested boxes reads as
  bureaucracy. Whitespace groups better ([§3](#3-visual-hierarchy--the-screen-read-in-one-second)).
- **More colour** — every added colour dilutes the ones carrying meaning. Neutral is the
  default; colour is spent on state and identity, sparingly.
- **Icons without labels** — an icon the user must hover to understand is a riddle, not a
  shortcut. Icons accompany words; alone, only when universal.
- **Complex interactions** where a boring one works — a drag-and-drop that could be two
  buttons, a gesture that could be a tap. Clever is a cost the user pays every visit.

The wow factor comes from the *left* column of §1 — anticipation, flow, states, details — and
each gimmick above spends attention the left column needs. When a design feels flat, the
answer is almost always subtraction plus hierarchy, not addition.

---

## 2. Information architecture — grouping before layout

Layout cannot rescue bad grouping. Before any screen is sketched:

- **Group by the user's task, not the data model.** The schema says payments and invoices are
  different tables; the user says "money". A grouping that mirrors the database makes the user
  learn the database.
- **Name each group with the word the user would say** (the lexicon). If a group cannot be
  named in one plain word, it is two groups — or none.
- **Seven, plus or minus, is real.** A navigation row, a form section, a card of stats: past
  a handful of peer items, scanning becomes searching. Split by task, or collapse by
  frequency — never alphabetically, which optimises for the one user who already knows the name.
- **Frequency earns position.** The thing used daily sits first and is reachable in one
  interaction; the thing used monthly may sit behind one more. Configuration is never a peer
  of daily work ([04 §5](./04-ARCHITECTURE-AND-DESIGN.md)).

### Consolidation — simplify the experience, not the capability

Collapsing six tabs into two is the *start* of a consolidation, not the end. A consolidation
is finished when:

1. **Nothing was lost.** Every capability of the old structure is reachable in the new one —
   enumerate them and check each off. A consolidation that quietly drops a feature is a
   regression wearing a redesign.
2. **The groups are logical**, not merely fewer. Two tabs holding "the first three old tabs"
   and "the other three" is compression, not architecture. The new groups must each answer to
   one task-word.
3. **The inside is structured.** A merged surface needs internal hierarchy — sections,
   progressive disclosure, a scannable order — or six shallow screens have become one deep
   swamp, and the click count went *up*.
4. **It scales.** Ask where the next three features will land. A structure with no obvious
   home for growth will be broken by the first addition.

---

## 3. Visual hierarchy — the screen read in one second

A user's first second on a screen answers three questions in order: *what is this*, *what
matters most*, *what do I do*. Design for that read:

- **One focal point.** The primary action or the key number is visually loudest; everything
  else steps down from it. Two things shouting is nothing shouting.
- **Size, weight, spacing — then colour.** Hierarchy built from type scale and whitespace
  survives both themes and every accessibility setting; hierarchy built from colour alone
  fails all of them ([13](./13-CONTRAST-AND-ACCESSIBILITY.md)).
- **A consistent spacing rhythm.** Pick the scale from the tokens and never eyeball a gap.
  Misaligned edges and irregular gaps are what "unpolished" actually means — users can't name
  it, but they feel it.
- **Group by proximity before boxes.** Whitespace groups better than borders; a screen of
  outlined cards inside outlined sections reads as a form to fill in, not a place to work.

## 4. Information density — matched to the task

Density is not a style preference; it is a property of the task:

- **Scanning tasks** (lists the user works through daily) want high density: compact rows,
  more per screen, details on demand.
- **Deciding tasks** (a confirmation, a diagnosis, a choice) want low density: one decision,
  its evidence, its actions — nothing else.
- **Entering tasks** (forms) want progressive disclosure: the required core visible,
  everything optional behind "more", smart defaults pre-filled ([04 §5](./04-ARCHITECTURE-AND-DESIGN.md)).

The failure mode in both directions is the same — cognitive load. A sparse screen that takes
four paginated steps loads memory ("what did step 2 say?"); a dense screen with no hierarchy
loads attention. Count what the user must *hold in their head* at each moment; the design with
the smallest number wins.

## 5. User flows — designed end to end, not screen by screen

A flow is the unit of experience; screens are just where it pauses.

- **Draw the flow first**: entry point → steps → exit, for each of the 3–5 scenarios the
  feature exists for. Every step must either gather something genuinely needed or be deleted.
- **Momentum is preserved.** After every action the user can see what happened and what to do
  next — success states name the next step, dialogs return focus to where work continues,
  saves land the user where the result is visible.
- **Interruptions are survivable.** A flow abandoned mid-way loses nothing typed
  ([04 §5 — dialogs never eat work](./04-ARCHITECTURE-AND-DESIGN.md)) and can be resumed.
- **The exits are designed too.** Cancel, back, Escape — each leaves the system in a state
  the user can predict.

## 6. Interaction patterns — elegant means unsurprising

The catalogue of blessed substitutions lives in [04 §5](./04-ARCHITECTURE-AND-DESIGN.md) and
the canonical patterns register. Craft-level additions:

- **Optimistic where safe, honest where not.** A toggle flips instantly and reconciles behind
  the scenes; a payment shows its true pending state. Choosing which is a design decision,
  made per action, in the spec.
- **Feedback within 100ms**, even if it is only the pressed state. Work longer than a second
  shows progress; longer than a breath, a skeleton of the shape to come — never a spinner
  centred in white.
- **Contextual actions live at the point of need** — on the row, at the field, in a small
  dialog — not in a global menu the user must remember exists.
- **Consistency beats novelty.** The tenth screen should cost nothing to learn because it
  behaves like the nine before it. An interaction pattern is only "elegant" the second time
  the user meets it.

## 7. The polish pass — small details, checked deliberately

The last mile that separates production-grade from crafted. None of these is expensive; all
of them are forgotten:

- Numbers align right and share decimal places; dates share one format; units are stated.
- Text truncates with intent — ellipsis plus a way to see the whole value, never mid-word
  clipping.
- Interactive things look interactive; static things don't. Hover, pressed, focus and
  disabled states all exist and all differ.
- Empty, one-item and thousand-item versions of every list are each designed — the singular
  label, the plural, the overflowing.
- Loading is layout-stable: content appears where the skeleton was, nothing jumps.
- The favicon, the page title, the toast position, the scroll restoration — the frame around
  the feature behaves as deliberately as the feature.

---

## 8. Asking instead of assuming

A design decision that materially affects the experience is the requester's to make, not the
designer's to guess. Raise a question — with a reasoned recommendation, exactly as at Gate 1 —
whenever:

- two defensible directions exist and the choice shapes the experience;
- requirements conflict, and resolving silently would drop one;
- a technical or business constraint forces a visible trade-off;
- the scenario walk reveals a step whose necessity only the requester can judge.

A weak assumption baked into an approved design is the most expensive kind: it carries the
requester's signature without their intent, and surfaces as "this isn't what I meant" after
the build — the correction-on-correction loop, restarted at the design stage.
