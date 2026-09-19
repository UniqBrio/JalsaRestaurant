# NEW REQUEST — something that does not exist yet
Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: as stated — add **`How did you hear about us?`** to the guest landing screen
  (the one reading `STILL OPEN — WELCOME IN` / `Jalsa Restaurant` / `Hosur · since 2016`), using
  the standardized Jalsa searchable combobox, with `Add "New value"` support.
- WHERE IT LIVES: `WelcomeScreen` in `src/features/guest/GuestOrdering.tsx`.
- MUST-HAVE (stated): initial options **Google review · Friend recommended · Ordered earlier ·
  Regular customer**; searchable; `allowCreate` because it is a data-entry field; persisted in the
  correct data model, restaurant-scoped, **not browser state only**; placeholder
  `Search or add a source`.
- EXPLICITLY OUT (stated): another custom searchable dropdown; a duplicate field overlapping an
  existing one; creation behaviour on unrelated filter controls; storing it globally across
  restaurants.
- CORRECTION ROUND: 1

## WHAT INTAKE FOUND
- **The shared combobox does not exist.** The brief says "use the shared Jalsa combobox
  implementation from the previous combobox standardization work". That work was **audited on
  17-Sep and not built** — see `requests/2026-09-17-searchable-combobox.md`, whose finding was
  that no combobox exists anywhere in `src/` (`role="combobox"`, `role="listbox"`,
  `aria-autocomplete`, `aria-activedescendant`: zero hits). **This item is blocked on that one**,
  and building a one-off dropdown here is the exact thing both briefs forbid.
- **No attribution field exists.** No `how_heard`, `referral`, `acquisition` or guest `source`
  column on any table. The near-misses are all different facts: `bill.occasion_source` records
  where a *birthday* came from, `kot.source` records which screen placed a *round*, and
  `waitlist_entry.source` records whether a waiting party walked in or scanned. None is
  semantically this, so reusing one would be the "duplicate field with overlapping meaning" the
  brief warns against — in reverse.
- **There is no customer record to hang it on.** Jalsa is QR-first with no guest accounts; a
  guest is a table session. So "customer-level acquisition" has nowhere to live today, and
  visit-level means the **bill**.

## OPEN QUESTIONS FOR GATE 1 — THE FIRST IS BLOCKING
1. **Build the shared combobox first?** It is a prerequisite, and it has its own unanswered
   Gate 1 questions (the reference interaction it was to copy does not exist either).
2. **Visit-level or customer-level?** Intake's reading is visit-level on the **bill**, because
   there is no customer record — confirm, because it decides the migration.
3. **Where do the options come from, and where do added ones go?** Four are named. A guest typing
   `Instagram` has to persist it somewhere the *next* guest sees — which means a restaurant-scoped
   list, i.e. a second table or a settings array, and that is a schema decision.
4. **A guest typing free text into a shared, restaurant-wide list** is an open input from an
   unauthenticated phone. Moderation, length and duplicate-casing rules are unstated.
5. **When is it asked?** The landing screen is before any order. Is it required, skippable, or
   asked once per table session?
