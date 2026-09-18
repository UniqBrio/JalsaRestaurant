# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: `A customer who scans the QR with no connection is held at a Jalsa-branded offline screen with Try again and, where the captain mechanism is available, Call captain — and an online customer reaches the existing journey unchanged.`
- MUST-HAVE:
  - `Jalsa logo/icon on the offline screen — it must feel like the application, not a browser error page.`
  - `"You're offline" / "Please enable mobile data or connect to Wi-Fi to continue." / [Try again] / [Call captain].`
  - `"Call captain" is shown WHERE THE EXISTING CAPTAIN REQUEST MECHANISM IS AVAILABLE — and must never falsely claim a request was submitted.`
  - `Never claim to detect mobile data specifically.`
  - `Five states stay separate: offline · invalid QR · unknown table · server/API error · session error.`
  - `navigator.onLine plus both window events, and NOT relied on alone where an existing API request can establish real reachability.`
  - `Try again re-checks; still offline stays put; online resumes and revalidates — no duplicate sessions AND NO DUPLICATE BILLS.`
  - `Connection lost after entering must not destroy the session or clear the cart.`
  - `No third-party library, plugin, native dependency, polling, delay, sleep/retry loop or new endpoint.`
  - `320, 360, 375, 390, 430, 768+ — no horizontal overflow, no clipped content, no heavy images or animations.`
- EXPLICITLY OUT:
  - `Redoing the QR architecture. The combobox work. The heard_about migration. Unrelated customer ordering functionality.`
  - `A second route, a second customer flow, a second request/communication system.`
  - `E2E. Framework-sync and root framework files.`
- WHY: `A customer who reaches the menu with no connection taps an order that cannot be sent, and learns it only when nothing happens.`
- CORRECTION ROUND: `3` — previous attempts: [2026-09-18-qr-offline-gate.md](./2026-09-18-qr-offline-gate.md) (R-046) and [2026-09-18-qr-connectivity-gate-round2.md](./2026-09-18-qr-connectivity-gate-round2.md) (R-048). Both uncommitted.

## DESIGN SURFACE
- VISUAL?: `yes`
- SCREENS & STATES TOUCHED: `The guest offline gate only.`
- STRINGS ADDED OR ALTERED: `None new. The screen's wording already ships verbatim.`
- PERMISSIONS: `no. Reads nothing, grants nothing. The new condition READS the owner's existing callCaptain switch; it does not add one.`
- USAGE: `Every scan. Most customers never see it.`
- RUN MODE: `auto`
- SCALE: `micro`

## A1 — ROUND 3: THE LOOP ITSELF IS NOW THE FINDING

This requirement has been submitted three times. It has been built twice.

| Round | Run | What it delivered | Where it is |
|---|---|---|---|
| 1 | R-046 | `connectivity.ts`, `OfflineGate`, the mount-time gate in `GuestApp`, the `useLiveData` classifier, 23 unit cases | **uncommitted** |
| 2 | R-048 | `Call captain` as a `tel:` action, 42 render cases at all six widths, 12 computed-contrast cases, the five previously-unasserted obligations | **uncommitted** |
| 3 | this run | three genuine deltas, below | **uncommitted unless instructed otherwise** |

**The requester is not wrong.** Each round reports the gate as absent, and against anything they
can look at, it is: `HEAD` carries one pushed commit from today (`c76012f`, staff tabs) and
production runs `8de0da7`. **Fifteen workstreams, including both previous rounds of this one, exist
only in an ephemeral container.** Every request in the series ends with `Do NOT commit or push`,
which has been honoured — so the work cannot reach a review, the review reports it missing, and the
request returns. That is the loop, and no amount of building inside it will close it. It is raised
to the requester rather than resolved unilaterally, because the instruction not to push is theirs.

## A2 — WHAT IS GENUINELY NEW IN THIS SUBMISSION

Three clauses appear here that the previous two did not carry. These are the run's actual work.

### 1. "Jalsa logo/icon" — the DESIGN section now names it

The screen currently opens with a `⚡` glyph in a circle. The request asks for the Jalsa mark.
`/brand/jalsa-badge.png` is the token-declared brand mark (`design/tokens.json`) and the surface
already renders remote logos through an `<img>` idiom (`GuestQueue`, `GuestClosure`).

**Which image matters here, and the evidence decides it.** `public/sw.js` caches `/brand/*`
**cache-first with runtime fill**, so the badge is in the cache after any earlier visit — while an
owner-uploaded `logo_url` points at a remote host that by definition cannot be reached from this
screen. Using `data.logoUrl` here would put a broken image on the one screen that must not look
broken. The local badge is used instead, inside a container that still reads as deliberate if the
image is ever missing.

### 2. "Where the existing Captain request mechanism is available"

Round 2 showed the action whenever a phone number was configured. This request conditions it on the
**captain mechanism's availability**, which in this application is the owner's `callCaptain`
feature switch (`src/lib/guest-features.ts`, honoured in `GuestSheets`). An owner who has switched
Call captain off should not meet it here.

### 3. "No duplicate sessions AND NO DUPLICATE BILLS"

Round 2 asserted no duplicate session on Try again. "Bills" is new wording and gets its own case:
a bill is opened by a write, and the retry path performs a read.

## A3 — WHAT IS ALREADY BUILT AND IS NOT REBUILT

Everything else in this request. The eleven test obligations are covered by R-046 and R-048
(`tests/unit/connectivity.unit.spec.ts`, 33 cases; `tests/render/offline-gate.render.spec.ts`,
42 cases). Rebuilding them would be the third construction of the same thing.

## A4 — THE LIMITATION THAT STILL DOES NOT MOVE

**On a genuine first scan while offline, none of this runs.** `public/sw.js` answers a failed
navigation with `/offline.html`, GENERATED by the root `scripts/theme-build.mjs` — a framework-sync
file this request forbids touching. It says **"You are offline"**. `OfflineGate` covers the case
where the document was served and the connection died before or during hydration.

## STANDING INSTRUCTIONS (do not edit)
- Track A runs its four gates. Auto mode logs each checkpoint rather than waiting.
- Stated fields are binding. EXPLICITLY OUT seeds the "deliberately not building" list.
- If VISUAL?=yes, the design pass covers states, both themes in semantic tokens, the string
  table and the permission answer.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.
