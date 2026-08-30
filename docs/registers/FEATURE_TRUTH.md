# Feature Truth

> **The canonical answer to "what does this product actually do today?"**
>
> Updated at every close-out that changes behaviour — or "no change needed" stated out loud.
>
> Every external claim about the product — website, sales material, support answer, release note
> — is sourced from **this file only**. A stale truth file is how a website ends up promising
> what the product no longer does.

---

## Per module

### `<Module name>`
**Last confirmed:** DD-MMM-YYYY

**What it does** — one paragraph, in the language of a user.

**Capabilities**
| Capability | Status | Notes |
|---|---|---|
| _…_ | ✅ verified / ◻ stated but unverified | |

**Rules and validations** — the conditions a user will actually encounter, in plain language.
"An invoice cannot be deleted once it has a payment against it."

**Limits** — what it will not do. Often more valuable than the capability list, because it is
what support gets asked about.

**Benefit** — why a user cares. One sentence. This is the line marketing may quote.

---

## Two conventions

**Marks:** ✅ means verified against the running system on the stated date. ◻ means claimed but
not yet verified — verify it the next time you touch that module and flip it, or correct it.
Never leave a claim unmarked; an unmarked claim reads as verified.

**On conflict, code wins.** If this file, a module document and the code disagree, the code is
the truth and **both documents are corrected in the same change**. A document that lost an
argument with reality and was left standing will win the next one.
