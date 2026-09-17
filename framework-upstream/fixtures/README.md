# Fixtures — the framework's own test apps

> Three tiny, domain-free apps that exist for one purpose: **a framework change is applied to
> each and must not break any of them.** They are the mechanical half of validation — machines
> prove it does not break; agents judge whether it is good.

| Fixture | It is… | It proves… |
|---|---|---|
| `minimal/` | a bare scaffold, never touched | the happy path: a pristine app upgrades cleanly, everything auto-applies |
| `with-debt/` | carries **deliberately baselined violations** | **a new gate does not turn an existing app red** — the constraint "existing features must not break", tested instead of asserted |
| `adopted/` | has **adopted the registers** — a real `docs/registers/RUN_LOG.md` with rows | that an app which keeps its run log **stays green**: guard G9 blocks a code change with no row *and* is satisfied by one, and an upgrade is refused while a run is open *and* proceeds once it is closed. It exists because v2.0.0 and v2.1.0 both cited a passing `audit:compat` as proof that no app goes green → red, and **both citations were worthless**: no fixture carried a run log, so every new rail failed open and the green tick measured nothing |
| `diverged/` | has **deliberately modified seed files**, and **artifacts generated from its own tokens** (a manifest, a theme module) | an upgrade never clobbers an app's edits — modified files go to review, never overwrite — and never replaces what the app generated from an app-owned source with the framework's copy |

## Rules

- Fixtures are **domain-free**. A business word appearing in a fixture is a defect — it would
  quietly turn the conformance suite into one app's regression suite.
- Fixtures are **governed files** (see `workflows/framework-update.md`): changing what a fixture
  contains changes what conformance proves, so it carries test cases like any process change.
- `with-debt`'s debt and `diverged`'s divergence are **load-bearing**. "Cleaning them up" would
  delete the very conditions they exist to test. Each carries a marker comment saying so.
- `adopted`'s `RUN_LOG.md` is load-bearing in the same way: **deleting it does not make the
  fixture simpler, it makes it blind**, because every rail it tests fails open without it. Its
  checks isolate guard G9 with the other guards' escape tokens — without that, the blocking
  check passes on the *test-case* guard's identical exit 2 and proves nothing. It did exactly
  that on the first attempt.
- **A fixture that cannot go red proves nothing.** Each new check here was run against a
  framework with the rail deliberately removed, and had to fail. `adopted` was: both rail checks
  failed and named themselves.

## Running

```bash
node scripts/conformance.mjs              # apply framework to each fixture, run checks, verdict
node scripts/audits/check-backward-compat.mjs   # conformance vs the committed expectations
```

Wired into `gate-runner.mjs` (step G10) and CI. A framework change that skips conformance is
BLOCKED, not green.
