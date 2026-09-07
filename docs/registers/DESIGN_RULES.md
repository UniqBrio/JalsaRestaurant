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
| DR-2 | **A session ends when the user says so.** A signed-in session survives reload, navigation and backgrounding; it ends on explicit sign out, or on a security event the user is told about. This holds for JWT and username/password alike — a token that expires silently mid-task is indistinguishable, to the user, from the application losing their work. Sign out **confirms first** and sits under the overflow menu, isolated from daily actions. | Prose + the `COMPONENT_LIBRARY` Session rows; the confirm half is `starter/src/components/ConfirmDialog.tsx` | Owner directive, 06-Sep-2026 |
| DR-1 | **Sentence case for every visible string**, table cells included: capitalise the first letter and **leave the rest exactly as written** — lowercasing the tail turns "WhatsApp", "PDF" and every customer name into a typo. `rung: starter/tests/unit/text-format.unit.spec.ts` covers the utility; the rule over arbitrary strings is a **review** item on the copy pass — honest debt, because a scanner cannot tell a label from a code string. | `starter/src/lib/text-format.ts` + copy-gate review | Owner directive, 06-Sep-2026 |
