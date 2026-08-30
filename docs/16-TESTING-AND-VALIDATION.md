# 16 — Testing and Validation

> The runbook is [workflows/test-gate.md](../workflows/test-gate.md). This document explains
> **why the gate is shaped the way it is.**

---

## 1. Three tiers, and why the split matters

| Tier | Needs | Catches | Runs |
|---|---|---|---|
| **unit** | Nothing. No page, no server, no credentials. | Logic, classification, formatting, rules | Everywhere, always |
| **render** | A browser | Computed colour, layout, focus, occlusion | Everywhere |
| **functional** | The app, network mocked at one boundary | Journeys, integration, data effects | Everywhere |

The unit tier's defining property is that it **needs nothing**. That is why it always actually
runs — and why enforcement rungs belong there. A gate that only executes when someone has the
right environment is a gate that stops executing.

The functional tier mocks the network at **one** boundary, so no test can reach a real datastore
by accident and there is exactly one place to change when the contract moves.

---

## 2. Three verdicts, and the third is the point

- **PASS** — cleared to merge.
- **FAIL** — blocked. Everything resolves. No partial merges.
- **BLOCKED** — a class could **not** be verified: no environment, missing tool, skipped step,
  no seeded data.

**BLOCKED is a verdict, and it is never a pass.** Green-by-omission is the failure this design
exists to prevent: a suite that reported nothing is indistinguishable from a suite that passed,
and the difference is only discovered when the defect reaches a user.

`scripts/gate-runner.mjs` therefore has no fourth value for "absent". A step that did not run is
BLOCKED and says why. Every `--skip` flag records BLOCKED with the stated reason. **No flag can
produce green.**

---

## 3. Not-run is not pass

The verdict states, per touched module, `X executed, Y not run`, **computed from the registry**,
not from memory.

A not-run geometry case in a touched module means the gate is not green — automate it and run
it, or have the owner accept the specific IDs in writing for this release.

This exists because it is entirely possible for dozens of cases to sit unexecuted behind a green
gate while the exact defect they guard against ships. The count is the only thing that surfaces
it, and it has to be computed rather than reported.

---

## 4. Assertions worth making everywhere

### Assert the data, not the toast
```ts
await expect(page.getByTestId('toast-success')).toBeVisible();   // necessary
expect(written).toHaveLength(1);                                  // the actual assertion
```
A success message is what the application *claims* happened.

### Never force a click, for geometry
```ts
await last.scrollIntoViewIfNeeded();
await last.click();                    // no { force: true }
```
A forced click, a programmatic press and a visibility-only check all **pass on an occluded
element**. That is why occlusion bugs ship green. The unforced failure — "intercepts pointer
events" — *is* the assertion.

And include a viewport short enough that content genuinely overflows. A tall mobile viewport
does not overflow, so it cannot expose the defect.

### Force the failure path
For every fetch feeding a save, make the fetch fail and assert **(a)** the failure surfaces and
**(b)** the save does not overwrite fields derived from the failed read.

### Both themes, every state
Force the theme in the test rather than trusting the runner's OS preference. A suite that has
only ever seen one theme has only ever tested one theme.

### Focus is computable
`document.activeElement` after a dialog opens is an assertion, not an eyeball check.

---

## 5. When a test fails

**Category Z first — is it us?** For any "it was working yesterday", check whether an external
dependency is degraded before theorising about code. An active provider incident is not an
application bug: mark those `BLOCKED-EXTERNAL` and re-run after it closes.

1. **Test-infrastructure defect** (selector, timing, missing await) → fix the test, re-run,
   report as auto-fixed.
2. **Genuine application bug** → **do not auto-fix.** Root cause first, check the register for
   the same class, document severity, wait for approval. A test run that quietly patches
   application code has stopped being a test run.
3. **Escalate after two failed cycles.** Package the failure — raw error, repro, files, what was
   tried — and stop. Never burn cycles guessing.

---

## 6. Manual testing still exists

Some things a machine cannot judge: whether a flow *feels* confusing, whether copy sounds right,
whether a real device on a real network is usable, whether a screen reader makes sense.

Keep those in an explicit manual checklist —
[checklists/MANUAL_TEST_CHECKLIST.md](../checklists/MANUAL_TEST_CHECKLIST.md) — rather than
pretending they are automated. Every skipped automated test names its manual entry:
`// MANUAL: MT-04 — requires a physical device`.

What is **not** acceptable is a computable property sitting in the manual list because writing
the assertion looked like work — that is how geometry cases end up unrun for months.

---

## 7. Performance

Set budgets **in the plan**, on the slowest device and network you support — not on the
developer's machine. Then verify against them, and treat a regression as a failure rather than
a note.

A budget nobody measures is an aspiration. A budget measured only on fast hardware is worse: it
is an aspiration that reports success.
