# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->
<!-- Stated fields are BINDING. "unknown" is a Gate 1 question, never a blank to fill. -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: as stated — `Implement a Jalsa-wide standardized SEARCHABLE COMBOBOX pattern.`
  One reusable component, consistent behaviour, used across all appropriate pages/forms; no
  second implementation of the same interaction.
- WHERE IT LIVES: a new shared primitive in `src/components/ui/`, alongside `field.tsx`,
  `column-filter.tsx` and `data-table.tsx`, then migrated into the fields the audit approves.
- MUST-HAVE (stated in full by the requester, binding):
  - single selection · searchable options · keyboard navigation (↑ ↓ Enter Escape) ·
    mouse/touch selection · controlled value · disabled · loading · empty · optional creation ·
    error state · clear/reset · accessible labelling · outside-click dismissal · focus management
  - "Search or add" behaviour: `⊕ Add "X"` appears only when X has no exact existing match
  - search is case-insensitive, immediate, deterministic, whitespace-aware, special-character
    safe; the stored value is never mutated because the query differed in casing
  - creation goes through the existing data layer, handles duplicates/races, selects the new
    value, closes, preserves parent form state, uses Jalsa's existing success/error feedback
  - combobox ARIA semantics (`role="combobox"`, `aria-expanded`, `aria-controls`,
    `aria-autocomplete`, `aria-activedescendant`, `role="listbox"`, `role="option"`)
  - works at 320 · 360 · 375 · 390 · 430 · 768 · 834 · 1024 · 1280 · 1366 · 1440 · 1536 · 1920,
    with no horizontal overflow, no clipped option text, no list outside the viewport, and no
    tiny text or per-screen pixel hacks as the remedy
  - works inside modals/sheets: above the content, clickable, scrollable, not clipped by an
    overflow parent, not dismissed by the parent's click handling
  - the 20 listed component tests, then representative migrated fields per surface
- EXPLICITLY OUT (stated): blind replacement of every `<select>` · multiple implementations of
  the same interaction · redesigning unrelated UI · business-logic changes not required to make
  the combobox work · changes to the approved Jalsa design system · any change to stored IDs,
  foreign keys, enum values or API contracts · creation on filter controls · booleans, radios,
  two/three-option toggles, numbers, dates, times, ordinary text, status pills · framework-sync
  files · restoring or modifying E2E/Playwright infrastructure · **committing or pushing**
- WHO USES IT: owner/admin in the console, captains and waiters on the floor, guests on their
  phones — wherever a field is a selectable value from a list.
- CORRECTION ROUND: 1

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the new primitive (closed · open · filtered · no-match ·
  create-offered · loading · disabled · error), then each migrated field's form.
- STRINGS ADDED OR ALTERED: `Search or add a category` and `Add "<value>"` as the requester
  wrote them; `Loading...`; `No matching categories`. Everything else on every touched screen
  is frozen.
- PERMISSIONS: no change intended. Creation must respect restaurant scoping, authorization and
  RLS exactly as the existing data layer does.
- USAGE PROFILE: `unknown` beyond what the audit shows about option-set sizes.
- RUN MODE: auto
- SCALE: full — one new shared primitive plus migrations across several sections.

## WHAT INTAKE FOUND WHILE CLASSIFYING — PHASE 1 AUDIT (evidence, not a plan)

### The premise needs correcting before anything is built
The brief says *"The reference interaction is the existing Jalsa UI shown in the 'Add income'
form"*, with a styled dropdown and an `⊕ Add "New"` row. **That interaction does not exist in
this codebase.** There is no combobox anywhere: `role="combobox"`, `role="listbox"`,
`aria-autocomplete` and `aria-activedescendant` return zero hits across all of `src/`.

The closest thing is Expenses → Category (`LedgersSection.tsx:347-360`), which is an ordinary
`<Input>` with a native **`<datalist>`**. Its own comment says why: *"A datalist rather than a
closed dropdown: the list covers the common case and typing a new category creates it in place."*
A datalist is drawn by the browser, is styled by the browser, has no `⊕ Add` row, and looks
different on every engine. And the attached screenshots show the **Menu → Add an item** modal,
where the open list is the operating system's own `<select>` popup — the blue-highlighted list
in the second screenshot is Chrome's, not Jalsa's.

So this is not "standardise an interaction that already ships in one place". It is **design and
build a new one, then migrate**. That is a bigger and more valuable piece of work than the brief
assumes, and it should be said out loud before Gate 1 rather than discovered at build.

### The complete inventory — 14 fields, 1 filter system, 1 hand-rolled picker
Every `<select>` in the application is the one shared `Select` primitive in
`components/ui/field.tsx:93`; there are **13 call sites**, all in the owner console. Nothing in
the staff or guest surfaces uses a select at all.

| # | Component | Field | Options source | Static/DB | n | Class |
|---|---|---|---|---|---|---|
| 1 | `MenuSection.tsx:293` | Category (Add/Edit item) | `data.categories` | **DB** `menu_category` | 11 | **B** search + create |
| 2 | `LedgersSection.tsx:347` | Expense category | `EXPENSE_CATEGORIES` ∪ used values | static ∪ DB-derived | 9+ | **B** search + create (the datalist) |
| 3 | `PrintSetupSection.tsx:1016` | Machine for a KOT route | `kotPrinters` | **DB** `printer` | varies | **A** search-only |
| 4 | `MenuSection.tsx:307` | Food type | `FOOD_TYPES` | static | 3 | **C** keep |
| 5 | `StaffSection.tsx:261` | Role | `ROLES` | static | 5 | **C** keep |
| 6 | `StaffPaperwork.tsx:388` | Gender | inline | static | 3 | **C** keep |
| 7 | `StaffPaperwork.tsx:401` | Employment type | inline | static | 4 | **C** keep |
| 8 | `WaitlistSection.tsx:339` | Source | inline | static | 2 | **C** keep |
| 9 | `SettingsSection.tsx:441` | Number-series reset | inline | static | 3 | **C** keep |
| 10 | `SettingsSection.tsx:448` | Rounding | inline | static | 3 | **C** keep |
| 11 | `SettingsSection.tsx:1112` | Invoice sent when | inline | static | 3 | **C** keep |
| 12 | `PrintSetupSection.tsx:430` | Printer purpose | inline | static | 2 | **C** keep |
| 13 | `PrintSetupSection.tsx:449` | Paper width | inline | static | 2 | **C** keep |
| 14 | `PrintSetupSection.tsx:463` | Connection | inline | static | 3 | **C** keep |

Not a `<select>`, but in scope for Phase 10 and Phase 16:

| | Component | What it is | Class |
|---|---|---|---|
| F | `column-filter.tsx` + `data-table.tsx:310` | `ColumnFilterControl` — a Radix popover with `OptionsFilterBody`, `TextFilterBody`, `RangeFilterBody`; the filter system for **every** owner data table | **D** filter — no creation, ever |
| G | `LiveOrders.tsx:44` | `staffQuery` — a hand-rolled search box over a filtered staff list, for reassigning a bill's captain/waiter. Added 17-Sep-2026 | **A** search-only — **a genuine Phase 16 duplicate** |

`SearchField` (`field.tsx`) is a page-level search box in 4 places, not an option picker, and is
not a candidate. No `autocomplete=` option lists, no multi-select anywhere, no branch or
customer selectors (Jalsa is one restaurant with no customer accounts).

### The honest shape of the result
**3 fields** are real candidates (1, 2, 3) and **11 stay as they are** — the brief's own Phase 2C
says so: a searchable combobox over "Veg / Non-veg / Egg" is worse than a select, not better.
The largest single win is not a migration at all: it is **one component replacing the datalist,
the native select and the hand-rolled `staffQuery` picker**, which are three different answers to
one question today.

## OPEN QUESTIONS FOR GATE 1 (not decided at intake)
1. **Given that the reference does not exist** — is this still the shape you want, knowing the
   interaction has to be designed rather than copied?
2. **Menu Category create.** Field 1 stores `category_id` (Phase 8 says that must not change),
   so `⊕ Add "Starters"` has to insert a `menu_category` row and use its id. There is no
   create-category function in `mutations.ts` today. Is creating a category from inside the
   Add-item modal intended, or should Category stay search-only?
3. **Expense category is a free-text string, not an id.** Migrating it to the combobox is the
   easy one, but the datalist's comment says the in-place creation was a deliberate choice. Is
   replacing it an improvement or a regression?
4. **Field 3, the printer route** — how many machines does Jalsa actually have? The brief's own
   rule is not to convert for consistency alone, and search over three printers earns nothing.
5. **Is field G (the staff picker) in scope?** It was built four hours ago in this same session
   and is the clearest duplicate of the pattern.

## STANDING INSTRUCTIONS (do not edit)
- Track A order is binding: Gate 1 questionnaire (every `unknown` above is a question) → design
  → plan → build → test gate. Nothing is built before Gate 1 is answered.
- MUST-HAVE is the requester's list; the track may propose trims at Gate 1 but never silently.
- The five permission questions are answered in the plan, before build.
- Every backend change is a migration file. The browser never speaks to Supabase.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.
