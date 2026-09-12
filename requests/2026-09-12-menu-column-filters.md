# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: Owner console → Menu tab. Today: "57 ITEMS ACROSS 11 CATEGORIES", one global search box ("Search name, category or food type"), an Export button, and a table whose ITEM / CATEGORY / TYPE / PRICE / AVAILABLE headers already sort.
- CURRENT BEHAVIOUR: one search box across every column, and nothing else. Narrowing to "non-veg biryani that is available" cannot be expressed at all.
- DESIRED BEHAVIOUR: "Update the Owner → Menu screen to replace the current common/global filter with column-wise filtering. Use the attached reference image as the UX pattern." Per column:
  - **Item** → search/filter by item name
  - **Category** → the category list (Veg Starters, Non-Veg Starters, Biryani, Rice, Chinese, Desserts, Beverages, etc.)
  - **Type** → All / Veg / Non-Veg / Egg
  - **Available** → All / Available / Unavailable
  - **Price** → price range (see the decision below)
  - "Filters should be independent and combinable. Example: Category = Biryani + Type = Non-Veg + Available = Yes."
  - "Clearly indicate when a column has an active filter." · "Provide an easy way to clear an individual column filter."
  - Badge and clear-all: 'Show a compact "Clear all" control above the table. Also show a small filter indicator/badge displaying the number of active filters. [ Filter icon 3 ] [ Clear all ]. The number represents how many column filters are currently active. "Clear all" must reset every active column filter in one click and restore the full Menu list. If only one filter is active, still allow the user to clear it individually from that column. When no filters are active, hide the "Clear all" control and active-filter count.'
- WHY: "make the Menu management screen behave like a professional data table where the owner can filter directly from the relevant column header without cluttering the interface."
- MUST NOT CHANGE: stated verbatim — "Keep sorting separate from filtering." · "Do not introduce a large filter panel or common filter bar." · "Keep the existing search box for quick global text search if it is already present." · "Preserve the existing Jalsa visual design and table layout." · "Do not add a large filter toolbar or create unnecessary UI clutter."
- CORRECTION ROUND: 1
- RUN MODE: auto
- SCALE: scoped

## THE ONE THING THE REQUESTER RESOLVED AT THE GATE
The Price dropdown as first written listed *Low to High · High to Low · Price range* — two sorts
and a filter in one menu, against "keep sorting separate from filtering" in the same message.
Asked, and answered: **"Use the Price filter dropdown only for price range filtering, and keep
Low → High / High → Low sorting on the Price column header."** Binding, and built that way.

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the Menu table — no filter, one filter, several filters, a filter matching nothing ("nothing found" is a different state from "nothing yet", which this table already distinguishes), and each dropdown's own open state. Both themes.
- STRINGS ADDED OR ALTERED: the dropdown labels the requester listed (All / Veg / Non-Veg / Egg; All / Available / Unavailable), "Clear all", "Clear", and the range's Min/Max. The existing search placeholder and every other string on the screen are frozen.
- PERMISSIONS: no. Filtering a list you can already see changes nothing about who may see it.
- USAGE: 57 items across 11 categories today, growing. The screen is where the owner turns dishes on and off during service.

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with the
  sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks (B4),
  touching only what DESIRED BEHAVIOUR requires.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it, never
  subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4).
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## B0 — THE REUSE CHECK, AND WHY THIS IS A REFINE
`src/components/ui/data-table.tsx` is the ONE table every owner screen uses — Menu, Staff, Tips,
Expenses, Audit — and `src/lib/list-controls.ts` already holds the pure search/filter/sort rules
with its own rung. Building column filters inside `MenuSection.tsx` would fork the table: the
Menu would filter one way and the other five screens another, and the next request ("do it on
Staff too") would be a second implementation.

So: **REFINE.** The capability goes into `DataTable` as an optional per-column `filter` spec, and
the matching rules go into `list-controls.ts` beside the ones already there. The Menu screen
becomes the first caller to declare them. Every other owner table gains the ability and shows
nothing new until it asks.

## NOT STATED BY THE REQUESTER
- **Whether "Clear all" also empties the global search box.** The badge counts *column* filters,
  but "restore the full Menu list" is unambiguous about the outcome — and a search box still
  holding text while the list ignores it is worse than either. Built as: Clear all clears the
  column filters **and** the search box; the badge keeps counting column filters only.
- Whether the Category dropdown lists every category or only those present in the current rows:
  not stated. Built from the rows actually in the table, so a category with nothing in it does not
  offer a filter that returns an empty screen.
- Whether filters survive leaving the Menu tab and coming back: `unknown`. They do not — the state
  lives in the table, and a filter silently still applied when you return is how an owner concludes
  half the menu has vanished.
- Whether the reference image's always-visible filter ROW should be copied literally: it is a
  desktop data grid with a permanent input under every header. The requester also says "do not
  introduce a large filter panel or common filter bar" and asks for a filter control **in each
  column header**. Built as the header control they describe, not the permanent row the image
  shows — the two halves of the brief disagree, and the words are the more specific.
