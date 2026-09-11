# NEW FEATURE REQUEST
<!-- Filled by workflows/request.md (/request) · Consumed by Track A: /feature requests/<this-file> -->
<!-- Stated fields are BINDING. "unknown" is honest and welcome - the Gate 1 questionnaire covers it. -->

Run **Track A** ([workflows/feature.md](../../workflows/feature.md)) with this request.

## FIELDS
- FEATURE NAME: `<short name>`
- ONE-LINE GOAL: `<what the user can do after this ships>`
- WHO USES IT: `<roles — or unknown>`
- MUST-HAVE in v1: `<2–5 bullets — the non-negotiables; if the requester signalled no priority, everything lands here with "requester to trim at Gate 1">`
- EXPLICITLY OUT of v1: `<what NOT to build now — or unknown>`
- KNOWN CONSTRAINTS: `<timing / platform / budget notes — or none stated>`
- MARKET / REGION: `<where the users are, if stated — feeds the advisor pass's regional, legal and cultural lenses; or unknown>`
- RUN MODE: `<auto (default: gates 1–4 are logged checkpoints) | confirm (each gate waits)>`

## USAGE PROFILE
<!-- The machine-interpretable half of the requirement: these facts DRIVE the UI (docs/24 s3b).
     Fill from the customer's words only; every unknown becomes a Gate 1 question. A feature
     described without its usage profile gets a UI designed for an imaginary user. -->
- PRIMARY OBJECTIVE: `<the ONE thing the user comes here to accomplish — one sentence>`
- PRIMARY WORKFLOW: `<entry → steps → done, in the customer's words — or unknown>`
- FREQUENCY OF USE: `<many times a day / daily / weekly / rarely — per user type if stated>`
- OPERATING ENVIRONMENT: `<device, network, physical context (desk / phone in hand / front counter) — or unknown>`
- ESSENTIAL INFO (visible immediately): `<what the user must see without any interaction>`
- OPTIONAL INFO (progressively disclosed): `<useful sometimes — behind expand / click / context>`
- FREQUENT ACTIONS (immediate access): `<done constantly — one interaction, keyboard-first>`
- OCCASIONAL ACTIONS (secondary access): `<done sometimes — never a peer of the frequent ones>`
- AUTOMATE (no interaction wanted): `<what the system should just do — a field that can be derived is a field that is eliminated>`
- MUST STAY MANUAL: `<decisions the customer explicitly wants a human to make>`

## DESIGN SURFACE
<!-- A new feature is always visual unless it is a pure API/background capability - say which. -->
- SCREENS / ENTRY POINTS: `<where it lives and how it is reached — or unknown>`
- STATES REQUESTER CARES ABOUT: `<anything stated about empty/error/loading behaviour — or unknown; the full state set is a Track A obligation (A3.3) regardless>`
- VISIBLE STRINGS STATED: `<any exact wording the requester used for labels/messages — quoted verbatim, or none>`

## STANDING INSTRUCTIONS (do not edit)
- Follow Track A end-to-end: Gate 1 questions → Gate 2 feasibility → Gate 3 design → Gate 4
  plan → build → test gate. **Confirm mode stops at every gate; auto mode (default) logs each
  checkpoint's decisions to the ASSUMPTIONS ledger and proceeds — hard stops and the
  mechanical test gate bind in every mode.**
- Anything stated in FIELDS is binding and overrides assumptions; every `unknown` becomes a
  Gate 1 question with a reasoned recommendation — never a silent assumption.
- Ground first (Step 0): `CLAUDE.md`, `docs/registers/KNOWN_LIMITATIONS.md`,
  `docs/registers/CANONICAL_PATTERNS.md`, `docs/registers/ROOT_CAUSE_REGISTER.md`.
- The USAGE PROFILE is the information hierarchy: essential/frequent renders on the primary
  screen with the primary action immediately reachable; optional/occasional is progressively
  disclosed; automatable steps are eliminated, not rendered. The design translates it via
  docs/24 §3b — never invents what it does not state.
- **No application scaffolded yet (NEW-APP)?** Initialization runs first —
  `docs/02-PROJECT-INITIALIZATION.md`, `npm run new:app` — then this file moves into the new
  app's `requests/` and Track A runs **inside the new app**, scoped to the first shippable
  slice named above.

## EXAMPLE (filled)
- FEATURE NAME: Saved filters
- ONE-LINE GOAL: Users save a filter combination on the records list and reapply it in one action.
- WHO USES IT: unknown (requester said "users")
- MUST-HAVE in v1: save current filters under a name; apply a saved filter; delete one — requester to trim at Gate 1
- EXPLICITLY OUT of v1: unknown
- KNOWN CONSTRAINTS: none stated
- SCREENS / ENTRY POINTS: records list toolbar (stated); management of saved filters — unknown
- STATES REQUESTER CARES ABOUT: unknown
- VISIBLE STRINGS STATED: "Save this view" (requester's words for the button)
