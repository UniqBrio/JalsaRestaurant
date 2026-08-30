# 20 — Glossary

**Baseline** — A committed file listing today's accepted violations of a rule. A ratchet blocks
anything new against it, and also blocks anything fixed but still listed. See
[17](./17-ENFORCEMENT-RATCHETS.md).

**Blast radius** — Everything a change can affect: screens, components, tables, contracts,
background jobs, reports, permissions, documentation. Determined *before* planning.

**BLOCKED** — A gate verdict meaning a class could not be verified. Never a pass. The verdict
that prevents green-by-omission.

**Canonical pattern** — The one blessed idiom for a cross-cutting concern, with a working
reference file. A second way of doing the same thing is a defect.

**Characterization test** — A test that pins current behaviour, written *before* a refactor,
including the behaviour you believe is wrong. Written against the old code; must pass unchanged
against the new.

**Clean gate** — A gate demanding zero violations. Reachable once a ratchet's backlog hits zero.

**Close-out** — The obligations discharged when a change is finished but before it merges:
checklist, test cases, documentation, registers.

**Escape token** — An auditable per-guard opt-out, written into the commit message with a
justification. Excuses only its own guard. There is no global bypass.

**Fail closed** — Deny when uncertain. Applies to every authorisation decision, including when
the identity provider is unreachable.

**Fail-first evidence** — The recorded failure output of a new test run against the pre-fix
tree. A test never observed failing is not evidence that it can fail.

**Fail open (tooling)** — A gate that cannot run because of a missing tool prints a loud SKIP and
passes, rather than blocking the build. It must be audible; a silent dead gate is the failure
mode being avoided.

**Freeze rule** — Shipped user-visible strings are frozen. New features adopt existing
terminology. Exception: when the string itself was the bug.

**Gate** — A stop in the process. Work does not continue past it without explicit approval or an
explicit machine PASS.

**Green-by-omission** — A gate reporting success because it never ran the check. The failure mode
the three-valued verdict exists to prevent.

**Idempotent** — Safe to apply twice. Applies to writes (a double-tap must not create two rows)
and to migrations (safe to re-run).

**Migration ledger** — The migrations folder, as the system of record for schema. An object
existing in a database but in no migration file is a blocking finding.

**Occlusion assertion** — Clicking the last interactive control, without forcing, at a viewport
short enough to overflow. The unforced failure is the assertion.

**Parity gate** — A diff of schemas between environments. Any unacknowledged difference blocks
production promotion.

**Ratchet** — A gate that demands *no worse* rather than *clean*. See
[17](./17-ENFORCEMENT-RATCHETS.md).

**Registry delta** — The explicit added/updated/retired statement a test run makes about test
cases, then verified against the file.

**Root cause** — The reason a defect exists, distinct from the symptom and from the file where
the error surfaced. Stated before the fix is written.

**Rule budget** — Rules are a limited resource. Prefer the cheapest workable enforcement level;
the screen checklist is capped at 20 items and adding one means removing another.

**Rung** — The executable thing that enforces a rule: a spec, a script, a hook, a checklist item.
A rule with no rung declares itself prose-only.

**Semantic token** — A colour named for its ROLE (`text.muted`) rather than its appearance
(`grey600`). The only kind application code may reference.

**Signature (error)** — The shape of an error message, with variable data removed, used to group
occurrences. Interpolating an id destroys grouping.

**Signature (ratchet)** — The stable key identifying one violation, deliberately excluding line
numbers so unrelated edits do not read as new violations.

**Single migration pipe** — Every backend change exists as a migration file, applied to
non-production first, then the identical file to production. Direct edits are forbidden.

**Surgical discipline** — Minimum change for the ask; no drive-by refactors; every changed line
traces to the request.

**Test id** — A stable automation handle, `<module>-<element>[-<entityId>]`, where the entity id
is the database id and never the list position.

**Theme-independent asset** — An asset deliberately fixed to one variant because it renders on a
canvas you do not control (social cards, email). Must be declared with a reason.

**Triple close-out** — Every framework-update run delivers all three: the process learns, the
issue is fixed, the test cases are added. Skipping one is stated in that run, never "later".
