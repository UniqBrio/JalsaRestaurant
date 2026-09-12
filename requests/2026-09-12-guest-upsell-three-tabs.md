# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B: /enhance requests/<this-file> -->
<!-- For something that WORKS today but should behave or look different. Broken behaviour is a BUG (REQUEST_BUG.md). -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - Track B's B3 asks about it. -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

> ROUTING NOTE. This ask arrived with `workflows/framework-update.md` attached. It is that
> runbook's **Route C**: a feature request, not a process failure. Route C says to extract only
> the process-level learning and, where there is none, to say so and stop rather than manufacture
> a rule to justify a run. There is none: no gate stayed silent and no track skipped a step. So no
> framework change and no VERSION bump; the ask goes through the normal pipeline as this file.

## FIELDS
- FEATURE / SCREEN: Guest phone → the post-payment-request upsell screen ("One last thing?"), reached after the guest taps Request payment and before the tip and payment steps.
- CURRENT BEHAVIOUR: One flat list of up to three items drawn from Desserts and Drinks together. There are no tabs, no takeaway offer on the screen, and no total on it. **Adding one item navigates the guest straight off the screen to the tip step** — so a second add is impossible, and the "customer adds a dessert, then a drink, then something for home" journey cannot happen. The only bottom action is "No thanks, carry on".
- DESIRED BEHAVIOUR: the requester's full brief, reproduced in the numbered sections below, verbatim where it names copy. In summary: three simultaneously visible upsell options (🍰 Desserts · 🥤 Beverages · ❤️ Share the Love), Desserts selected by default, no horizontal scrolling and no carousel; compact product cards with image, name, short description, price and a one-tap +; adding never navigates away and shows "Added ✓"; the payable total stays visible and updates immediately; a permanently accessible "Pay ₹X" that updates with each addition, plus "No thanks, continue to payment"; additions join the SAME bill on the same table and session, generating the appropriate kitchen round.
- WHY: "Increase additional purchases while keeping the customer journey extremely simple and ensuring that the customer can proceed to payment immediately at any time."
- MUST NOT CHANGE: stated by the requester — the existing Jalsa Restaurant header and table/order context; the table number, bill number and customer session; switching tabs must never reset the cart; previously added items stay in the same bill. Plus everything not named in DESIRED BEHAVIOUR.
- CORRECTION ROUND: 1

## THE REQUESTER'S BRIEF (binding where it names copy)
- HEADER: "One last thing?" · supporting "Your bill is ready. Add a little something before you pay." — "warm, helpful and non-aggressive".
- TABS: 🍰 Desserts · 🥤 Beverages · ❤️ Share the Love, as a prominent three-option segmented navigation, "separate upsell opportunities, not normal menu filters", with "clear Jalsa brand emphasis" on the selected one. All three visible at once. **Explicitly forbidden:** horizontally scrolling tabs, swiping to discover an option, any of the three behind a carousel.
- DESSERTS (default): heading "Something sweet?", 3–4 recommendations. Examples given: Gulab Jamun, Milk Halwa, Royal Falooda, Ice Cream.
- BEVERAGES: heading "Something refreshing?", 3–4 drinks. Examples given: Fresh Lime Soda, Mojito, Cold Coffee, Lassi.
- SHARE THE LOVE: "Do NOT call it 'Takeaway'. Do NOT call it 'Take Your Favorites Home'." Use "Share the Love ❤️" and "Let them enjoy what you loved." Curated Jalsa favourites suitable for taking home — biryani, signature dishes, combos, popular favourites, desserts — with a "Pack for home" or equivalent indicator. "Keep this curated rather than showing the entire restaurant menu."
- CROSS-TAB: Desserts → Beverages → Share the Love, moving freely; every addition stays in the same bill.
- TOTAL: the current payable amount stays visible and updates immediately on each add; a subtle "Added ✓"; no navigation away.
- PAYMENT: primary "Pay ₹1,639", amount updating dynamically; secondary "No thanks, continue to payment"; skippable in one tap.
- VISUAL: Jalsa maroon primary, warm cream/light surfaces, gold/warm accent, premium, mobile-first, touch-friendly; "avoid making it look like a generic e-commerce checkout".
- PRODUCT LOGIC: additions are incorporated into the same final bill and generate the appropriate separate KOT/order round for the kitchen while staying on the same table and bill; the final amount includes additions, applicable discounts/taxes and the separately tracked tip.

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: guest upsell screen — the three tab states, the busy/adding state, and the "this tab has nothing to offer tonight" state (every item in a category can be sold out). The screen's existing withhold-entirely case (upsell feature off, or no offers at all) stays. Loading / error / offline / permission-denied unaffected.
- STRINGS ADDED OR ALTERED: "Your bill is ready. Add a little something before you pay." (replaces "Added as a fresh round — the kitchen still has time."), "Desserts", "Beverages", "Share the Love", "Something sweet?", "Something refreshing?", "Let them enjoy what you loved.", "Added ✓", "Pay {amount}", "No thanks, continue to payment" (replaces "No thanks, carry on"), and a pack-for-home indicator. All are the requester's own words. "One last thing?" is unchanged.
- PERMISSIONS: no — the guest surface, unchanged. The owner's existing `upsell` and `takeaway` feature switches keep their meaning.
- USAGE: once per bill, at the single highest-intent moment in the journey, on a phone, one-handed.
- RUN MODE: auto
- SCALE: scoped

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), run the impact analysis with
  the sibling call-site sweep (B2) BEFORE proposing, produce the plan with regression risks
  (B4) — confirm mode waits for approval; auto mode (default) logs it and applies — touching
  only what DESIRED BEHAVIOUR requires. Every changed line must trace to this request.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list; the plan may add to it,
  never subtract.
- If VISUAL?=yes, the plan carries the correction design pass (B4), scoped to the touched
  area: states, both themes in semantic tokens, the string table, the permission answer.
- CORRECTION ROUND ≥ 2: before proposing anything, read the previous attempt and state what it
  missed and why (B1). If the miss was the process's fault, flag `/framework-update` too.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate. Nothing merges
  without a PASS.

## NOT STATED BY THE REQUESTER — and one stated thing the track must flag rather than silently change
- **Two buttons, one destination.** The brief asks for a primary "Pay ₹X" AND a secondary "No
  thanks, continue to payment". In this application both lead to the same next step: the guest
  never completes payment in the app (the architecture forbids it — a named member of staff
  records the closure), so "Pay" means "go on to the payment step", which is exactly what "No
  thanks, continue to payment" means. Two controls that read as different decisions and do the
  same thing is what Standard 1.5 exists to prevent. **Both are built as asked** — this is the
  requester's screen and their call — and the tension is recorded here rather than resolved
  unilaterally. The cheap alternative, if they want it: keep "Pay ₹X" alone, since it already
  says the amount and already means "carry on".
- **The example item names are examples, not data.** Gulab Jamun, Milk Halwa and Royal Falooda
  are on this menu; Ice Cream, Mojito, Cold Coffee and Lassi may not be. The tabs are therefore
  built from the live menu by category, not from a typed list — a hard-coded list is a screen
  that offers a dish the kitchen does not have.
- **"Beverages" is the tab's label; the menu's category is "Drinks".** Read as a label change on
  this screen only, not a rename of menu data.
- What "Share the Love" should offer when the owner has the takeaway feature switched off:
  `unknown`. Read as: the tab is not shown, because the offer cannot be honoured (Standard 2.4).
- Whether the real-time total should show before or after GST: the brief's figures (₹1,639 →
  ₹1,669) are the payable including GST, matching the amount already on this screen. Read as
  payable, including GST.
- Food photographs: the menu carries none. The placeholder tile added earlier today in
  `2026-09-12-guest-menu-item-thumbnail.md` is what "Food image" resolves to until there are any.
