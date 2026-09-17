# Design Contract — <application>

> **Copy this into the APPLICATION's repository** (not the framework's) as
> `docs/DESIGN_CONTRACT.md`, fill it from `node scripts/design-ingest.mjs <design-folder>`, and
> keep it current. Gate step **G13** (`scripts/audits/check-design-contract.mjs`) reads it — and
> reads the CODE it points at.
>
> **What this is for.** When a design is *supplied* rather than produced, the implementation's job
> is to build THAT design. This file is the short list of facts that must survive implementation,
> each with the evidence that it did — so that changing one becomes a decision somebody made,
> with a name on it, instead of something that quietly happened.
>
> **Four words that are not synonyms.** RECORDED (it is written here) · RESOLVED (the decision
> is made) · AUTHORISED (someone with authority made it) · VERIFIED (evidence shows it holds).
> A baseline records. It never resolves, authorises or verifies anything.

---

## 1. Source authority

Which artifacts ARE the approved design, and which merely describe or accompany it. Authority is
**declared here**, never inferred from a filename — the folder named like a design system is
routinely the design tool's own document styling, not the product's (§4).

| Artifact | Role | Authority | Notes |
|---|---|---|---|
| _e.g. Navigation Flowchart.html_ | SPECIFICATION | **AUTHORITATIVE** for IA | _the only artifact that states the section count_ |
| _e.g. Owner Admin.html_ | SPECIFICATION | **AUTHORITATIVE** for screens + brand | _rendered mock-ups_ |
| _e.g. _ds/readme.md_ | MEDIUM | **NOT the product design** | _the design tool's stock theme, by its own description_ |
| _e.g. uploads/requirements.docx_ | SUPPORTING | evidence | _extracted; scope baseline_ |

Roles: `SPECIFICATION` (the approved design) · `SUPPORTING` (evidence) · `EXAMPLE` (inspiration,
binds nothing) · `MEDIUM` (the design tool's own presentation layer) · `SUPERSEDED`.

**If authority cannot be established, this section says so and the work stops here.**

## 2. Artifact coverage — evidence, not a claim

Every artifact, its ingestion class from `design-ingest` (A parsed · B partial · C unsupported ·
D needs extraction · E needs visual inspection · F duplicate · G unreferenced input · H generated),
and **what was extracted**. "Reviewed" is not an entry. A class-E artifact is closed by a named
person writing what they saw.

| Artifact | Class | Extracted |
|---|---|---|
| _Navigation Flowchart.html_ | A | _4 role surfaces; owner = 13 sections (named); settings = 10 (named)_ |
| _assets/logo.png_ | E | _seen by <who> <date>: wordmark, maroon on cream_ |
| _uploads/pasted-*.png (53)_ | G | _input material, referenced by no design page — not implemented from_ |

## 3. Application identity and structure

- **Product name / identity:**
- **Roles / personas:**
- **Surfaces (apps):**
- **Navigation:** the top-level sections, **by name and count**, per role.

## 4. Visual identity

- **Brand colour (canonical hex):** `#______` ← G13 compares this against `design/tokens.json`
- **Where that was established:** _which artifact, and why it beats the alternative_
- **Logo asset:**
- **Typography:**
- **Surfaces / theme character:**

## 5. MUST PRESERVE

Material design decisions, each **traceable end to end**: where it came from, what was decided,
where it is implemented, how that was verified. Changing one requires a row in §8 — never silence.

| # | Decision | Source | Status | Evidence | Verified by |
|---|---|---|---|---|---|
| 1 | _Owner navigation: 13 named sections_ | _Navigation Flowchart_ | `unresolved` | | |
| 2 | _Nav: Live orders_ | _Navigation Flowchart_ | `implemented` | `route:/live-orders; text:"Live orders"` | `spec:tests/functional/nav.spec.ts` |
| 3 | _Tips section_ | _Navigation Flowchart_ | `deferred` | `owner: A. Owner — phase 2, decision 2026-09-13` | |
| 4 | _Logo in header_ | _assets/logo.png_ | `implemented` | `file:public/brand/logo.png; manual: R. Dev 13-Sep-2026` | `gate:G3` |

**Status** — `implemented` · `deferred` · `changed` · `blocked` · `unresolved`. Blank blocks.
`unresolved` blocks — recorded is not resolved. `deferred`/`blocked` need an **owner** in
Evidence. `changed` needs a row in §8.

**Evidence** — for `implemented`, references G13 **resolves against the code**; a reference that
does not resolve makes the row MISSING and blocks:
`file:<path>` · `route:<path>` · `testid:<id>` · `text:"<label>"` · `spec:<path>` ·
`manual:<who> <date>`. Join several with `;`. Append `~ <area>: <what>` to declare a variance:
if `<area>` is named in §6 it is an IMPLEMENTATION DETAIL, otherwise a MINOR VARIATION (recorded).

**Verified by** — `spec:<path>` · `gate:<Gn>` · `manual:<who> <date>` · `pending` (recorded,
not blocking). Blank on an implemented row blocks.

## 6. Implementation flexibility

The areas the design **cedes** to the implementer, by name — these are what make a declared
variance an implementation detail rather than drift: component architecture · file organisation
· state management · API shape · internal abstractions · performance work · build tooling.

## 7. Interaction and content

Key interaction patterns, states, responsive requirements, and the terminology the design fixes.
Terminology goes to `PRODUCT_LEXICON`; this section points at it.

## 8. Recorded design changes

A departure from §5, with authority. An empty table is the normal case.

| Decision changed | To what | Why | Authorised by | Date |
|---|---|---|---|---|

## 9. Unknown / unresolved / conflicting

What could not be established, what two sources disagree about, and who decides. **A CONFLICT or
ASSERTION row blocks until `resolved`, and `resolved` requires Precedence** — which source wins,
decided on authority · scope · freshness · provenance · evidence, never on preference or frequency.

| Item | Kind | Sources | Owner | Precedence | Status |
|---|---|---|---|---|---|
| _brand colour_ | CONFLICT | _screens: X (219x, 6/6 pages); _ds stylesheet: Y_ | _design owner_ | _screens — scope: product; the stylesheet is the medium by its own readme_ | _resolved 2026-09-13_ |
| _section count_ | ASSERTION | _brief: 12; Navigation Flowchart: 13, named_ | _design owner_ | | _open_ |
| _Kitchen surface_ | UNKNOWN | _named as a role; no screen artifact_ | _design owner_ | | _open_ |

Kinds: `CONFLICT` (two artifacts) · `ASSERTION` (requester vs artifact) · `UNKNOWN` · `NOT-INSPECTED`.
