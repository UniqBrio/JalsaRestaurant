# CHANGE REQUEST — modify something that ships
<!-- Filled by workflows/request.md (/request) · Consumed by Track B -->

Run **Track B** ([workflows/enhance.md](../workflows/enhance.md)) with this request.

## FIELDS
- FEATURE / SCREEN: captain's "Cancel this item" dialog on the staff surface — the green notice above the reason chips.
- CURRENT BEHAVIOUR: it asserts, in green, "The kitchen has not started this dish. You can cancel it yourself, and it comes off the bill immediately."
- THE REQUESTER'S OBJECTION, verbatim: "How is this identified? I don't see there is an opportunity for captain or owner to get such info from the app. It has to be checked manually."
- DESIRED BEHAVIOUR: 'Replace the string with "Order status needs to be verified before cancelling. Please check with the kitchen to confirm whether preparation has started."'
- WHY: the sentence claims knowledge the application does not have (stated).
- MUST NOT CHANGE: everything not named. The permission rule is untouched — who may cancel, and when it escalates to the owner, is decided by the KOT status exactly as it is today. Only what the screen SAYS changes.
- CORRECTION ROUND: 1
- RUN MODE: auto
- SCALE: micro

## THE REQUESTER IS RIGHT, AND HERE IS THE MECHANISM
`cancelTarget.started` comes from `kitchenHasStarted(kot.status)` — the KOT's own status column,
which a chef advances on the KOTs screen. So the app is not lying, exactly: it knows what the
kitchen last **told** it.

That is a weaker claim than the sentence made. A KOT still reading `new` because nobody has
touched the screen for four minutes is indistinguishable, to this application, from a dish nobody
has picked up — and a captain reading "the kitchen has not started this dish" in green has been
given a fact where the app only had a record. On a busy pass those are different things, and the
one time they differ is the one time it matters.

The permission logic is NOT affected by this and does not change: the status still decides whether
the captain may cancel or must escalate. What changes is that the screen stops presenting a
record as an observation.

## DESIGN SURFACE
- VISUAL?: yes
- SCREENS & STATES TOUCHED: the cancel dialog, not-started state only. The started state ("Cooking has started… this sends a request to Javeed") is unchanged and stays as it is — it makes no claim the app cannot support, because escalation is entirely the app's own doing.
- STRINGS ADDED OR ALTERED: one, the requester's exact sentence.
- PERMISSIONS: no.

## STANDING INSTRUCTIONS (do not edit)
- Track B is SURGICAL: read the actual current files first (B1), impact analysis before proposing
  (B2), plan with regression risks (B4). Every changed line traces to this request.
- MUST NOT CHANGE seeds the plan's "deliberately NOT changing" list.
- Close out with `checklists/DEFINITION_OF_DONE.md`, then the test gate.

## NOT STATED BY THE REQUESTER
- The green tone. A sentence that says "verify before cancelling" is a caution, not a
  confirmation, and green is the colour this application uses for "this is fine". Changed to the
  neutral surface so the colour does not go on making the claim the words just gave up.
- Whether the started-state sentence should soften too: not asked. Left alone — see above.
