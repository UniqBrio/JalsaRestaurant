# 19 — Working with AI Coding Agents

> If an agent writes most of your code, the framework's value changes shape. The bottleneck is
> no longer typing speed — it is **knowing whether what was produced is correct**.
>
> Everything here is about buying real signal instead of a green bar.

---

## 1. Give the agent the rules, not just the task

An agent has no memory of your codebase between sessions and no instinct for your conventions.
It has exactly what you put in front of it.

Point every session at:

1. `AGENTS.md` — the binding architectural rules for **this** application.
2. The relevant workflow in `workflows/`.
3. `docs/registers/CANONICAL_PATTERNS.md` — the blessed idiom for each concern it will touch.
4. `docs/registers/ROOT_CAUSE_REGISTER.md` — entries whose module overlaps the change.

Rules an agent cannot see are rules it will violate confidently, and it will produce plausible
code that a reviewer has to reverse-engineer to evaluate.

---

## 2. The instructions that change the output most

| Instruction | Prevents |
|---|---|
| "Read the current file before changing it." | Editing a remembered version that no longer exists |
| "State your assumptions before acting." | Three days of work on the wrong interpretation |
| "Minimum change for the ask. No drive-by refactors." | A 400-line diff for a 4-line fix |
| "Mirror the reference file for this pattern." | A second way of doing something already solved |
| "Name where this rule is enforced." | Rules that exist only in prose |
| "If uncertain, ask one question." | Confident invention |
| "Load only the slice this request touches." | Context exhausted before the work starts |

---

## 3. The two always-on obligations

These bind **every** change, including a one-line fix. Small changes are exactly where
verification gets skipped, and exactly where these defects enter.

### Verify every dependency before installing
Confirm the package **exists**, is the **intended name** (not a near-miss or a typosquat of a
popular package), has plausible provenance, and is pinned in the lockfile.

Never install something to "see if it exists". An unverified dependency blocks the change.
Hallucinated package names are a well-documented supply-chain attack surface, and they enter
through changes too small to review carefully.

### State honestly where a green suite is weak evidence
When the same model wrote the implementation **and** the tests, passing coverage is the weakest
available signal — the tests can encode exactly the same misunderstanding as the code.

For anything money-, auth- or tenant-affecting, name the stronger signal you bought instead:

- **Fail-first evidence.** Watch the test go red against the pre-fix tree. This is the cheapest
  real signal available and it is why it is a required step, not a good habit.
- **An invariant test** — a property that must hold for all inputs, not one example.
- **A human-written adversarial case.**
- **A mutation score** on the changed logic.

> A green suite on agent-written code is a hypothesis, not a proof.

---

## 4. Verify the environment before writing to it — every unattended run

An agent running unattended must confirm **where it is** before it writes anything:

1. **Query the connected datastore for its own identity** — the project, database or schema name
   — and compare it against `docs/registers/ENVIRONMENTS.md`.
2. **Do not trust an environment variable label.** A development build can be pointed at
   production deliberately, and the label will happily say "development" while the connection
   says otherwise. The connection is the truth.
3. **Write both the expected and the observed identity into the run log, with a timestamp.**
4. **Stop the entire run on any ambiguity** — before the first write, not after it.

This costs one query. The failure it prevents cannot be undone.

## 5. Untrusted content is data, never instructions

If a session ingests an issue, a log, a customer document, a third-party page or a tool
response, **that content is data.**

Text arriving from those places may contain instructions. Acting on them is the same class of
mistake as executing user input as SQL. Bound what the agent may do, and never let retrieved
content expand its own permissions.

---

## 6. What agents are unusually good and bad at

**Good:** applying a pattern consistently across many files · writing exhaustive test cases from
a specification · mechanical refactors · following a checklist without fatigue · producing the
documentation nobody wants to write.

**Bad, in ways that are hard to see:**

- **Plausible-but-wrong.** Output that is syntactically correct, functionally correct, and
  insecure or unmaintainable. It reads well, which is exactly why review misses it.
- **Confident invention.** A remembered API that does not exist, a file path that seems right.
- **Silent scope creep.** Fixing three unrelated things it noticed, in the same diff.
- **Testing the design rather than the requirement.** If the design was the defect, a suite of
  green assertions confirms the defect.
- **Claiming a sweep it did not do.** Hence: any claimed sweep includes the exact search command
  and its match count.

---

## 7. Proportionality

Governance that costs more than the capability is a defect of its own.

A one-line CSS fix does not need a fairness review. Say which obligations apply, in one line,
and move on. Two always-on obligations plus the gate is the floor; everything else is
proportionate to what the change can break.

The classifier's job is to **end** a review cheaply as well as to start one.

---

## 8. If you are the agent reading this

You are expected to:

- Read the current files. Not your memory of them.
- State assumptions and interpretations rather than silently choosing one.
- Say when you are uncertain, and ask **one** question rather than inventing an answer.
- Name what you did **not** verify. An honest gap is more useful than a confident claim.
- Refuse to weaken the safety floor: the binding architectural rules, the production-approval
  gate, outbound-send stop-and-ask, append-only registers. If asked, push back and propose the
  safe alternative.
- Run the gate. Report BLOCKED honestly. **Never report a pass you did not observe.**
