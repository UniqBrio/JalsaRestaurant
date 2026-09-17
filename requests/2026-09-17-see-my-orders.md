# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->
<!-- Stated fields are BINDING. "unknown" is a Gate 1 question, never a blank to fill. -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: as stated — `Add a button "See my orders" to see it quick and easy for them to
  reorder the paste orders quick(They can add favorite now)`. Read as: a guest on the cart
  screen can reach what they have already ordered, and re-order from it in a tap or two.
- WHERE IT LIVES: the guest's **"Check your order"** cart screen at `/t/<table>`
  (`CartScreen`, `GuestOrdering.tsx:540`), from the screenshot. Its bottom bar today holds
  "Send to the kitchen" and a `＋` icon ("Add something else" → the menu).
- MUST-HAVE (requester to trim at Gate 1):
  - a button reading **`See my orders`**
  - it shows what has already been ordered
  - re-ordering from it is quick — "reorder the paste orders quick"
- EXPLICITLY OUT: nothing stated.
- WHO USES IT: guests on their own phone. Not stated beyond that.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the cart screen's action bar at minimum; whatever the button opens
  is `unknown` until Gate 1 (a sheet, the existing order list, or a new screen).
  Empty state matters here and is `unknown`: what does "See my orders" show on a guest's
  **first** round, when there is nothing yet?
- STRINGS ADDED OR ALTERED: `See my orders` — the requester's exact words.
- PERMISSIONS: no — guest surface.
- USAGE PROFILE: all `unknown` — frequency, whether re-ordering the same dish is common at
  Jalsa, and whether this is for a second helping of one dish or a repeat of a whole round.
- RUN MODE: auto
- SCALE: unknown

## WHAT INTAKE FOUND WHILE CLASSIFYING (evidence, not a plan)
Two facts that decide what this feature can even mean, so Gate 1 should not be answered without
them:

1. **Favourites are not stored.** The request says "(They can add favorite now)", and the heart
   does exist on the order list — but it is `React.useState` and nothing else
   (`GuestProgress.tsx:79`, `const [loved, setLoved] = useState<Record<string, boolean>>({})`).
   There is no column, no table, no route. `GuestClosure.tsx:603` already says so in a comment:
   *"the heart on the order list is component state and is gone by now"*. A reload loses every
   heart. So "reorder from my favourites" is not a shortcut to something that exists — the
   storing would have to be built first, and that is a schema change.

2. **"Past orders" has two possible meanings and only one of them is buildable today.**
   - *Earlier rounds on THIS bill* — these exist (`guest-view.ts:186`, `bill.kots` → `rounds`)
     and are already rendered on the "Your order" screen, one chevron away. A "See my orders"
     button would be a **shortcut plus a re-order verb**, which is small.
   - *Orders from PREVIOUS visits* — Jalsa is QR-first with no guest account by design; a
     session belongs to a table, not a person. There is nothing that could identify "my" past
     visits, so this reading is not a feature, it is an identity system.

## OPEN QUESTIONS FOR GATE 1 (not decided at intake)
1. **Which orders?** This bill's earlier rounds, or previous visits? If previous visits, that is
   a different and much larger request and should be said out loud before anything is built.
2. **What does "reorder" add to the cart** — one dish, or a whole round repeated?
3. **Does this need favourites to be persisted first?** If the button is meant to open a list of
   hearted dishes, storing the heart is a prerequisite and a schema change, and it should be its
   own `/request` ahead of this one.
4. **Where does the button go?** The cart bar currently holds a full-width primary and a 44px
   icon. A third control there is the shape that just went wrong on the closure bar (JP-22), so
   placement is a real decision, not a detail.

## STANDING INSTRUCTIONS (do not edit)
- Track A order is binding: Gate 1 questionnaire (every `unknown` above is a question) → design
  → plan → build → test gate. Nothing is built before Gate 1 is answered.
- MUST-HAVE is the requester's list; the track may propose trims at Gate 1 but never silently.
- The five permission questions are answered in the plan, before build.
- Every backend change is a migration file.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.
