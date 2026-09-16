# DESIGN CONTRACT — Jalsa

_Newest first. **Append-only**: never renumber, never backfill, never hard-delete. A superseded
row is marked and kept._

## The four words, and why they are not synonyms

| | |
|---|---|
| **RECORDED** | The difference is written down here. Nothing follows from that. |
| **RESOLVED** | An authority settled which side is right. Still not built. |
| **AUTHORISED** | A person with the standing to decide said to build it. |
| **VERIFIED** | The built thing was **observed** matching the design. Code existing is not observation. |

A row is never VERIFIED because its code exists. `src/components/` held 3,247 lines of unreferenced
components for weeks while every gate read green — that is what "code exists" is worth on its own.

## Source precedence

1. **Current explicit product requirement** — what the owner asks for now.
2. **`Design planning documentation/`** — the original approved design source.
   - For NAVIGATION specifically: `Jalsa Navigation Flowchart.dc.html` is authoritative.
   - `_ds/organic-*` is **NOT** a Jalsa source. See DC-002.
3. **Current implementation** — only where it carries a deliberate correction (SOURCE B).

---

## DC-006 · Print Setup is built — and the routing it edits is now read

**SUPERSEDES DC-004's status**, which is kept below unchanged.

**BUILT** — `src/features/owner/sections/PrintSetupSection.tsx`, the flowchart's five sections:
Overview · Printers · Templates · Routing · History, under Settings → Printers & machines.

The two pieces that carry the design's actual claims are **modules, not components**, and are the
only part of this that can be observed here:

| | |
|---|---|
| `src/lib/print-template.ts` | The character grid. 58 mm and 80 mm are separate layouts; `validateTemplate` **blocks** a save rather than warning. 34 cases. |
| `src/lib/print-routing.ts` | category → station → printer, and the fallback that stops a ticket vanishing. 18 cases. |

**THE ROUTING IS CONSULTED BY THE ORDER PATH.** `queuePrint` was picking the first reachable
machine of the right purpose; it now resolves per category, and `placeRound` passes the
categories it has already read — same query, no extra round trip. Without that, the Routing
section would be a screen configuring nothing, and the only symptom would be tandoor tickets in
the main kitchen, which looks exactly like the fallback working.

**THE PREVIEW IS BUILT FROM THE RESTAURANT'S OWN MENU**, not a specimen round. The question a
template answers is whether *this* menu's longest dish name fits; a fixed sample would pass on a
menu whose longest name is eleven characters longer. With no menu items the panel says the
verdict proves nothing rather than showing green — an empty ticket fits every grid.

**STATUS** — **AUTHORISED** and built. **NOT VERIFIED**: the owner console is data-bearing and
cannot be rendered here, and this adds a fourth unapplied migration. The grid and the routing are
verified by execution; the screen around them has not been seen.

**STILL NOT TRUE, AND SAID ON THE SCREEN** — the TVS machines remain an unvalidated dependency.
Nothing in this deployment opens a socket to one, so no machine is ever marked as answering, and
the Printers panel says so where a person is reading it rather than in a note elsewhere.

**NOT BUILT** — HR documents (offer letter, experience certificate, payslip). Separate row when
they land.

---

## DC-005 · "See the menu while you wait" is not drawn

**SOURCE** — `Jalsa Customer Patterns.dc.html`, pattern 6b: a secondary button on the queue-token
screen offering the menu to a party still standing at the door.

**DECISION** — **Not implemented, deliberately.** A party in the queue has no table, and every
menu screen this application has is assembled from a table's payload (`buildGuestPayload`). The
two available options were a link to a route that does not exist, or a second menu built
table-free — a broken promise, or a second source of truth for the menu. Neither is better than
an absent button.

**STATUS** — **RECORDED.** The button returns when a table-less menu route exists. Until then the
absence is in the code, with this row's number beside it.

---

## DC-004 · Print Setup is a five-section surface and does not exist

**SOURCE** — `Jalsa Navigation Flowchart.dc.html`, "Printing and paperwork": *"Print setup — five
sections: Overview · Printers · Templates · Routing · History."* Three machines — main kitchen and
counter at 80 mm, tandoor at 58 mm. Templates are **character grids**, so the two widths are
separate layouts rather than one scaled picture, and validation blocks a save that would print
clipped. Routing runs category → station → printer, with the food-type split a separate decision.
`Jalsa Print Setup.dc.html` carries the detail. HR documents (offer letter, experience
certificate, payslip) merge from the employment record.

**DECISION** — The app has `printer` and `print_job` tables, a Printers settings panel and
reprint actions. It has **no** template editor, no routing matrix, no print history screen, and
**zero print-related test ids**.

**STATUS** — **RECORDED.** Not resolved, not authorised, not built. Scope decision outstanding.

---

## DC-003 · The muted text colour is deliberately not the design's

**SOURCE** — `#7C736F`, 203 occurrences across the product artboards.

**DECISION** — The app ships `#665D59`. The design value measures **3.78:1** against the cream
ground and fails WCAG AA; `#665D59` measures **5.24:1**. This is a SOURCE B correction and it is
kept. Restoring the design value would be restoring a defect.

**STATUS** — **AUTHORISED** and held. Gate G2 (contrast, all tokens, both themes) executes it on
every run.

**VERIFICATION** — G2 PASS. The rendered result is UNVERIFIED on 20 of 22 screens.

---

## DC-002 · `_ds/organic-*` is document chrome, not the Jalsa theme

**SOURCE** — `Design planning documentation/_ds/organic-e77bc3db…/styles.css`, a complete design
system: `--color-bg: #f5ead8` cream, `--color-accent: #c67139` terracotta, sage second accent,
**Caprasimo + Figtree**, 16px radii. Its readme: *"Organic is warm, rounded and a little
playful."*

**DECISION** — It is the styling of the design-canvas **documents**, not of the Jalsa product.
The brief's §7 names this trap directly: *distinguish document/editor chrome from actual Jalsa
product UI styling.* Adopting it would repaint the product terracotta and replace both typefaces.
**It is not a source for any product token.**

The Jalsa product theme is what the artboards themselves use:

| Role | Design | `design/tokens.json` | |
|---|---|---|---|
| Primary | `#7A1C24` ×207 | `brand.primary.light` `#7A1C24` | **EXACT** |
| Body ink | `#241F1E` ×48 | `text.body.light` `#241F1E` | **EXACT** |
| Muted | `#7C736F` ×203 | `#665D59` | see DC-003 |
| Surfaces | `#FBF8F7` ×79 · `#F1ECEA` ×27 | `#FFFFFF` · `#F4F0EE` | MINOR VARIATION — open |

**STATUS** — **RESOLVED** on precedence. Primary and ink **VERIFIED** by value comparison.
Surfaces RECORDED, not yet reconciled.

---

## DC-001 · Uplift: the design set contradicts itself

**SOURCE A** — `Jalsa Navigation Flowchart.dc.html`, section three: **"Owner — thirteen
sections"**, listing Uplift at the top level — *"Revenue the system itself created — repeat
rounds, upsells, tips, parcels — over the chosen range, with its own export"* — and describing
Reports as four panels under one date range.

**SOURCE B** — `Jalsa Owner Admin.dc.html`, `renderVals()`: a `tabs` array of **twelve**, with
`uplift` inside `repTabs`.

**TIEBREAK EVIDENCE** — `Jalsa_Restaurant_Application_Requirements_and_Scope.docx` does not
mention uplift at all. There is no written brief on either side.

**DECISION** — The brief names the Navigation Flowchart authoritative **for navigation**, and
this is a navigation question. Uplift becomes the **thirteenth top-level section**; Reports keeps
the flowchart's four panels. Gated on `rep.sales` — uplift is a revenue report, and minting
`rep.uplift` would mean a migration for a grant the matrix already expresses.

**STATUS** — **RESOLVED** by precedence, **AUTHORISED**, implemented.

**IMPLEMENTATION** — `src/features/owner/sections/UpliftSection.tsx` ·
`OwnerConsole.tsx` SECTIONS (13 entries, flowchart order) · `ReportsSection.tsx` (4 tabs).

**VERIFICATION** — **NOT VERIFIED.** The owner console is data-bearing and cannot be rendered
here. The section exists and typechecks; nobody has seen it. The figure itself is not computed —
uplift is a comparison over a range and this payload reads today only, so the screen states that
rather than printing arithmetic dressed as an insight.

**NOTE** — The contradiction is not resolved *in the design set*. If the Owner Admin artboards
are later treated as authoritative for navigation, this row is superseded, not deleted.
