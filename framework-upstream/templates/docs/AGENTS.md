# AGENTS.md — `<application name>`

> **Read this file before every task in this repository.** These rules are binding and nothing
> in a request overrides them.
>
> Keep it **short and specific**. A file nobody finishes reading is a file nobody follows —
> aim for one page. Everything general lives in the framework documentation; this file is only
> what is true about *this* application.

---

## Architecture guardrails (BINDING)

> Each rule states what it is, **why** it exists, and **where it is honoured in code**. A rule
> with no file reference cannot be checked, and will drift.

### 1. `<rule>`
`<one sentence: what must always/never happen>`
**Why:** `<the incident or property that makes this non-negotiable>`
**Honoured in:** `<file paths>`

### 2. `<rule>`
…

---

## Environments
- Writable by automation: `<name>`
- **Never an automated target:** `<name>`
- Schema changes reach any environment **only** through a migration file.

## Where things live
| | |
|---|---|
| Colour and scale tokens | `design/tokens.json` — **the only file containing a colour** |
| Canonical patterns | `docs/registers/CANONICAL_PATTERNS.md` |
| Root causes | `docs/registers/ROOT_CAUSE_REGISTER.md` |
| Permissions | `docs/registers/RBAC_MATRIX.md` |
| Platform limitations | `docs/registers/KNOWN_LIMITATIONS.md` |
| Shared components | `src/components/` |

## Standing rules
- **Surgical discipline.** State assumptions first. Minimum change for the ask. No drive-by
  refactors. Every changed line traces to the request.
- **Canonical patterns.** One blessed idiom per concern. Read the reference and mirror it. A
  second way is a defect.
- **Semantic tokens only.** No colour literal outside `design/tokens.json`.
- **Both themes, always.** Every screen is verified in both before it is called done.
- **The freeze rule.** Shipped strings are frozen. New features adopt existing terminology.
- **The five permission questions** are answered in the plan, before build.
- **Every backend change is a migration file.** No direct edits, however minor.
- **Verify every dependency before installing.** It exists; it is the intended name; it is pinned.
- **Test files are append-only.** Never overwrite an existing spec.
- **Nothing merges without a PASS from the gate.**

## Definition of done
`checklists/DEFINITION_OF_DONE.md` — every item, or an explicit N/A with a reason.
