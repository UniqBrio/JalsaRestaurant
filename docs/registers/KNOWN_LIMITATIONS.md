# Known Limitations

> Things the **platform** prevents, distinguished from things that are broken.
>
> Consulted at **design time** (do not design a flow on an unavailable capability) and at **test
> time** (a matching case is skipped with its ID, never failed).

---

## Two rules that keep this register trustworthy

**1. An entry requires a reference proving the platform blocks it.**
No reference, no entry. Without this rule the register fills with bugs misfiled as limitations,
and then the real entries stop being believed — which is worse than having no register.

**2. Nothing is hard-deleted.**
A resolved limitation moves to the resolved section, dated, with what resolved it. Old
screenshots, old support answers and old test cases still refer to it.

---

## Active

| ID | Platform | Capability | Why it cannot work | Reference | What we tell the user | Fallback | Affected modules |
|---|---|---|---|---|---|---|---|
| _KL-001_ | _e.g. iOS Safari_ | _e.g. contact picker_ | _one sentence_ | _link to platform docs / MDN / caniuse_ | _the support answer, in plain language_ | _what the user does instead_ | _list_ |

## Resolved / expired

| ID | Resolved | Date | Notes |
|---|---|---|---|

---

## Maintenance triggers

1. **Discovered during build** → add the entry immediately, with its reference and the
   customer-facing answer. A limitation found and not recorded will be rediscovered, expensively.
2. **A workaround fully resolves it** → move to Resolved, dated, with what resolved it.
   A *partial* workaround edits the row and keeps it Active.
3. **A change removes or alters an affected module** → update the affected-modules column.
   An entry with zero remaining modules is retired to Resolved ("feature removed", dated).
4. **A matching test unexpectedly PASSES** → flag the entry "VERIFY — possibly expired".
   **Never retire it mid-run**; the periodic review owns retirement, with fresh research.
5. **Periodic review** — before each release, or monthly: re-verify every active entry. Platforms
   ship. A limitation from two years ago is often no longer true, and a stale entry silently
   removes a capability from your product.

---

## External dependency directory

The status pages checked **first** for any "it was working yesterday" failure, before any code
theory is entertained. An active incident matching the failure signature is not an application
bug.

| Dependency | Status page |
|---|---|
| _Database / backend host_ | |
| _Hosting platform_ | |
| _Identity provider_ | |
| _Messaging provider_ | |
| _Source control / CI_ | |
