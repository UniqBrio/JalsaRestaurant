# Fixtures — the framework's own test apps

> Three tiny, domain-free apps that exist for one purpose: **a framework change is applied to
> each and must not break any of them.** They are the mechanical half of validation — machines
> prove it does not break; agents judge whether it is good.

| Fixture | It is… | It proves… |
|---|---|---|
| `minimal/` | a bare scaffold, never touched | the happy path: a pristine app upgrades cleanly, everything auto-applies |
| `with-debt/` | carries **deliberately baselined violations** | **a new gate does not turn an existing app red** — the constraint "existing features must not break", tested instead of asserted |
| `diverged/` | has **deliberately modified seed files** | an upgrade never clobbers an app's edits — modified files go to review, never overwrite |

## Rules

- Fixtures are **domain-free**. A business word appearing in a fixture is a defect — it would
  quietly turn the conformance suite into one app's regression suite.
- Fixtures are **governed files** (see `workflows/framework-update.md`): changing what a fixture
  contains changes what conformance proves, so it carries test cases like any process change.
- `with-debt`'s debt and `diverged`'s divergence are **load-bearing**. "Cleaning them up" would
  delete the very conditions they exist to test. Each carries a marker comment saying so.

## Running

```bash
node scripts/conformance.mjs              # apply framework to each fixture, run checks, verdict
node scripts/audits/check-backward-compat.mjs   # conformance vs the committed expectations
```

Wired into `gate-runner.mjs` (step G10) and CI. A framework change that skips conformance is
BLOCKED, not green.
