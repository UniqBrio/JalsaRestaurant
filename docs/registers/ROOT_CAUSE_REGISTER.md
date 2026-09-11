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

## RC-011 — A concurrency guard written in React state let a single tap act twice

**Date:** 11-Sep-2026  ·  **Severity:** S2  ·  **Modules:** jalsa `src/features/staff/PinSignIn.tsx`

**Symptom** — four taps on a four-digit keypad sent TWO sign-in attempts. Nothing on screen
showed it; it surfaced only when a functional spec counted the requests.

**Root cause** — the submit call lived inside a `setState` updater. An updater must be pure, and
React 19 deliberately invokes it twice under StrictMode. The same class covers every guard of the
shape `if (busy) return` where `busy` is rendered state: two events in one tick both read the
pre-update value, because state has not flushed.

**Fix** — compute the next value outside the updater, call `setState` with it, then act. For
re-entrancy, latch on a ref, never on rendered state.

**Files** — `jalsa/src/features/staff/PinSignIn.tsx`, `jalsa/docs/registers/CANONICAL_PATTERNS.md`
(JP-11).

**How to verify** — `npx playwright test tests/functional/signin.functional.spec.ts -g "submits
exactly once"`. It asserts the REQUEST COUNT, not the spinner.

**Recurrence risk** — high, and invisible to every pointer-driven manual test. Searched
`grep -rnE "setState|set[A-Z]\w+\(\(" jalsa/src` — 1 further site (`GuestApp.runBusy`,
`if (busy) return` over state) which is mitigated by `disabled={busy}` but shares the class.

**Prevention** — `rung: jalsa/tests/functional/signin.functional.spec.ts`. Framework rule FR-3
below; no automated detector yet — an ESLint rule forbidding calls inside updaters is the
candidate, parked as it needs a real AST check rather than a grep.

**Process check** — **No.** No checklist item or audit would have found it; executing the journey
did. This is the argument for the functional tier, not for another rule.

---

## RC-010 — The read that proves a write was droppable, so the screen denied what the user just did

**Date:** 11-Sep-2026  ·  **Severity:** S2  ·  **Modules:** jalsa `src/hooks/useLiveData.ts`

**Symptom** — none reported; found by reading. After a write, the screen could keep showing
pre-write state for a full poll interval (6s, 8s on the owner console).

**Root cause** — one boolean served two different jobs. `if (inFlight) return` correctly stops
SCHEDULED polls stacking up, and `send()` reused the same `refresh()`. So a poll already awaiting
the network silently swallowed the post-write read. A dropped tick costs nothing; a dropped
confirmation costs a second order in the kitchen, because the obvious human response to "nothing
happened" is to press the button again.

**Fix** — `src/hooks/refresh-gate.ts`: a refresh a PERSON caused is remembered and re-run the
moment the in-flight one finishes; a refresh a TIMER caused is still dropped freely. The hook also
compares the payload as text and skips `setState` when nothing changed.

**Files** — `jalsa/src/hooks/refresh-gate.ts` (new), `jalsa/src/hooks/useLiveData.ts`,
`jalsa/tests/unit/refresh-gate.unit.spec.ts` (new, 6 cases).

**How to verify** — `npx playwright test tests/unit/refresh-gate.unit.spec.ts`. The load-bearing
case is "a refresh a person caused is never dropped".

**Recurrence risk** — every application that polls. Searched `grep -rn "useLiveData" jalsa/src` —
3 call sites, all fixed by the single hook.

**Prevention** — `rung: jalsa/tests/unit/refresh-gate.unit.spec.ts`. Framework rule FR-4 below.

**Process check** — **Yes.** `checklists/DEFINITION_OF_DONE.md` asks that a save is proved against
the data rather than the toast, but says nothing about the READ that follows it. Strengthened in
this run.

---

## RC-009 — A clean-gate verdict was cited as coverage of a directory the audit never opened

**Date:** 11-Sep-2026  ·  **Severity:** S2  ·  **Modules:** `scripts/audits/check-dead-weight.mjs`,
`scripts/lib/ratchet.mjs`, `checklists/DEFINITION_OF_DONE.md`

**Symptom** — an application close-out recorded *"Dead weight deleted — gate: PASS
(`audit:deadweight`)"* while 1,988 lines across 15 unreferenced components sat in
`src/components/`. Evidence: `for f in $(find src/components -name '*.tsx'); do ...` — 15 files
with zero references outside themselves.

**Root cause** — NOT a lying detector. `check-dead-weight.mjs` declines application source
deliberately, for a sound reason stated in its own header: dynamic imports and file-based routing
make a reference scan confidently wrong. The defect is that its VERDICT did not carry that
scope. `OK [DEAD WEIGHT] … CLEAN GATE` is the line a reader meets; the header is not. A verdict
that cannot be read as narrow will be read as broad.

**Fix** — `evaluateRatchet` gained a `scope` field printed with EVERY verdict — OK, BLOCKED and
new-violation alike. The dead-weight audit now states the directories it audited, that application
source is not audited, and *"Do not cite this verdict as coverage of src/."*

**Files** — `scripts/lib/ratchet.mjs`, `scripts/audits/check-dead-weight.mjs`,
`scripts/audit-scope.test.sh` (new, 6 cases), `package.json` (`guard:test`),
`checklists/DEFINITION_OF_DONE.md`.

**How to verify** — `bash scripts/audit-scope.test.sh`. It EXECUTES the audit and asserts the
output carries the scope, rather than reading the source for the word.

**Recurrence risk** — every ratchet audit shares `evaluateRatchet`, so all of them gained the
field at once; each still has to pass a `scope`. Searched
`grep -rn "evaluateRatchet({" scripts/audits` — 5 call sites, 1 now passes a scope. The other
four are honest today (they do scan what their name implies) and are the paydown queue.

**Prevention** — `rung: scripts/audit-scope.test.sh`. Framework rule FR-1 below.

**Process check** — **Yes.** The Definition of Done let a gate name stand in for a claim about
scope. Strengthened in this run: an item citing a gate must cite a gate whose scope covers the
claim.

---

## RC-008 — The stage-timing rule was prose-only, so the slow stage was diagnosed by feeling

**Date:** 08-Sep-2026  ·  **Severity:** S3 (no defect shipped; the process could not see its own cost)  ·  **Modules:** process — the verification stage, the gate runner

**Symptom** — the owner reported that corrections complete quickly but verification "often
exceeds one hour", with no figure for which part of it. Measured on this repository the same
day: `audit:all` 17.7s · `guard:test` 60.2s · `npm run gate` 8.6s — **~87 seconds**, about 2.4%
of the reported stage. The remaining ~58 minutes were agent-side and entirely unattributed.

**Root cause** — two failures, and the first is this framework's own first idea failing on
itself:

1. **A rule with no rung.** v1.13.0 shipped "run reports carry stage timings (ground · plan ·
   build · verify · gate), minutes each" — case **FW-SPEED-003**, whose anti-pattern is
   verbatim *"a slow run with no timing data, diagnosed by feeling."* `CHANGELOG.md` and
   `UPGRADES.md` both promise it. Nothing executed it: the only party asked to honour the rule
   was the narrator, and a duration recalled at the end of a run is what `gate-runner.mjs`'s
   own header calls *"a verdict typed from memory — a guess with formatting."* Three versions
   later the rule had produced not one measured number, so the first real report of slowness
   arrived exactly as the anti-pattern describes. `grep -rniE "elapsed|duration|hrtime|
   performance\.now|Date\.now\(\)" scripts/` returned **3 matches, all CSS
   `animation-duration`** — zero instrumentation in the whole tree.
   *Why the rule-coverage audit did not catch it:* `check-rule-coverage.mjs` reads
   `CANONICAL_PATTERNS.md`, `ROOT_CAUSE_REGISTER.md` and `DESIGN_RULES.md` — IDs `CP|RC|DR|FP`.
   `FW-*` process cases are outside its population, so "backlog is zero — CLEAN GATE" was true
   of what it reads and silent about this. The audit did not lie; its scope simply never
   included the register this rule lives in.

2. **Proportionality was applied to half the run.** v1.19.0 gave the **build** side three lanes
   and v1.20.0 parallelised generation; the review matrix scaled *who reviews*. Nothing ever
   scaled *what verification executes*. `test-gate.md` opened "Runs after ANY code change" with
   nine T1 sub-steps each marked **(blocking)** and no scale column, so a two-file label fix
   enumerated the same constraint space, configuration space and four dimensions as a schema
   migration. T3 alone was risk-proportional. Verification was therefore the longest stage in
   every run **by default rather than by risk** — and being unmeasured, it stayed that way
   through three consecutive speed releases that all aimed at the build half.

**Fix** — the gate runner **measures**: per-step duration, the total, and the slowest step
named, prepended to the append-only `TEST_SUMMARY.md` so the trend accrues with no upkeep. A
step that never spawned prints `-`, never `0ms` — zero is a measurement, and a step that did
not run has none. `workflows/test-gate.md` gains **the verification lane**: which T-steps run
at micro · scoped · full-scale, keyed to the `SCALE:` declaration guard **G8** already verifies
against the diff, so the lane costs no new token and no new guard. What shrinks is the
enumeration of classes the change cannot reach; T1.5 fail-first, T1.6 the registry delta and
T2 the mechanical gate are marked **never scales**.

**Files** — `scripts/gate-runner.mjs` · `scripts/gate-timing.test.sh` (new) · `package.json`
(`guard:test`) · `workflows/test-gate.md` · `workflows/feature.md` · `docs/01-SDLC.md`

**Verification step** — `bash scripts/gate-timing.test.sh` → 8/8. Run `npm run gate` and read
the `Time:` line: total plus the slowest step. Four of the eight assertions were **observed
failing** against the pre-timing runner; the other four are regression guards on the verdict
contract and correctly pass in both trees.

**Recurrence risk** — **Medium, and named honestly.** Only the *gate* stage is now measured.
Ground · plan · build · verify remain narrator-reported, because no process in this framework
observes wall-clock across an agent's stages — there is nothing to hook. That is recorded debt,
not coverage: FW-SPEED-003's rung covers the gate stage only, and the case says so. The second
risk is the lane being claimed for a change that outgrew it; G8 checks the `micro` claim
against the diff, and mid-run promotion is stated out loud, but a *scoped* claim on a
full-scale change has no mechanical rung and is review-only.

---

## RC-007 — Seventeen defects reached a user through a passing SDLC run

**Date:** 06-Sep-2026  ·  **Severity:** S1 (two of the seventeen destroy data silently)  ·  **Modules:** process — the design, build and test stages

**Symptom** — an owner reported seventeen defects found *after* the workflow ran green: an
Edit screen opening blank and another opening the Add form; a member picker that broke on two
identical names; a save that reported success while writing nothing; "Message sent" for mail
that never left; report figures that never moved; PIN boxes two-per-row under the keypad;
sign-out landing on the wrong screen; a raw database error shown to a user; an unchanged save
destroying a stored schedule; audit rows attributed to "System".

**Root cause** — three distinct process failures, not one:

1. **Rules that existed but had no rung.** "A save is proved against the data, never the
   toast" is a Definition-of-Done item and a documented spec habit — and both false-success
   defects walked past it, because nothing *executed* it. This is the framework's own first
   idea failing on the framework's own rule: a rule nothing runs is not a rule.
2. **Rules that did not exist at all.** Nothing in the framework said an edit surface must
   arrive populated, that an unchanged save must round-trip untouched fields, that selection
   is keyed by database id rather than a display label, or that placeholder data must not
   reach shipped source. Four defect classes, no rule to violate.
3. **Capabilities re-implemented instead of reused.** The library already ships a dialog whose
   backdrop uses the `overlay` token (verified: `rgba(11,15,25,0.45)` / `rgba(0,0,0,0.65)` —
   correctly translucent in both themes), an error taxonomy that forbids raw engine strings
   (CP-11), and a fixed-chrome clearance rule (CP-8). The black backdrop, the raw database
   error and the keypad overlap are each a re-encounter of a solved problem. **Rebuilding a
   registered component re-inherits every bug it had already fixed.**

**Fix** — one mechanical gate, one canonical pattern with an executable rung, one amended
pattern, and one review table placed where a fixer actually reads it:

- `scripts/audits/check-fixture-leak.mjs` (+ `npm run audit:fixtures`, in `audit:all`) —
  ratcheted detection of fixture imports, placeholder-named literals and hardcoded datasets in
  shipped source. Closes the Edit-Member-fixture and hardcoded-reports classes.
- **CP-25** — edit surfaces load before they render, are keyed by database id, and an
  unchanged save round-trips every field. Rung: three new journeys in
  `starter/tests/functional/reference.functional.spec.ts`.
- **CP-15 amended** — a date arriving by import, paste or API bypasses the picker, so it is
  unambiguous or rejected. `01/09/2026` is two different days.
- `workflows/bug.md` **C2b** — the five classes a green suite does not see, each with the
  assertion that catches it.

**Files** — `scripts/audits/check-fixture-leak.mjs`, `starter/.baselines/fixture-leak-baseline.txt`,
`starter/tests/functional/reference.functional.spec.ts`, `docs/registers/CANONICAL_PATTERNS.md`,
`workflows/bug.md`, `package.json`, `FRAMEWORK_MANIFEST.md`, `docs/00-OVERVIEW.md`.

**How to verify** — add `const MOCK_ROWS = [{a:1},{a:2}]` to any application source file and
run `npm run audit:fixtures`: it must report a new violation and exit non-zero. Then open an
existing record in the app, save without editing, and assert the write contains every stored
field — including fields the form never rendered.

**Recurrence risk** — high for the two classes that remain **review-enforced**. The
false-success class (bugs 10 and 17) has a rule, a Definition-of-Done item and a reference
assertion, but **no automated rung**: detecting "asserts a toast but never asserts the write"
requires knowing which assertion is the effect, which a scanner cannot decide. Stated as
honest debt rather than papered over with a fourth restatement of the same rule — the rule
budget forbids minting a second rule for a class that already has one. The re-implementation
class is now addressed at the process level by the v1.21.0 reuse-first decision, whose
enforcement is a recorded answer in the change log, not a script.

**Prevention** — `scripts/audits/check-fixture-leak.mjs` (mechanical, ratcheted) ·
CP-25 rung `starter/tests/functional/reference.functional.spec.ts` (mechanical) ·
CP-15 amendment (review) · `workflows/bug.md` C2b (review) ·
`workflows/framework-update.md` Route B step 0/4 reuse decision (review, recorded).

**Process check** — **Yes.** A correctly functioning process would have caught at least eleven
of the seventeen: the four with existing rules that nothing executed, the three re-implemented
capabilities, and the four now covered by CP-25 and the fixture ratchet. The framework-update
workflow ran; this entry and the changes above are its output. The remaining six were
application-domain defects (routing after sign-out, existence checks before the PIN screen,
actor propagation) whose classes are now named in `bug.md` C2b but whose fixes belong in the
application's own `/bug` runs.

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
