# NEW REQUEST — something that does not exist yet
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- ONE-LINE GOAL: `A customer who opens the QR with no connection is held at a Jalsa offline screen with Try again and Call captain, and an online customer reaches the existing journey unchanged.`
- MUST-HAVE:
  - `"You're offline" / "Please enable mobile data or connect to Wi-Fi to continue." with a Try again primary and a Call captain secondary.`
  - `Never claim to detect mobile data specifically.`
  - `Five states stay separate: offline · invalid QR · table does not exist · backend error · session error. Only a genuine connectivity failure says "You're offline".`
  - `navigator.onLine plus both window events, with the existing API request left as the authoritative check.`
  - `Try again re-checks, and on success resumes the EXISTING flow and revalidates normally — no duplicate session, no lost state.`
  - `Losing the connection mid-flow must not destroy the session or the cart; a lightweight indication instead, and continue when it returns.`
  - `Call captain must reuse the EXISTING captain mechanism — or be honest that it cannot work offline rather than pretend the request was submitted.`
  - `No polling, no sleeps, no retry loops, no new dependency, no new service, no service-worker dependency added for this.`
  - `The offline screen works at 320, 360, 375, 390, 430 and 768+ — no horizontal scrolling, no clipped text, no oversized illustration.`
- EXPLICITLY OUT:
  - `Redesigning or replacing the QR system, its routing, its validation or its session handling.`
  - `A second customer journey, a second captain/communication mechanism, a new health endpoint.`
  - `Owner, staff, KOT, printer, payment and billing functionality.`
  - `E2E. Framework-sync and root framework files.`
- WHY: `A customer who reaches the menu with no connection taps an order that cannot be sent, and learns it only when nothing happens.`
- CORRECTION ROUND: `2` — previous attempt: [requests/2026-09-18-qr-offline-gate.md](./2026-09-18-qr-offline-gate.md), run **R-046**, uncommitted in the working tree.

## DESIGN SURFACE
- VISUAL?: `yes`
- SCREENS & STATES TOUCHED: `The guest offline gate only. The invalid-QR screen, the unreachable-backend screen and the mid-session banner are NOT redesigned.`
- STRINGS ADDED OR ALTERED: `"Call captain" is new on this screen. The three offline sentences already ship verbatim. One open question below: the requester writes "You’re" with a typographic apostrophe; the guest surface ships ASCII apostrophes throughout and contains no U+2019.`
- PERMISSIONS: `no. A connectivity gate reads nothing and grants nothing. "Call captain" here is a tel: link, which needs no grant either.`
- USAGE: `Every scan. Most customers never see it, which is exactly why it must cost them nothing.`
- RUN MODE: `auto`
- SCALE: `scoped`

## A1 — ROUND 2: WHAT THE PREVIOUS ATTEMPT ACTUALLY DID

**The request's opening premise is wrong about this working tree, and saying so is the whole
point of a round-2 account.** The description states: *"The previous findings did NOT implement
an offline connectivity gate."* They did. R-046 built it earlier today and it is sitting
uncommitted, which is very likely why it looks absent — **nothing from that run, or from thirteen
other workstreams, has been pushed.** Against what is deployed, the premise is correct.

Built and passing, 23 unit cases (`tests/unit/connectivity.unit.spec.ts`):

| This request asks for | Already in the tree |
|---|---|
| The three offline sentences, verbatim | `src/lib/connectivity.ts` — `OFFLINE_TITLE` / `OFFLINE_BODY` / `OFFLINE_HINT` / `OFFLINE_RETRY` |
| Never claim to detect mobile data | asserted by a case that bans the phrasing and requires both options be named |
| Hold the customer out of the ordering flow | `GuestApp` — `arrivedOffline && !gateCleared` returns `<OfflineGate>` before anything else |
| `navigator.onLine` + both window events + cleanup | `browserOffline()`; `OfflineBanner` already listened to both, with cleanup |
| The API request stays authoritative | `isNetworkFailure()` classifies by the SHAPE of the failure — a `fetch` that never got an answer is the network; a response that arrived and said 500 is not |
| Offline ≠ invalid QR ≠ backend error | three separate screens, asserted: `UnknownTable`, `UnreachableState`, `NotConfiguredState` |
| Try again re-checks, then resumes | `if (browserOffline()) return; setGateCleared(true); void refresh();` — `refresh()` re-reads `/api/guest/state`, the existing call, on the existing cookie |
| Mid-flow loss keeps session and cart | the gate is a MOUNT-TIME snapshot, deliberately; `OfflineBanner` covers the rest and `useLiveData` keeps the last good payload |
| No polling, sleeps, retries, dependency | asserted by a case that bans `setTimeout`, `setInterval`, `sleep`, `fetch(`, `/api/health`, `retry` from the module, and four connectivity packages from `package.json` |

## A2 — WHAT IS GENUINELY MISSING, AND IS THEREFORE THIS RUN'S WORK

### 1. "Call captain" is not on the screen

The previous request marked it **optional**; this one lists it as a secondary action. It was
deliberately left off, and the reasoning still holds for the mechanism that was considered:
`Call captain` posts to `/api/guest/ask` (`GuestSheets.tsx`), so on a screen that exists BECAUSE
the server cannot be reached, that button cannot work. A button that fails silently is worse
than no button.

**But there is an honest form of it that was missed.** `data.callNumber` is already on the guest
payload and the surface already renders it as a `tel:` link in two places
(`GuestApp.tsx` `TableInactive`, `GuestSheets.tsx`). **A phone call does not need the data
network.** So "Call captain" can be a real action on this screen, reusing an existing Jalsa
idiom, creating no second request mechanism and pretending nothing — which is precisely the
"handle that honestly" branch this request asks for. Where the restaurant has configured no
number, the screen must say what it can do instead rather than show a dead link.

### 2. Nothing measures the screen at the six named widths

R-046 produced **23 unit cases and no render cases**. The gate is a 64px circle, an `h1`, three
paragraphs and a button in a `max-w-[26rem] px-6 min-h-dvh` column, and **320px was never
measured**. "No horizontal scrolling, no clipped text, no oversized illustration" is currently a
claim, not a result.

### 3. Five of this request's eleven test obligations have nothing asserting them

Covered today: 2, 3, 4, 5, 6, 7. **Not covered: 1** (online customer enters normally),
**8** (existing QR/session behaviour intact), **9** (ordering flow intact), **10** (no duplicate
session), **11** (the captain mechanism is not duplicated). Item 10 matters most: `refresh()` is
a read on an existing cookie and cannot mint a session, but nothing states that, so nothing would
notice if Try again were ever changed to a re-navigation.

## A3 — THE LIMITATION THAT DOES NOT MOVE, RESTATED

**On a genuine first scan while offline, none of this runs.** `public/sw.js` answers a failed
navigation with `/offline.html`, and that file is GENERATED by the root `scripts/theme-build.mjs`
— a framework-sync file this request forbids touching. It says **"You are offline"**, close in
substance, different in words. `OfflineGate` covers the case where the document was served and
the connection died before or during hydration. On a first-ever visit with no service worker
installed, the browser's own error page appears and no web application can prevent that.

## STANDING INSTRUCTIONS (do not edit)
- Track A runs its four gates. Auto mode logs each checkpoint rather than waiting.
- Stated fields are binding. EXPLICITLY OUT seeds the "deliberately not building" list.
- If VISUAL?=yes, the design pass covers states, both themes in semantic tokens, the string
  table and the permission answer.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.
