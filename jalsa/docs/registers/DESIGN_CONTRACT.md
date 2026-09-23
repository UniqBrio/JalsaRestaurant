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

## DC-013 · "Printers" is a fourteenth top-level section; the flowchart files printing under Settings

**SOURCE** — `Jalsa Navigation Flowchart.dc.html` puts print setup under Settings, where
**Settings → Printers & machines** still is. `Jalsa Print Setup.dc.html` draws no computer, no
pairing and no installer: nothing in the design set describes how a thermal printer comes to be
reachable at all.

**DIFFERENCE** — 23-Sep-2026: a top-level **Printers** section (grant `set.printer`, the same as
the settings panel) that fronts the owner's journey — connect the computer, choose the printer,
assign the station, Test Print — and reaches the existing five-section Print setup through
*Manage*. The Dashboard shows a one-line nudge to it until a computer is connected.

**WHY** — the owner's explicit product decision for this change: "bridge" is an implementation
concept; the owner is setting up a printer, and the entry point must be Dashboard → Printers, not
a technical area three levels down. Same precedent as Uplift (the thirteenth section).

**STATUS** — AUTHORISED (owner directive, 23-Sep-2026). Not VERIFIED: the screen has not been
observed against a real printing computer (KL-7). Strings on it are new and adopt the console's
existing terminology (Test print, Printers & machines, station).

## DC-012 · The kitchen ticket carries its station, and the artboards do not show one

**SOURCE** — `src/lib/print-routing.ts`, in its own words: *"The station the ticket was MEANT for,
not the one it came out at. A tandoor ticket on the main kitchen machine has to say TANDOOR or the
wrong cook picks it up."* Routing has carried `station` on every decision since Phase 1 and
`print_job.station` has snapshotted it since the 19-Sep-2026 migration.

**IMPLEMENTATION (before 22-Sep-2026)** — `TicketData` had no `station` member, `KOT_FIELDS` had
no `station` key, and `buildKot` had no case for one. The value was carried the whole way and
dropped at the last step. A fallback ticket printed at the main-kitchen machine was byte-identical
to a main-kitchen ticket, so the mechanism cost everything and delivered nothing.

**THE DESIGN SET** — the KOT artboards show no station line. This is therefore a divergence, added
in the design's own idiom (a `leftRight` row in the Order band, the same shape as TABLE and BILL
NO), not a new pattern.

**DECIDED** — the field prints **by default**. Shipping it switched off would leave the divergence
recorded and the defect shipped. `DEFAULT_OFF.kot` deliberately omits `'station'`, and the reason
is written at that line.

**NEW VISIBLE STRING** — `STATION`, in the existing all-caps label idiom (`TABLE`, `BILL NO`,
`CAPTAIN`, `DATE`, `TIME`). Adopts existing terminology rather than introducing a synonym, per the
freeze rule. Weight `bold` — an existing weight in the template vocabulary, chosen because a
ticket that looks like every other ticket is the failure this field exists to prevent.

**STATUS** — AUTHORISED (22-Sep-2026) and built. **NOT VERIFIED**: no physical ticket has been
observed. Verification is Gate 7, on the RP3160. The byte-level change is pinned in
`tests/unit/ticket-golden.unit.spec.ts` (Golden A vs Golden B) — 39 bytes at 58 mm, 55 at 80 mm,
one line each, with a rung asserting nothing else moved.

---

## DC-011 · Separating a table: the fourth group case, and what perTable was worth

**SOURCE** — `Jalsa Product Plan.dc.html`, the group-bill section: *"Four cases have to be
designed, not discovered: joining a table that already has an open bill …; **removing a table
mid-service (its lines move to a fresh bill)**; a latecomer scanning a table nobody has added
yet; and two tables requesting payment at the same time on one bill."*

**WHAT WAS THERE** — three of the four. The second was not built, and the hole it left was a
party of four who joined a table of eight, ate, and wanted to pay separately: the only route was
closing one bill for everybody and settling it by hand at the counter.

Also found: `perTable` — what each table on a group bill ate — has been computed on every payload
since the beginning and **rendered nowhere**. A host could see one total across four tables and
had no way to see the four.

**BUILT** — `billSeparability()` in `status.ts` (the predicate, 11 cases) ·
`detachTableFromBill()` · the per-table breakdown with a Separate action beside each row.

**THE ROUNDS MOVE; NOTHING IS APPORTIONED.** Every KOT already carries `table_id`, so "what did
this table eat" is a `where` clause rather than a division — and the two bills afterwards add up
to what the one bill was, line for line. This is deliberately **not** a split-by-amount feature:
a figure that corresponds to nothing anybody ordered is an argument at the counter about
arithmetic nobody can check.

**A TIP STAYS WITH ITS BILL.** A tip is one guest's decision about one total and there is no
honest way to divide it. The audit entry says so in the same sentence as the move.

**STATUS** — **AUTHORISED** and built. **NOT VERIFIED** — data-bearing. The predicate is verified
by execution; the move has never been run against a database.

**STILL NOT BUILT** — case one, *"joining a table that already has an open bill (its lines merge
in, and the merge is logged)"*. `joinTableToBill` **refuses** with a named reason instead of
merging. That is safe and is stated on screen, but it is not what the plan asks for. Recorded
here rather than quietly counted as done.

---

## DC-010 · The design set contradicts itself about the visual system too

**SOURCE A** — `Jalsa Product Plan.dc.html`, twice, in its own words: *"Visual system: **Organic**
— cream ground, terracotta accent, sage second accent, **Caprasimo over Figtree**, pill controls,
16px radii"*, and later *"Organic applied restaurant-side: cream ground, terracotta for primary
actions and totals, sage for confirmed and served states …"*

**SOURCE B** — the artboards themselves. `#7A1C24` maroon ×207, `#241F1E` ink ×48, Poppins and
Noto. Not one terracotta primary, not one Caprasimo heading.

**THIS CORRECTS DC-002's REASONING, AND LEAVES ITS DECISION STANDING.** DC-002 called
`_ds/organic-*` "document chrome, not a source for any product token". The first half of that is
now known to be wrong: Organic was *intended* as the product's visual system, by the plan that
preceded the artboards. It is not merely the styling of the canvas documents.

**DECISION UNCHANGED, ON BETTER GROUNDS.** The artboards are the drawn screens, and this
repository's own `CLAUDE.md` says what the specification is: *"33 screens across 4 surfaces."* A
plan naming a starting palette that the screens then departed from is superseded **by the
screens**. The brand mark is maroon and is md5-identical to the design's own file; the guest
surface has shipped maroon throughout. Repainting the product terracotta and swapping both
typefaces on the strength of a planning paragraph the artboards overrode would be a rebrand, not
an alignment.

**STATUS** — **RESOLVED** by precedence. The contradiction is **not** resolved *in the design
set*, and this row exists so nobody re-derives DC-002's weaker argument and reaches a different
answer.

---

## DC-009 · The warm neutrals: one token, and it is one the design uses

**SOURCE** — counted across the three product artboards: `#FFF` ×121 · `#FBF8F7` ×52 ·
`#F1ECEA` ×20 · `#F4F0EE` ×11.

**WHAT DC-002 RECORDED** — surfaces as a "MINOR VARIATION — open", on the reading that the design
used `#FBF8F7`/`#F1ECEA` where the app uses `#FFFFFF`/`#F4F0EE`. The fuller count above changes
the picture:

- The card surface `#FFFFFF` is **exact**: `#FFF` is the design's most-used colour by a wide
  margin, and it is what cards are drawn on.
- `#FBF8F7`, `#F1ECEA` and `#F4F0EE` are all **inset rows inside cards** — three near-identical
  warm greys used interchangeably in one artboard set.

**DECISION** — one `surfaceSunken` token, and its value `#F4F0EE` is one of the three the design
itself uses. Collapsing three interchangeable greys into one semantic token is what a token
system is for; restoring three would mean three tokens with no semantic difference between them,
which is the second-way-to-do-one-thing this repository treats as a defect.

**STATUS** — **RESOLVED**, and DC-002's surface row is closed rather than left open. Gate G2
(contrast, all tokens, both themes) executes it on every run.

---

## DC-008 · Reports now have the one date range the flowchart asks for

**SOURCE** — `Jalsa Navigation Flowchart.dc.html`, section three: *"Sales, purchases and expenses,
final report, all-orders ledger. **One date range governs every panel**; each exports."*

**WHAT WAS THERE** — four tabs reading `data.closedToday`, and a Final report tab carrying an
honest empty state: *"a range control that silently only ever meant today would be worse than
none."* That was true. It is now obsolete and is gone.

**BUILT** — `src/lib/report-range.ts` (presets, validation, the roll-up — 21 cases) ·
`/api/owner/report` (ranged read, gated on `rep.sales`) · `ReportsSection` rewritten with the
range **above** the tabs.

Three decisions worth the row:

- **The range is not a property of a panel.** Four ranges is four answers to "how did last week
  go", and somebody subtracts one panel's purchases from another's sales.
- **Reversed dates are refused, not swapped.** A swap hands back a correct-looking report for a
  question nobody asked.
- **The net excludes tips on both sides.** A tip is the staff's money. `money.ts` refuses the
  conflation by having no field called "total", and this refuses it the same way.

**WHY ITS OWN ENDPOINT** — the console payload is polled every few seconds. A thirty-day range is
thousands of bills with their rounds; on the poll, every screen pays for a report nobody opened.

**STATUS** — **AUTHORISED** and built. **NOT VERIFIED** — data-bearing, and no range has been
read against a database here.

---

## DC-007 · HR documents are built, and the employment columns are finally read

**SOURCE** — `Jalsa Navigation Flowchart.dc.html`, section six: *"Staff record → Offer letter ·
Experience certificate · Payslip. Variables merge from the employment record and the restaurant
identity. **Anything unfilled prints as a marked placeholder so nothing is signed blank.**"*
`Jalsa HR Documents.dc.html` carries the three documents' full text.

**WHAT WAS THERE** — nine employment columns in the core schema, added under a comment naming the
HR documents as their reason, and **read and written by nothing**. Every one had held its default
since the first migration. Same shape as the reply box that wrote to a column no screen read: a
field that exists, looks maintained, and is empty in every row.

**BUILT** — `src/lib/hr-documents.ts` (the merge, rupees-in-words, payslip arithmetic, readiness
— 27 cases) · `StaffPaperwork.tsx`, opened from the person's own row · migration
`20260916120000` for the last five columns and the `staff.paperwork` grant.

Four decisions worth the row:

- **A blank is `[MONTHLY SALARY]`, never an empty string.** Two of these three get signed by the
  employee; "a gross monthly salary of  ," reads as a typo and is a blank cheque.
- **`staff.paperwork` is separate from `staff.create`.** Fixing a spelling in a waiter's name is
  not the same act as reading what the senior captain is paid.
- **Only the last four digits of the bank account are stored.** The payslip prints
  `XXXX XXXX 5093`; the whole number is a credential nothing here can use.
- **An unrecorded gender takes they/them.** A certificate is handed to a future employer, and one
  that misgenders its subject is worse than one that reads a little formally.

**STATUS** — **AUTHORISED** and built. **NOT VERIFIED** — data-bearing. The merge and the
arithmetic are verified by execution; the screen has not been seen.

**NOT BUILT** — printing goes through the browser, which is what the design's own "Print or save
as PDF" does. These do not go to the thermal machines: a letter on 80 mm till roll is not a
letter.

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

**STATUS** — **RESOLVED**, 19-Sep-2026. Recorded here rather than rewritten, because the register
is append-only and what the entry got wrong is itself the finding.

The decision above went stale without anybody noticing: the template editor, the routing matrix,
the history screen and the `owner-print-*` test ids all shipped in
`20260916110000_jalsa_print_setup`, and this entry still read **"Not resolved, not authorised, not
built"** three days later. An entry that describes a gap which has since been filled is worse than
no entry — it is read as current, and a reader plans around a shortfall that is not there.

Phase 1 (19-Sep-2026) closed the part that really was missing, which this entry never named: the
routing screen configured a decision the order path took differently, and a retry re-took it from
scratch. See `docs/modules/printing.md`.

**Still outstanding, and genuinely so:** the physical transport (KL-2), and what two machines
claiming one category is supposed to mean — recorded as an ambiguity in the module document rather
than guessed at.

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
