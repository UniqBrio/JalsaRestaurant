# The Test Gate

> Runs after ANY code change, before anything merges. **Nothing merges without an explicit
> PASS verdict.**
>
> This prompt TESTS. It never "improves" application code. A genuine bug found here is
> documented and triaged, not silently patched.

**CHANGE UNDER TEST:** `<one line — what changed, and which files/modules>`
**SCALE:** `micro | scoped | full-scale` — the same declaration the run already made, not a
second judgement. Guard G8 verifies a `micro` claim against the diff.

---

## The verification lane (added 08-Sep-2026)

The build half of a run has been proportional since v1.19 and parallel since v1.20. This half
was not: every T1 sub-step below is marked **(blocking)**, and until now that meant a two-file
label fix enumerated the same constraint space, configuration space and four dimensions as a
schema migration. **Verification became the longest stage in the run by default, not by risk.**

What shrinks is the **enumeration of classes the change cannot reach**. What never shrinks is
the verification of a class it *can* reach. Those are different economies, and collapsing them
is how a lane becomes a bypass.

| Step | micro (≤2 files, no schema) | scoped (≤5 files, additive schema) | full-scale / hotspot |
|---|---|---|---|
| **T1.1** Blast radius | One line: the touched module + any importer of a changed export | Inline list | Full list, spawned explorer |
| **T1.2** Four dimensions | Only dimensions the diff can **reach**; the rest are one line each: *"not reachable — &lt;why&gt;"* | All four, one line each | All four, per module |
| **T1.3** Constraint idempotency | **N/A by entry test** — a schema change disqualifies micro | Tables this change **writes**, (a)–(d) | Every table in the blast radius |
| **T1.4** Configuration space | Only if the changed lines **read** configuration | Non-default configurations for touched behaviour | Full sweep incl. the undo round-trip |
| **T1.5** Fail-first evidence | **Never scales.** Every new behaviour test, every lane | same | same |
| **T1.6** Registry delta | **Never scales.** Stated and verified against the file | same | same |
| **T1.7** Limitations filter | Only when a planned case matches a recorded limitation | same | same + expiry probes |
| **T2** The gate | **Never scales** — `npm run gate`, all steps. It costs seconds; see below | same | same |
| **T3** Regression | Smoke + the touched module's suite | Smoke + blast-radius suites | Full sweep on any T3 trigger |
| **T6** Execution ledger | Touched module only | Touched + blast radius | Every module |

**A skipped row is stated, never silent.** Each one above that does not apply is discharged in
`TEST_SUMMARY.md` with its reason — the same discipline as a `--skip` on the runner, which
records BLOCKED and can never produce green. *"Not applicable"* is a verdict; an unmentioned
dimension is still a defect of the run (T1.2).

**A disqualifier found mid-run promotes the lane, out loud.** Discovering a second table, a
configuration read or a shared export the diff did not appear to touch means the run was scoped
all along: say so, and discharge the rows the lighter lane skipped. Making the second attempt
cheaper is how a two-round loop becomes a five-round one.

### Do not economise on the mechanical gate — it is not where the time goes

Measured on this repository, 08-Sep-2026: `audit:all` **17.7s** · `guard:test` **60.2s** ·
`npm run gate` **8.6s** — about **87 seconds** for the entire mechanical stack. A verification
stage that takes an hour is not spending it here, and skipping a gate to save nine seconds
trades the only evidence in the run for nothing.

**The gate now reports where its own time went**, per step plus the total and the slowest step,
prepended to `TEST_SUMMARY.md`. That file is append-only, so the trend accrues with no upkeep.
When a stage is slow, read the number — do not estimate it. That is the rung under
FW-SPEED-003, whose anti-pattern is *"a slow run with no timing data, diagnosed by feeling."*

---

## T0 — Ground rules

1. Read the project rules file and `docs/registers/ROOT_CAUSE_REGISTER.md`.
2. Read the test-case registry and `docs/registers/KNOWN_LIMITATIONS.md`.
3. **Binding playbook rules:**
   - Never overwrite an existing spec file. Append.
   - A database-level failure: STOP → describe → propose the migration → **wait for approval**.
     Never touch production.
   - New scenarios discovered mid-run go into `TEST_SUMMARY.md` as `[PROPOSED]`. No test code
     for a proposal until it is approved.
   - `TEST_SUMMARY.md` gets a **new dated section at the top**. Never overwrite a prior run.
4. **Test credentials and data** come from a written policy file, not from stopping to ask.
   Test contact details are always fake. Outbound sends go only to pre-approved destinations —
   anything else stops and asks. See [docs/registers/TEST_ACCOUNTS.md](../docs/registers/TEST_ACCOUNTS.md).

---

## T1 — Prepare the cases (before running anything)

### T1.1 Blast radius
List every module this change can affect: its own, plus cross-module dependents.

### T1.2 The four-dimension sweep (blocking)
For **every** module in that list — including ones pulled in by blast radius — state, per
dimension, either the case IDs created or the words **"covered — none needed"** with one line
of reasoning:

1. **Functional**
2. **Responsive** — every viewport profile
3. **Performance** — against the budget in the plan
4. **Security** — roles and permissions, tenant isolation, injection

**A dimension not mentioned at all is a defect of this run, not an implicit pass.** Silence is
how cases sit unexecuted behind a green gate.

### T1.3 Constraint-derived idempotency cases (blocking)
For every table this change WRITES to, enumerate its unique constraints **from the live
schema** — never assume the migration files are complete — and generate:

- (a) the same action performed twice (retry, double-tap) — must be idempotent;
- (b) a second *legitimate* row that shares the constraint's key window;
- (c) an existing system-created row for the same key;
- (d) a failure mid-cascade for any multi-write flow — assert **no partial state**.

Any raw constraint error reaching the UI is a FAIL.

### T1.4 Configuration-space sweep (blocking)
If behaviour depends on configuration, cases must cover **non-default** configurations:

- every optional thing OFF at once;
- the "wrong kind first" arrangement for any heterogeneous list a rule selects from;
- **the undo round-trip** — every setting must be reversible from the same screen that set it.

Tests written from the design only confirm the design. At least one case per behaviour rule
must **compute** the rule's answer for a real input — including the input the old rule got
wrong, where a defect is known. A source scan is a ratchet, not a behaviour test.

### T1.5 Fail-first evidence (blocking)
Every NEW behaviour test this run adds is **run against the pre-fix tree**, and its failure
output is pasted into `TEST_SUMMARY.md` beside the passing output.

> **A test that has never been observed failing is not evidence that it can fail.**

Where the pre-fix state cannot be reconstructed: inject the defect, capture the failure, revert
the injection. If neither is possible, record `NOT OBSERVED FAILING: <spec> — <reason>`.
That is a verdict; silence is not. Enforced by guard G3 in `scripts/hooks/pre-commit-guard.sh`.

### T1.6 Registry delta (required artifact)
End this step with an explicit three-verb statement:

> `Registry delta: added <IDs>; updated <IDs>; retired <IDs + reason>` — or
> `Registry delta: NONE — <justification>`

**ADD** new cases with new sequential IDs and today's date. **UPDATE** existing cases in place
when their flow changed, and refresh the date — never leave a case describing a flow that no
longer exists. **RETIRE** only when the feature itself is removed; IDs are never reused.

Enumerating cases in a plan is not writing them. The delta refers to rows actually present.

### T1.7 Limitations filter
Cross-check planned cases against the limitations register. A case hitting a recorded platform
limitation is marked `SKIP-KNOWN-LIMITATION` with its ID — not run as a pass/fail.

*Expiry probe:* if the capability is cheap to test, run it anyway. If it **unexpectedly
passes**, do not edit the register mid-run — flag the entry "VERIFY — possibly expired" for the
next review sweep.

---

## T2 — Scoped testing

Canonical execution: **`npm run gate`** (portable across the framework repo and both app
modes — a workspace app has no `scripts/` of its own). The runner enforces the order below;
the narration explains it.

| Step | Gate | Why it is where it is |
|---|---|---|
| **T2.0** | Types clean | The deploy build strips types without checking them. This is the only compile gate. A new type-suppression is a defect; touching a suppressed file is the moment to remove its exemption. |
| **T2.0b** | Second-runtime check | Any code EXCLUDED from the main type-checker (cloud functions, workers) is checked by its own tool. **An exclusion without a named replacement is coverage deletion.** An absent runtime reports BLOCKED, never a silent pass. |
| **T2.1** | Unit + pure specs | No server, no credentials — so they run in every environment, which means they always actually run. Put enforcement rungs here. |
| **T2.2** | Functional | Behaviour against real components. |
| **T2.3** | Copy gate | Every new/changed string reviewed. **Freeze-rule diff check:** every reworded *shipped* string must trace to an explicit request, a copy-migration pass, or the string having been the bug. Anything else reverts. This is the one that catches drive-bys, and neither of its failure modes shows up as a red test. |
| **T2.4** | Responsive matrix | Every viewport profile. **Geometry cases are automated by definition** — overlap, clipping, occlusion, truncation and reachability are computable from a bounding box. Left "manual", they are the cases that sit unrun while the exact defect they guard ships. |
| **T2.5** | Contrast, computed | See below. |
| **T2.6** | Write-proof | Assert the **data**, never the toast. |
| **T2.7** | Permission gating | Disabling gates the deep route and the API path, not just the button. |
| **T2.8** | Dialog behaviour | A stray backdrop tap never discards typed input; closing with unsaved changes confirms first. |
| **T2.9** | Focus | `document.activeElement` is the first field on open. Focus is computable — automated by definition, never eyeballed. |
| **T2.10** | Addressability | Every interactive element the change touched carries a stable test id. |

### T2.4 — the occlusion assertion
On any screen with fixed bottom or top chrome, include at least one viewport **short enough
that content genuinely overflows**. Scroll to the true end, then click the last interactive
control **without forcing the click**. The runner fails a forced-free click with "intercepts
pointer events" when chrome sits on top — *that failure is the assertion.*

A forced click, a programmatic press, or a visibility-only check all pass on an occluded
element. That is why this class ships green.

### T2.5 — the computed-contrast assertion
For every text line the change touches, assert the **computed DOM colour against its real
painted container background** yields at least 4.5:1 (3:1 for large text and UI components) in
**both themes** and in **every data state the line can render** — including seeded states.

- A token-level contrast check proves the palette. It cannot prove an element used the palette.
- Grep is not a substitute: an element with no explicit colour has **no literal to match**, and
  that is precisely the defect — an inherited light-theme colour on a dark surface is not low
  contrast, it is invisible.
- A text element with no explicit colour token is a defect even if it happens to look right
  today.

Reference: `starter/tests/render/contrast.render.spec.ts`.

---

## T3 — Regression

1. **Smoke first.** Any smoke failure stops everything else.
2. **Blast-radius regression** — the suites for every module in T1.1, not the whole registry
   every time. Risk-based selection is what keeps the gate fast enough to actually run.
3. **Full sweep** when ANY of: a shared component/utility/hook changed · navigation changed ·
   auth or session touched · schema changed · more than three modules in the blast radius.

---

## T4 — Route every finding

| Finding | Destination |
|---|---|
| New scenario worth testing | `[PROPOSED]` in `TEST_SUMMARY.md`; added to the registry only after approval |
| Genuine platform limitation | Limitations register — **with a reference proving the platform blocks it**. No reference, no entry. |
| A limitation-matching test unexpectedly PASSED | Flag "VERIFY — possibly expired". Never retire mid-run. |
| App-wide or performance-affecting root cause | Root-cause register, newest first |
| Genuine app bug, module-scoped | `TEST_SUMMARY.md` → "Genuine bugs", severity S1–S4. **Wait for instruction.** |
| Test-infrastructure failure | Fix the test, re-run, report under "Auto-fixed" |
| A string scored "revise" or "block" | Back to the copy pass; blocking |
| Off-voice shipped copy noticed but out of scope | Logged as a candidate. **Never fixed here** (freeze rule) |
| Unverified or hallucinated dependency | **Block the change.** Never install to "see if it exists" |

---

## T5 — Triage failures

0. **External dependency check first** for any "was working" failure. An active provider
   incident is not an app bug: mark those failures `BLOCKED-EXTERNAL`, and re-run after the
   incident closes.
1. **Test-infrastructure defect** (selector, timing, missing await) → fix the test, re-run,
   report as auto-fixed.
2. **Genuine application bug** → **do not auto-fix.** Root cause first, check the register for
   the same class, document severity, wait for approval.
3. After an approved fix: re-run the failing case **and** the register entry's verification
   step, to prove permanent resolution rather than symptom suppression.
4. **Escalate** after two failed cycles. Package the failure — raw error, repro steps, files,
   what was tried — and stop. Never burn cycles guessing.

---

## T6 — Verdict

### The execution ledger (machine-computed)
Generate by script over the registry's execution-status column — **never from memory** — and
write into `TEST_SUMMARY.md`:

```
module | total | executed | pass | fail | not-run
```

for every touched module and every case type.

**Not-run is not pass.** A not-run geometry case in a touched module means the gate is not
green: automate it and run it, or have the owner accept the specific IDs in writing for this
release.

### Registry verification (blocking, before any verdict)
Re-open the registry and **confirm the T1.6 delta is physically present**: added IDs exist with
today's date, updated rows carry refreshed dates, retired IDs are gone, counts match. *A
claimed delta the file does not reflect is a failed run regardless of the test results.*

### The verdict
- **PASS** → cleared. Merge, deploy to preview, report the URL. Production promotion is a
  separate approved step, blocked while any schema parity difference is open.
- **FAIL** → merge blocked. List exactly what must resolve. **No partial merges.**
  S1/S2 always block; S3/S4 block unless explicitly waived.
- **BLOCKED** → a class could not be verified. **Never green-by-omission.** Name the class and
  the reason; the owner decides.
