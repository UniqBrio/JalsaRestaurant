# 02 — Starting a New Application

> Everything below happens **before** the first feature. Each item is here because retrofitting
> it costs an order of magnitude more than installing it, and because a project that skips it
> spends its first year paying interest.

---

## Day one, in order

### 1. Name the thing, and write the one-paragraph brief
What this application does, for whom, and what "working" means. Three sentences in the README.
If you cannot write it, the requirements are not ready and no amount of scaffolding helps.

### 2. Scaffold
```bash
node scripts/new-app.mjs --name my-app --dir ../my-app
cd ../my-app && npm install
```
Or copy `starter/` and adapt. The starter is a **shape**, not a lockfile — install the versions
current when you scaffold, verify each package is the intended one, and commit the lockfile.

### 3. Set the colours — before writing any UI
Edit `design/tokens.json`: brand colours, then any semantic role that should follow them.

```bash
npm run theme:build && npm run theme:contrast
```

Do this now. Every component written before the token system exists will contain a literal, and
every one of those literals is a future dark-mode defect.

### 4. Add the brand assets — both themes
Two logo files, two illustration files, favicons. Declare them in `design/tokens.json`.

```bash
npm run theme:assets
```

### 5. Decide the environments and write them down
`docs/registers/ENVIRONMENTS.md`: name, purpose, URL, database identifier, who may write to it,
and which is **never** an automated target.

Ambiguity here is what produces "which database did that test just write to?" — a question with
no good answers.

### 6. Enable strictness
Strict type checking, no implicit `any`, unchecked index access on. **Turning strictness on
later means paying for every unsound line written in between**; turning it on now costs nothing
because there is no code yet.

### 7. Install the guards
```bash
npm run guard:install     # the pre-commit hook
npm run guard:test        # prove every guard can still fire
```

### 8. Create the registers, empty
Copy from `docs/registers/`. They are worth almost nothing on day one and a great deal by month
six — and they only work if entries were added as things happened, which cannot be done
retroactively.

### 9. Write `CLAUDE.md`
The binding architectural rules for **this** application: how authentication works, how data is
fetched, what must never happen. Short, specific, and read before every task.

Each rule states what, **why**, and **where it is honoured in code** — a rule with no file
reference cannot be checked, and will drift.

The scaffolder already generated it from
[templates/docs/AGENTS.md](../templates/docs/AGENTS.md), along with `.claude/` (slash commands,
review agents, and the hook that runs the guards). Fill in the rules; the wiring is done.
See [21-AGENT-WIRING.md](./21-AGENT-WIRING.md).

### 10. Set up CI
Copy `ci/github-actions-ci.yml`. It runs the same gate runner developers run locally — if CI
and local run different checks, one of them is decoration.

### 11. Prove the pipeline end to end with something trivial
Ship a health-check endpoint through the **entire** process: plan, build, test gate, deploy,
verify. Do this while the stakes are zero.

You will find three broken things. Finding them now, on an endpoint that returns `{"ok":true}`,
is the cheapest debugging you will ever do.

---

## The initialization checklist

```
[ ] Brief written (3 sentences)
[ ] Repository created, starter scaffolded, lockfile committed
[ ] design/tokens.json branded; theme:build and theme:contrast pass
[ ] Brand assets present for both themes; theme:assets passes
[ ] .env.example complete; every variable documented; no real values
[ ] docs/registers/ENVIRONMENTS.md names every environment and who may write to it
[ ] Strict type checking on; lint configured with rules that decide correctness, not taste
[ ] Pre-commit guards installed; guard:test passes
[ ] Registers created (root causes, canonical patterns, limitations, permissions, features)
[ ] CLAUDE.md written; .claude/ present and the hook fires (npm run guard:test)
[ ] CI runs the gate runner
[ ] One trivial change taken through the FULL pipeline to production
[ ] Rollback executed once, deliberately, while nothing is at stake
```

That last line is not optional. A rollback procedure that has never been executed is a
hypothesis, and the moment you need it is the worst possible moment to test it.

---

## What NOT to do on day one

| Temptation | Why to resist |
|---|---|
| Build the design system first | You do not know what components you need. Build three screens, then extract what repeated. |
| Add a state-management library | Most applications need less than they think. Add it when local state demonstrably fails. |
| Design the full schema | Design the schema for the first feature. The rest is speculation you will migrate away from. |
| Set up feature flags, i18n, analytics, A/B testing | Each is a real cost paid now for a benefit that may never arrive. Add on demand. |
| Skip the registers because "there is nothing to record yet" | Their value is entirely in having been kept from the start. |
