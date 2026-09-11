---
description: Run the deterministic quality gate and report the verdict honestly
---

# /gate

Run the mechanical gate. **The model narrates; the script decides.**

```bash
npm run gate
```

(The npm script resolves the runner correctly everywhere — framework repo, workspace app,
standalone app. A bare `node scripts/gate-runner.mjs` breaks in a workspace app, whose
process half is linked rather than copied.)

**The request / scope:** $ARGUMENTS

---

## Report the verdict as the script computed it

| Exit | Verdict | What it means |
|---|---|---|
| `0` | **PASS** | Every runnable gate is green. Merge is cleared *by the mechanical gate*; the human review items in `checklists/DEFINITION_OF_DONE.md` still apply. |
| `2` | **FAIL** | Merge blocked. List exactly what must resolve. **No partial merges.** |
| `3` | **BLOCKED** | A class could **not** be verified. This is an owner decision, **never a pass.** |

**Never report a pass you did not observe.** If a step could not run, say which, and why — a
suite that reported nothing is indistinguishable from a suite that passed, and that
indistinguishability is the whole reason this script exists.

## Then

- **PASS** → close out, merge, deploy to preview, report the URL. Production promotion is a
  separate approved step.
- **FAIL** → triage per `workflows/test-gate.md` T5. Test-infrastructure defects you may fix and
  re-run. **A genuine application bug is documented and waits for approval** — never auto-fixed.
- **BLOCKED** → name the class and the reason. The owner decides whether to accept it in writing
  for this release, or to make the class runnable.

## Related

`/test` runs the full T0–T6 protocol around this script — case preparation, the four-dimension
sweep, fail-first evidence, findings routing. This command is just the mechanical part.
