# BUG REQUEST — something is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->
<!-- Root cause comes before any fix - always. Stated fields are BINDING; "unknown" is honest. -->

Run **Track C** ([workflows/bug.md](../../workflows/bug.md)) with this request.

## FIELDS
- WHERE: Owner → Settings → the submenu navigation (the chip row above the settings panels)
- WHAT HAPPENS: `"after 'Customer engagement', the 'Printers & machines' submenu is not visible because the submenu navigation is effectively behaving as a constrained/non-wrapping horizontal row"`. Screenshot supplied at desktop width shows the tenth chip cut off at the right edge of the viewport.
- WHAT SHOULD HAPPEN: all 10 submenu items always visible; no clipping, no hidden item, no reliance on an invisible horizontal scrollbar, no disappearance at any viewport width. Active submenu stays clearly visible. Layout adapts across desktop, tablet and mobile by WRAPPING, not by compressing.
- WHEN IT STARTED: unknown — the requester reports it as a currently confirmed problem. The tenth item (`Printers & machines`) was renamed from `Printers` and became the longest label on 16-Sep-2026, which is when the row would have first exceeded the width.
- WHO IS AFFECTED: the owner console only, at "current desktop-width rendering" as stated. Guest and staff surfaces are not mentioned and do not carry this nav.
- REPRO STEPS: 1) Sign in to `/owner` 2) Open Settings 3) Observe the submenu row — `Printers & machines` is cut off at the right edge with no visible scrollbar
- WAS WORKING BEFORE?: unknown
- CORRECTION ROUND: 1

## BINDING CONSTRAINTS (stated by the requester, verbatim in substance)
- **Forbidden:** shrinking text to fit · tiny unreadable text · negative margins · transforms ·
  fixed pixel hacks · `overflow: hidden` · clipped content · invisible horizontal scrolling ·
  `text-overflow: ellipsis` · hidden submenu items · a horizontal scrollbar as the primary
  solution. *"The goal is responsive composition, not compression."*
- **Preferred:** `display:flex` + `flex-wrap:wrap`, content-sized items, consistent gap,
  `width:100%` — or an equivalent responsive grid. **Do not introduce a new visual component if
  the existing Chip/Pill already supports this.**
- **Scope:** ONLY the Settings submenu navigation. Not the Owner screen, not the Settings cards,
  not the panel content.
- **Preserve:** labels · order · navigation behaviour · routes · active-state logic ·
  permissions · panel content · backend · database · business logic · typography · colours ·
  logo · tokens · the VF-3 typography migration · every existing test id.
- **Verify at:** 1440 · 1280 · 1024 · 834 · 768 · 430 · 390 · 360 px.
- **Validation:** targeted Settings/render tests, full render tier, TypeScript, ESLint, unit,
  build, `theme:check`, Jalsa `audit:all`, `guard:test`. **No E2E; do not modify E2E infra.**
- **The 102 framework-sync paths outside `jalsa/` are READ-ONLY.**
- **RUN MODE: auto.** Do NOT commit. Do NOT push. Stop after the report.

## STANDING INSTRUCTIONS (do not edit)
- Track C order is binding: search `docs/registers/ROOT_CAUSE_REGISTER.md` for the same class;
  state the ROOT CAUSE, distinct from the symptom, BEFORE any fix; reproduce with a failing
  test, fix at the root, make it pass; if the cause is a pattern, sweep EVERY sibling site;
  append the root-cause entry; then the test gate.
- WHO IS AFFECTED is evidence — a fix whose mechanism does not explain the stated selectivity
  has not found the root cause.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why. A recurring "fixed" bug is a process finding — flag `/framework-update`.
- Data-store-level cause → STOP, propose the change, wait for approval. Production is never
  touched automatically.
