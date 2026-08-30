# Worked example

The framework's own construction is the worked example, and it is more honest than a
purpose-built one because the defects in it were real.

**Four entries in [the root-cause register](../docs/registers/ROOT_CAUSE_REGISTER.md)** were
found by these gates while the framework was being built:

| | What the gate caught |
|---|---|
| **RC-001** | A reachability test that asserted on the wrong guard — a green result would have proven nothing about the guard under test. |
| **RC-002** | A documentation guard that was live, reachable, executing — and could never fire, because it accepted the gate's own output as documentation. |
| **RC-003** | A rule-coverage audit blind to `.tsx` references, reporting **unverified claims as accepted debt** — under-reporting the exact class it exists to find. |
| **RC-004** | The gate runner reporting a *missing tool* as FAIL rather than BLOCKED — a false failure, which is how a gate loses the trust that makes it work. |

Each entry follows the register format, and each ends with the binary process question. Three
answered "yes" and produced a process change; one answered "no" — the test found the defect on
its first run, which is what it was written for.

## What to take from it

**Every one of the four is a detector defect, not an application defect.** That is not a
coincidence. Detectors are the least-tested code in most projects, because there is nothing
watching *them* — and a detector that silently reports nothing is indistinguishable from a
codebase with nothing to report.

Which is the argument for the two rules that found them:

- **Fail-first evidence** — run the check against a state you *know* is broken, and watch it go
  red. A check never observed failing is not evidence that it can fail.
- **Executable reachability proof** — run the guard, do not read it. A source scan cannot tell a
  live guard from a commented-out one, and it certainly cannot tell that guard 3 became
  unreachable because guard 2 started exiting on success.
