# BUG REQUEST — something that ships is broken
<!-- Filled by workflows/request.md (/request) · Consumed by Track C: /bug requests/<this-file> -->

Run **Track C** ([workflows/bug.md](../workflows/bug.md)) with this request.

## FIELDS
- WHAT HAPPENS: "For adding an item, it is taking time. Find the root cause and fix it. The order should be added immediately."
- WHO IS AFFECTED: a guest adding items on the menu screen. Selectivity beyond that: `unknown`.
- WHERE: guest phone → menu screen, the `+` on a dish row and the − / qty / + stepper once something is in the cart, plus the "Review order" bar at the bottom.
- WAS IT WORKING BEFORE?: `unknown` — not stated.
- REPRO STEPS: `unknown` as stated, but the two screenshots are the repro and the evidence. In the first, "Chicken Biryani added" and "Mutton Shuka added" are BOTH still on screen as toasts while the bar reads "2 items · ₹200" — two confirmations queued up behind a bar that has only just caught up. In the second, "Chicken Tawa Masala added" is showing while the bar reads "3 items · ₹460". The confirmations are arriving in a batch after the fact rather than one per tap, at the moment of the tap.
- ERROR WORDING: none — this is latency, not an error.
- CORRECTION ROUND: 1 (of this symptom on this screen; the same CLASS was fixed on the tip screen earlier today, `2026-09-12-tip-latency.md`, and this is the half that fix did not reach)
- RUN MODE: auto
- SCALE: scoped

## STANDING INSTRUCTIONS (do not edit)
- Track C finds the ROOT CAUSE before proposing a fix, and states it in one sentence.
- The fix is the minimum change that removes the cause, not the symptom.
- A regression rung is added for the cause, not for the report.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## ROOT CAUSE (Track C's first stop, stated from reading the code)
**The menu screen is a pure function of server state, so nothing on it can move until the
server answers — and while it waits, every control on the screen is switched off.**

Three things compound, in `src/features/guest/GuestOrdering.tsx`:

1. `setQty` calls `runBusy`, which sets `busy = true` for the whole write. Every `+`, every
   stepper and every "Sold out" row on the screen takes `disabled={busy}`, so ONE tap disables
   all fifty-seven rows until the round trip completes.
2. `runBusy` opens with `if (busy) return;` — so a second tap during that window is **silently
   dropped**. Not queued, not refused out loud. Dropped. That is why the confirmations in the
   screenshots arrive in a clump: the taps that survived are the ones that happened to land
   between round trips.
3. The quantity on screen is `item.inCart`, which comes from the server payload. Even with the
   write now answering with the new state (one round trip rather than three, shipped earlier
   today), the number under the guest's thumb cannot change until Hosur → Vercel → Supabase
   ap-southeast-2 → back has completed.

The earlier fix made the round trip shorter. It could not make it instant, and "immediately" is
what was asked for. Nothing short of the phone showing its own intention before the server
confirms it will do that.

## NOT STATED BY THE REQUESTER
- What should happen if the write then FAILS: `unknown`. The honest answer is the only safe one
  — put the row back to what the server says and say so, rather than leave a phantom item on a
  bill. A silent optimistic update that never reconciles is a guest charged for something they
  did not order, which is far worse than the wait being fixed.
- Whether the money in the bar must also be instant: not stated. The per-dish arithmetic on the
  order-review screen already happens on the phone and becomes instant with this fix; the
  running SUBTOTAL in the menu bar stays server-derived, because this application deliberately
  keeps every rupee of pricing on the server (CLAUDE.md). It is also hidden behind the tick box
  by default as of this morning.
