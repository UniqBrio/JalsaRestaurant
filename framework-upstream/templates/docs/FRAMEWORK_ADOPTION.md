# Framework Adoption Log

> **Newest first. Append-only.** Written by `upgrade.mjs --apply`; the human fills in the *why*
> on anything deferred.
>
> The "deferred and why" line is the whole point of this file. At two-digit app counts, the real
> failure is not tooling — it is an app stuck on an old version **with nobody remembering why**.
> This file is the cheap fix, and it only works if it is kept from the first upgrade.

**Skew policy** (framework `docs/22-FRAMEWORK-EVOLUTION.md`): stay within **2 MINOR** versions of
current; adopt a **MAJOR** within one quarter.

---

## <version> — adopted DD-MMM-YYYY (from <previous>)

- Auto-applied: N file(s)
- **Deferred pending merge (N)** — incoming copies in `.framework/incoming/`:
  - `src/…` — *why it is deferred, and the condition for merging it*
- New gates baselined at current state: …
- Post-upgrade gate verdict: PASS / FAIL / BLOCKED — *(the upgrade is done when the gate gives a
  verdict, not when files land)*

---
