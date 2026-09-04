# Design Rules

> Design lessons promoted into rules with IDs — so the third occurrence of a design mistake
> is prevented by process, not memory. Read at every design run
> ([docs/24 §1](../24-DESIGN-PLANNING.md), inspect-first step 1).
>
> **Append-only.** Newest first. Never renumber, never hard-delete; a superseded rule is
> struck through with a date and kept. IDs `DR-<n>`, never reused.
>
> **Every row names its enforcement rung as a path** — an executable check, or the checklist
> item that carries it — or declares itself prose-only, honestly.
> `scripts/audits/check-rule-coverage.mjs` parses this file and counts the answers; a new
> prose-only rule is a ratchet violation to take *knowingly*, not by accident.
>
> **How a row gets here:** a design correction the requester makes twice is a candidate
> (`workflows/promote.md` → `CANDIDATES.md`); promoted, it lands as a row via
> `/framework-update`. A one-off preference stays in that app's own rules — this register
> holds only lessons that generalise.

| ID | Rule | Rung | Origin |
|---|---|---|---|
| *(no rows yet — the register is armed, and the first promoted design lesson lands here)* | | | |
