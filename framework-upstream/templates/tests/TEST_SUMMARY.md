# Test summary

_Newest run first. **Append-only: never overwrite a prior run.**_
_Gate-run blocks are written by `scripts/gate-runner.mjs`. Sections below them are added by hand._

---

## Gate run — YYYY-MM-DD — VERDICT: PASS | FAIL | BLOCKED

*(machine-generated — do not hand-edit)*

### Registry delta
`added <IDs>; updated <IDs>; retired <IDs + reason>` — or `NONE — <justification>`
**Verified against the file:** ✅ / ❌

### Execution ledger
| Module | Total | Executed | Pass | Fail | Not run |
|---|---|---|---|---|---|

**Not-run is not pass.** A not-run geometry case in a touched module means the gate is not green.

### Fail-first evidence
```
FAIL-FIRST: tests/unit/<spec> — "<the failure it produced against the pre-fix tree>"
NOT OBSERVED FAILING: tests/render/<spec> — <why that state could not be reconstructed>
```

### Four-dimension sweep
| Module | Functional | Responsive | Performance | Security |
|---|---|---|---|---|
| | IDs or "covered — none needed: <reason>" | | | |

### Genuine bugs found
| Severity | Module | Symptom | Root cause | Status |
|---|---|---|---|---|

### Auto-fixed (test infrastructure only)

### [PROPOSED] new scenarios
*Not added to the registry until approved.*

### Blocked classes
| Class | Why it could not run | Accepted by |
|---|---|---|

---
