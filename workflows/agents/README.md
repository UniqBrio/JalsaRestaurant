# Review Agents

> Eleven narrow reviewers and one builder, each with a scope, a boundary, and a machine-readable verdict.
>
> Use them as sub-agent definitions for a coding agent, as role descriptions for human
> reviewers, or as a checklist of *review passes* a change needs. The value is the same either
> way: **a narrow reviewer with an explicit boundary catches what a general "please review this"
> does not.**

## Why narrow beats general

"Review this change" produces a review of whatever the reviewer happened to notice — usually
style, because style is what a diff displays. The classes that actually cost money — an
un-swept sibling call site, a permission gated only in the UI, a silently reworded shipped
string — are invisible in a diff unless someone is specifically looking for them.

Each agent below is specifically looking for one thing.

## The rules every agent follows

1. **A verdict on the first line**, machine-readable: `APPROVE` · `REQUEST CHANGES` · `BLOCKED`.
2. **A stated boundary** — what it must NOT do. A reviewer that starts fixing things stops
   being a reviewer.
3. **Read the files, not just the diff.** A diff shows what changed; only the file shows whether
   it is now correct.
4. **Never claim a verdict it did not observe.** If it could not run, it says BLOCKED and why.

---

| Agent | Runs | Looks for | Must never |
|---|---|---|---|
| **blast-radius-explorer** | Before planning | Every reader and writer of the touched tables · every importer of touched shared code · sibling call sites · matching pattern rows and root-cause entries | Propose the fix, or classify behaviour from a grep |
| **implementation-planner** | After the design is approved | Turns the request + blast radius into an ordered plan: one commit per task, migrations, logic placement, copy strings, permission answers, registry delta | Write application code |
| **code-reviewer** | Between build and test | The diff against canonical patterns, root-cause rules, permissions, copy freeze, write-proof, type safety — **and re-checks the previous round's findings**, escalating any that recur | Verdict from greps alone; read the files |
| **test-gate-runner** | At the gate | Executes the runner, interprets its exit codes, verifies the report block actually landed, captures failing lines verbatim | Mark anything passed from memory; fix an app bug it finds |
| **close-out-auditor** | Before merge | That the registry physically matches the declared delta, and every close-out obligation is either discharged or explicitly declared unnecessary | Assume an unreadable file is fine — that is BLOCKED |
| **copy-gate-reviewer** | Any diff touching a visible string | Freeze rule · approved terms · date format · no raw error text · fallbacks distinguishable from real data | Rewrite files; it proposes wording for NEW strings only |
| **permission-reviewer** | Any change touching roles, policies or multi-tenant data | The five permission questions · tenant isolation · write-proof · that disabling gates the deep route and API path | Infer enforcement from client code; read the server |
| **parity-gate-checker** | Before planning, and before any production apply | Structural diff between environments: tables, columns, constraints, indexes, triggers, policies, function bodies · anything live but in no migration file | Write anything, anywhere. It has no write mandate at all |
| **preview-smoke-verifier** | After merge, before handoff | **The only stage that opens the running application.** Scripted journeys against the deployed preview | Substitute a local build when there is no preview URL — that is BLOCKED |
| **fresh-context-reviewer** | After the primary review loop reports clean | The change with **no memory of building it** — extends the previous reviewer no trust and re-derives the verdict. Self-review has a blind spot that no amount of re-checking removes: a reviewer who has already accepted a premise keeps accepting it | Close the run. It reports; someone else decides |
| *(gate step G10, mechanical)* | Every framework change | Live conformance vs `fixtures/expected-verdicts.json` — no fixture may go green → red | It is a script (`check-backward-compat.mjs`), not an agent: machines prove, agents judge |
| **implementation-builder** | Build stage, one per task, only on a validated 3+ task fan-out plan | Implements ONE task inside its declared file lane, against declared contracts | Write outside its `files`, change a declared signature, or run the gate. It reports `DONE` / `BLOCKED` / `CONTRACT-DEFECT` and stops |
| **post-release-monitor** | Deploy +1h, +24h | Groups production errors by **signature**, diffs against the pre-deploy window, checks for silent failures (jobs stopped, queues stalled, sends not sending) | Invent causation. Map a signature to the release only where the link is defensible |

---

## Which passes a change needs — the review matrix (added 05-Sep-2026)

Every spawned agent is a **cold start**: it re-reads the rules, the registers and the files
before it can say anything. Ten sequential cold starts per feature was the largest remaining
time sink after the process budgets — and most of them were reviewing a scoped change the
main agent had already analysed inline. Spawn by scale, never by habit:

| Pass | Micro run (≤2 files, no schema) | Scoped run (≤5 files, additive schema) | Full-scale / hotspot run |
|---|---|---|---|
| blast-radius-explorer | **Inline**, and small | **Inline** — the main agent does B2/A4's impact table itself | Spawn |
| implementation-planner | **Not run** — there is no plan to write | **Inline** — the plan is a section of `RUN_<feature>.md` | Spawn |
| parity-gate-checker | **Not run** — a schema change disqualifies micro | Only if the **schema** changed | Spawn if data is touched |
| code-reviewer | **Only when a shared/exported symbol is touched** — that is where two files become twenty | **Spawn — always.** It has no memory of building the change, so for a scoped run it IS the fresh context | Spawn |
| copy-gate-reviewer | Only if a **visible string** changed | Only if a **visible string** was added or altered | Same rule |
| permission-reviewer | **Not run** — a permission change disqualifies micro | Only if **roles, policies or tenant data** were touched | Same rule |
| fresh-context-reviewer | Not spawned | Not spawned — the spawned code-reviewer already satisfies it | Spawn, as a second pass after code-reviewer reports clean |
| test-gate-runner | **Inline** — `npm run gate`, read the verdict | **Inline** — the main agent runs `npm run gate` and reads the verdict | Spawn when the exit codes need independent interpretation |
| close-out-auditor | **Inline** | **Inline** — the DoD table is the close-out | Spawn |
| preview-smoke-verifier | **After merge when the change is user-visible**; a non-visual micro change states N/A with its reason | **Spawn — always**, after merge: the only stage that opens the running app | Same |
| post-release-monitor | Production only, unchanged | Production only, unchanged | Same |

**Whatever applies, spawn it in ONE message, in parallel** — never one reviewer after another.
Their boundaries are disjoint by design, so nothing is lost by running them together, and the
wall-clock cost of three reviewers becomes the cost of the slowest one.

**The same logic applies to BUILDING, with one hard limit.** `implementation-builder` lanes run
concurrently when the plan has 3+ independent tasks and `scripts/fanout-check.mjs` passes — that
is the only place in the run where generation, the slowest part, happens in parallel. But a
**reviewer still cannot run concurrently with the code it reviews**: a reviewer reading a
half-written file produces findings about code that no longer exists, which is rework wearing
the costume of speed. Build in parallel; review after.

## Using them

**With a coding agent** — one file per agent under your agent directory, each with its scope,
its boundary, and its verdict format. Invoke the ones the **matrix above** selects — the
descriptions in `.claude/agents/*.md` are gated to it, so a scoped change is not reviewed ten
times by ten cold contexts.

**Without one** — read the row as a review pass, and run the passes that apply. A UI-only change
needs the code, copy and preview passes; a schema change needs blast radius, parity and
permissions.

**One that is never optional:** `preview-smoke-verifier`. Static gates prove *consistency* —
that the code agrees with itself. Only opening the running application proves it *works*. Every
defect that reaches a user was, by definition, runtime-visible. (`fresh-context-reviewer` is
mandatory at full scale; for a scoped run the spawned `code-reviewer`, which built nothing, is
the fresh context by construction — a second one reviews the same diff with the same eyes.)
