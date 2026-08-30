# Canonical Patterns

> **One blessed idiom per cross-cutting concern.** Inventing a second way is a defect, not a
> preference.
>
> Read the reference file and mirror it. If a concern has no row yet, **bless one first**, then
> follow it.
>
> Append-only. A row is amended in place, dated, with the superseded language kept
> (`AMENDED 2026-03-14 from "…"`). IDs are never reused.

| ID | Concern | The blessed pattern | Reference |
|---|---|---|---|
| CP-1 | Identity resolution | Tri-state: `resolving` / `none` / `value`. Never conflate "still loading" with "genuinely absent" — that is what renders an empty state over data that is about to arrive. | `src/lib/session.ts` |
| CP-2 | Deriving from auth | Gate every derived value until authentication has hydrated. A permission computed from a null identity is `false`, and `false` renders as a denial. | `src/hooks/useAuthReady.ts` |
| CP-3 | Async loaders | Every loader terminates in a `finally`. A spinner that can hang forever is a failure, not a slow success. | `src/hooks/useAsync.ts` |
| CP-4 | Data access | One client module. Every read and write goes through it. No component constructs its own. | `src/lib/api-client.ts` |
| CP-5 | Error classification | `classifyError()`. One decision per catch site. | `src/lib/errors.taxonomy.ts` |
| CP-6 | Permission denial | Honest no-access state. **Never** re-authenticate, never render an empty list that looks like real data. | `src/components/NoAccess.tsx` |
| CP-7 | Sub-page mounting | Sub-pages of a section mount the same way as their siblings. Read one before writing another. | `src/components/TabRow.tsx` (and the section layout that hosts it) |
| CP-8 | Fixed-chrome clearance | Content clears fixed chrome using the named layout constant. Never a hand-picked padding value. | `starter/design/tokens.json` → `layout.bottomChromeClearance` |
| CP-9 | Safe writes | Find-then-update-else-insert, or an explicit conflict clause, against the table's real unique constraint. | `src/lib/upsert.ts` |
| CP-10 | Multi-write flows | One server-side transaction. A cascade that can half-apply will. | `supabase/functions/_shared/tx.ts` |
| CP-11 | Customer-facing failure text | From the wording table. Never a raw engine string, ever. | `src/lib/errors.taxonomy.ts` |
| CP-12 | Calling an external model provider | Server-side only · minimal payload · output treated as untrusted · graceful degradation · pinned versions. | `supabase/functions/_shared/provider.ts` |
| CP-13 | Animation | Configuration is centralised in motion tokens. Motion **never** gates interactivity, and reduced motion collapses to the end state. | `design/tokens.json` → `motion` |
| CP-14 | Input dialogs | Backdrop tap does **not** dismiss. Typed data survives. Closing with unsaved changes confirms first. | `src/components/Dialog.tsx` |
| CP-15 | Dates | Entry through the shared picker · display in one canonical format · storage always ISO. | `src/lib/dates.ts` |
| CP-16 | Focus | First field focused on dialog open; searchable dropdowns focus their search input. Focus is computable — automated, never eyeballed. | `src/components/Dialog.tsx` |
| CP-17 | Overflowing tab/filter rows | The row **scrolls**. Never capped, never a "More" affordance that hides items behind a lid. | `src/components/TabRow.tsx` |
| CP-18 | Bulk selection | Opt-in mode · scope is the **visible** set · the write shape follows the failure shape (partial failure must be reportable per item). | `src/components/BulkBar.tsx` |
| CP-19 | Visual emphasis | A filled or coloured control is a semantic claim. Peers share one treatment; at most one is primary. | `src/components/BulkBar.tsx` · prose: [docs/04](../04-ARCHITECTURE-AND-DESIGN.md#5-interface-design) |
| CP-20 | Theme-aware assets | CSS-driven variant switching, never JavaScript. One variant carries the alt text. | `src/theme/ThemedImage.tsx` |
| CP-21 | Wide tables | More than **three** columns means the user chooses which columns show and in what order, and the choice **persists**. Reorder with buttons, never drag-only. A column the table is unreadable without is `required` — reorderable, never hideable. `rung: scripts/audits/check-column-control.mjs` (floor: literal `<th>` tables only; dynamic tables are a review item) | `src/components/ColumnControl.tsx` · `src/hooks/useColumnPrefs.ts` |

---

## Adding a row

1. Confirm no existing row covers the concern. Two rows for one concern is the failure this
   register exists to prevent.
2. Write the pattern as a **rule**, not a description: something a reviewer can hold a diff up
   against.
3. Name a **working reference file**. A row with no reference is an opinion.
4. If the row came from an incident, add a sentence saying which — the *why* is what makes
   people follow it six months later.
5. Where a rung exists that enforces the row mechanically, name it: `rung: <path>`.
