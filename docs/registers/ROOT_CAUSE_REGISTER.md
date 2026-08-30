# Root Cause Register

> Every defect that reached a user, or that cost more than an hour to diagnose.
>
> **Append-only. Newest first. Never renumber. Never backfill.**
>
> Read before every bug fix, cited in every implementation plan, and consulted at every test run.
> Its value is entirely in having been kept from the start.

---

## Template

```markdown
## RC-000 — <one-line title>
**Date:** DD-MMM-YYYY  ·  **Severity:** S1 | S2 | S3 | S4  ·  **Modules:** <list>

**Symptom** — what was observed, in the words of whoever reported it.

**Root cause** — the reason it existed. Distinct from the symptom, and distinct from the file
where the error surfaced. One or two sentences.

**Fix** — what changed, and why that addresses the cause rather than the symptom.

**Files** — the paths touched.

**How to verify** — a specific instruction a future test run can execute to prove this has not
returned. This is the field that makes the register useful rather than historical.

**Recurrence risk** — where else this class can occur. If it is a pattern, say how many other
sites were found and how you searched. An unevidenced sweep did not happen.

**Prevention** — the rule, checklist item or gate that now catches it, **named as a path**.
Or, honestly: "no rung — prose only", and why a rung is not currently feasible.

**Process check** — would a correctly functioning process have caught this?
No → one line, done. Yes → the framework-update workflow ran, and here is what changed.
```

---

## Severity

| | |
|---|---|
| **S1** | Data loss, security exposure, or the application is unusable. Fix now. |
| **S2** | A major flow is broken with no workaround. Fix this release. |
| **S3** | A flow is degraded, or there is a workaround. Schedule it. |
| **S4** | Cosmetic or rare. Backlog. |

---

## Entries

> The four entries below were found **by this framework's own gates, while it was being built**.
> They are kept as worked examples of the format — and as evidence that the gates fire.
> RC-005 and RC-006 were found by the **fixtures**, during the evolution release (v1.1.0),
> before either defect ever reached an app.

---

## RC-006 — writeBaseline glued the first entry onto the header
**Date:** 28-Aug-2026 · **Severity:** S2 · **Modules:** ratchet engine (all baselined gates)

**Symptom** — `fixtures/with-debt` failed conformance: an audit re-run immediately after
`--write-baseline` reported the just-baselined violation as NEW.

**Root cause** — `writeBaseline`'s header array ends with `''` to produce the final newline, but
`.filter(Boolean)` treats `''` as false and stripped it — gluing the first entry onto the last
comment line, where `readBaseline` discarded it as a comment. Every 0-entry (clean) baseline
masked the bug; the first 1-entry baseline exposed it.

**Fix** — `.filter((x) => x !== null)`. All framework baselines regenerated with the fixed writer.

**Files** — `scripts/lib/ratchet.mjs`

**How to verify** — write a 1-entry baseline with any audit's `--write-baseline`, re-run the
audit: exit 0, "none new". `fixtures/with-debt` pins this permanently.

**Recurrence risk** — every consumer of `writeBaseline` shared the defect; one fix covers all.
Sweep evidence: `grep -rn "filter(Boolean)" scripts/` → 0 remaining matches.

**Prevention** — rung: `scripts/conformance.mjs` (with-debt checks) + `scripts/audits/check-backward-compat.mjs`.

**Process check** — **Yes.** No gate ever exercised a NON-EMPTY baseline round-trip; all the
framework's own baselines were clean, so the writer's output was never read back with content.
The fixture suite now does exactly that on every change — that is the process fix, shipped in
the same release.

---

## RC-005 — the first upgrade after adoption clobbered pre-existing app edits
**Date:** 28-Aug-2026 · **Severity:** S1 · **Modules:** lineage, upgrade

**Symptom** — `fixtures/diverged` failed conformance: its deliberate seed-file modification did
not survive an upgrade — the divergence marker was overwritten.

**Root cause** — `lineage --init` recorded already-modified files as `pristine` ("today's hash is
your baseline"). `upgrade` then read *pristine + seed differs* as "the framework changed this"
and auto-applied — but the difference was the APP's edit, made before lineage existed. Two
different histories collapsed into one status.

**Fix** — `--init` compares each file against the current seed and records differing files as
`adopted-modified`; `statusOf` treats that status as sticky `modified`, so such files always
route to review, never to auto-apply.

**Files** — `scripts/lib/lineage.mjs`, `scripts/lineage.mjs`

**How to verify** — adopt an app whose seed file carries an edit, upgrade with a changed seed:
the edit must survive and an incoming copy must appear. `fixtures/diverged` pins this; the
injected-defect run in TEST_SUMMARY.md shows the audit going red without the fix.

**Recurrence risk** — any status collapse where two histories share one label. The scaffolder
writes seed-identical files, so it cannot exhibit this; stated, not assumed.

**Prevention** — rung: `scripts/conformance.mjs` (diverged checks) + `scripts/upgrade.test.sh`.

**Process check** — **Yes and no.** The upgrade test suite existed and passed — but only
exercised scaffolder-born apps, never adopted ones. The fixture existed precisely to cover the
adoption path, and it fired on first run. The process worked as designed; the lesson (a test
suite covers the paths it was written from) is already FP'd under "a passing check proves only
what it looked at".

---

## RC-004 — The gate runner reported a missing tool as FAIL
**Date:** 28-Aug-2026 · **Severity:** S3 · **Modules:** gate runner

**Symptom** — On a machine where the type-checker could not be installed, the gate reported
`VERDICT: FAIL` with an npm registry error pasted into the report, as though the code were broken.

**Root cause** — `run()` classified any non-zero exit as FAIL, and only a literal `ENOENT`
launch failure as BLOCKED. A tool that launches successfully and then fails to *fetch itself*
exits non-zero like any other failure, so "this machine cannot check your code" was
indistinguishable from "your code is wrong".

**Fix** — An `UNAVAILABLE` signature list (registry errors, missing modules, unresolvable
executables, missing scripts) classifies those outputs as **BLOCKED** with the tool named.

**Files** — `scripts/gate-runner.mjs`

**How to verify** — Run the gate with a dependency uninstalled. The step must read
`BLOCKED - tooling unavailable`, the verdict must be `BLOCKED`, and the exit code must be 3.

**Recurrence risk** — Any step shelling out to an installed tool. All nine steps share `run()`,
so the fix is at the shared boundary and covers every one.

**Prevention** — The three-valued contract now has a written rule in both directions: a missing
tool is never FAIL *and* never PASS. `rung: scripts/gate-runner.mjs` (the `unavailable()`
classifier); prose in [docs/16](../16-TESTING-AND-VALIDATION.md) §2.

**Process check** — **Yes.** The framework's own principle — "fail open on tooling, block only
on evidence" — was documented for the ratchets and not applied to the runner. Corrected in
[docs/17](../17-ENFORCEMENT-RATCHETS.md) §4, which now states the rule applies to every gate.

---

## RC-003 — The rule-coverage audit was blind to `.tsx` references
**Date:** 28-Aug-2026 · **Severity:** S2 · **Modules:** rule-coverage audit

**Symptom** — Ten canonical-pattern rows were reported as `PROSE-ONLY` — declared, accepted debt
— when in fact each named a component file that **did not exist**. The audit under-reported the
exact defect class it exists to find.

**Root cause** — The rung pattern matched `.spec.ts|.test.ts|.mjs|.py|.sh|.ts` only. A rule
pointing at `src/components/Dialog.tsx` therefore matched nothing, and "no rung found" was
reported as the benign outcome rather than the unverified claim it was.

**Fix** — Extended the pattern to `.tsx|.jsx|.json|.css`. Eight rows immediately reclassified as
`DEAD-RUNG`; all eight were then repaired by creating the referenced files.

**Files** — `scripts/audits/check-rule-coverage.mjs`, `docs/registers/CANONICAL_PATTERNS.md`,
eight new files under `starter/src/`.

**How to verify** — `node scripts/audits/check-rule-coverage.mjs --report` reports
`dead/dupe: 0` and `prose only: 0`. Add a row citing a non-existent `.tsx` file; it must appear
as `DEAD-RUNG`.

**Recurrence risk** — Any file type a future rule might cite. The pattern is now one list in one
place.

**Prevention** — `rung: scripts/audits/check-rule-coverage.mjs`, ratcheted.

**Process check** — **Yes.** A detector's own coverage is a coverage question, and nothing was
asking it. This is the general form of *"a passing check proves only what it looked at"*
([docs/09](../09-CODE-QUALITY.md) D-3) applied to the detector itself.

---

## RC-002 — The documentation guard was live but vacuous
**Date:** 28-Aug-2026 · **Severity:** S2 · **Modules:** commit guards

**Symptom** — The guard reachability test expected guard G5 to block a commit that touched
application code with no documentation. It passed the commit instead.

**Root cause** — G5 accepted **any** `.md` file as documentation, and `TEST_SUMMARY.md` is a
`.md` file written by the gate runner. Since G2 already requires a gate run, every compliant
commit staged `TEST_SUMMARY.md` — and satisfied the documentation guard for free. The guard was
reachable, executing, and could never fire.

**Fix** — G5 now excludes `TEST_SUMMARY.md`. It is a gate **artifact**, not a description of
behaviour.

**Files** — `scripts/hooks/pre-commit-guard.sh`

**How to verify** — `bash scripts/hooks/guard-reachability.test.sh` — the case
*"the LAST guard still fires"* must return exit 2, and *"a real doc satisfies it"* exit 0.

**Recurrence risk** — Any guard whose condition can be satisfied by an artifact another guard
already requires. Guards are ordered, so a later guard must never accept an earlier guard's output.

**Prevention** — `rung: scripts/hooks/guard-reachability.test.sh`, which executes each guard
against a scratch repository.

**Process check** — **Yes.** A guard that cannot fire is worse than an absent one: it reports
coverage. Only executing it revealed this — a source scan would have shown a correct-looking
guard. Recorded in [docs/17](../17-ENFORCEMENT-RATCHETS.md) §5.

---

## RC-001 — A reachability test asserted on the wrong guard
**Date:** 28-Aug-2026 · **Severity:** S3 · **Modules:** guard tests

**Symptom** — The case *"G1's escape token releases it"* failed: the commit was still blocked.

**Root cause** — The scratch repository satisfied G1's escape token but not G2's precondition, so
the blocking exit came from **G2**. The test's assertion could not distinguish which guard
produced the exit code, so a green result would have proven nothing about G1.

**Fix** — The scratch repository now satisfies every downstream guard's precondition, so a pass
can only come from the token under test.

**Files** — `scripts/hooks/guard-reachability.test.sh`

**How to verify** — Remove the `CASES-NA:` token from that case; it must fail. Restore it; it
must pass.

**Recurrence risk** — Every test of one item in an ordered chain. The pattern: isolate the item
under test by satisfying everything else.

**Prevention** — Prose: *"assert on the RESULT, not the precondition"*
([docs/09](../09-CODE-QUALITY.md) D-8), plus a comment at the case itself.

**Process check** — **No.** The test found the defect on its first run, which is the outcome the
test was written for. The process worked.
