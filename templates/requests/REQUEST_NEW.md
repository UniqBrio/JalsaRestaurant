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

## DESIGN SURFACE
<!-- A new feature is always visual unless it is a pure API/background capability - say which. -->
- SCREENS / ENTRY POINTS: `<where it lives and how it is reached — or unknown>`
- STATES REQUESTER CARES ABOUT: `<anything stated about empty/error/loading behaviour — or unknown; the full state set is a Track A obligation (A3.3) regardless>`
- VISIBLE STRINGS STATED: `<any exact wording the requester used for labels/messages — quoted verbatim, or none>`

## STANDING INSTRUCTIONS (do not edit)
- Follow Track A end-to-end: Gate 1 questions → Gate 2 feasibility → Gate 3 design → Gate 4
  plan → build → test gate. **Stop at every gate.**
- Anything stated in FIELDS is binding and overrides assumptions; every `unknown` becomes a
  Gate 1 question with a reasoned recommendation — never a silent assumption.
- Ground first (Step 0): `CLAUDE.md`, `docs/registers/KNOWN_LIMITATIONS.md`,
  `docs/registers/CANONICAL_PATTERNS.md`, `docs/registers/ROOT_CAUSE_REGISTER.md`.

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
