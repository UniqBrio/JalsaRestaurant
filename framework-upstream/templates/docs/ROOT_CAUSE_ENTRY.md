## RC-NNN — `<one-line title>`
**Date:** DD-MMM-YYYY · **Severity:** S1 | S2 | S3 | S4 · **Modules:**

**Symptom** — what was observed, in the words of whoever reported it.

**Root cause** — the reason it existed. Distinct from the symptom, and distinct from the file
where the error surfaced.

> ✗ "The list was empty."
> ✓ "The query filtered on a value that is null until the session finishes hydrating, so it ran
>    once with the wrong filter and the result was cached."

**Fix** — what changed, and why that addresses the cause rather than the symptom.

**Files** —

**How to verify** — a specific instruction a future test run can execute to prove this has not
returned. *This is the field that makes the register useful rather than historical.*

**Recurrence risk** — where else this class can occur. If it is a pattern, state how many other
sites you found **and the search you used**. An unevidenced sweep did not happen.

**Prevention** — the rule, checklist item or gate that now catches it, **named as a path**:
`rung: tests/unit/session-hydration.unit.spec.ts`
Or honestly: "no rung — prose only", and why one is not currently feasible.

**Process check** — would a correctly functioning process have caught this?
No → one line, done. Yes → the framework-update workflow ran; here is what changed.
