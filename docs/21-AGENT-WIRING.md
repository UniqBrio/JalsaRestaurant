# 21 — Agent Wiring (`.claude/`)

> **This is the layer that makes the framework LOAD rather than merely exist.**
>
> Without it, the runbooks are documents nobody opens and the guards are shell scripts nobody
> invokes. The content is not the system; the content plus the wiring is the system.

---

## What is in `.claude/`

```
.claude/
├── settings.json                    Wires the commit guard as a PreToolUse hook. COMMITTED.
├── settings.local.json.example      Personal overrides. The real file is gitignored.
├── commands/                        Slash commands: /request /feature /bug /enhance
│                                    /refactor /triage /brainstorm /test /gate /framework-update
├── agents/                          Eleven review sub-agents, each with a boundary and a verdict
└── hooks/
    ├── pre-tool-use-guard.mjs       Bridges the hook protocol to the git guard
    └── adapter.test.sh              EXECUTES the adapter against the protocol
```

---

## Slash commands are pointers, never copies

`.claude/commands/feature.md` does not contain the feature runbook. It says: *read
`workflows/feature.md` in full, then follow it.*

**Duplicating a runbook guarantees two versions, and the drifted one is always the one someone
finds first.** The shim carries only what is genuinely command-specific — the grounding steps and
the one governing instruction for that track — and routes to the single source of truth for
everything else.

The cost is one extra file read. The alternative is a slow, silent divergence between the
document you maintain and the document the agent actually follows.

---

## The hook, and why it needs an adapter

`.claude/settings.json` registers a `PreToolUse` hook on `Bash`. It fires on **every** shell
command, in **every** session — including the ad-hoc five-minute fix that never opened a runbook.

That is precisely the session where close-out obligations get skipped, so that is exactly where
enforcement belongs.

### The adapter exists because the two hooks see different worlds

| | git `pre-commit` | Claude Code `PreToolUse` |
|---|---|---|
| Runs | after the message is written | **before the command executes** |
| The message is in | `.git/COMMIT_EDITMSG` | **the command string itself** |
| The change is in | the staged index | the staged index |

Reading `COMMIT_EDITMSG` from a `PreToolUse` hook finds the **previous** commit's message. That
silently voids every escape token and blocks work that was correctly justified — which is worse
than no guard, because it trains people to disable it.

So `pre-tool-use-guard.mjs` recovers the escape text the way each mode expresses it:

- **commit** — parses `-m "…"`, `-m '…'`, `--message=`, a heredoc, or `-F <file>` out of the command
- **push** — reads the commit range being pushed, via `PRE_PUSH_RANGE`

> This is the general rule, and it is easy to get wrong in either direction:
> **a guard must read the same CHANGE in both modes, not the same STRING.**

### Protocol

| Exit | Meaning |
|---|---|
| `0` | allow |
| `2` | **block** — stderr is shown to the agent as the reason |
| anything else | treated as non-blocking |

A bug in the adapter therefore **cannot wedge a session** — it fails open, loudly. Same contract
as the guards themselves.

`--no-verify` skips git's own hooks. It does **not** skip this one: guards one flag away from
being decorative are decorative.

### It is tested by execution, not inspection

`bash .claude/hooks/adapter.test.sh` — nine cases covering routing, blocking, escape-token
recovery from both `-m` and heredoc forms, `--no-verify`, malformed input, and the fail-open path.

**A correct guard behind a broken adapter enforces exactly nothing, and looks installed.** A
source scan cannot tell those apart; running it can.

---

## `CLAUDE.md`

Read before every task. It holds the **binding architectural rules for this specific
application** — not general practice, which lives in `docs/`.

Keep it to about one page. A file nobody finishes reading is a file nobody follows.

Each rule states three things:

1. **What** must always or never happen.
2. **Why** — the incident or property that makes it non-negotiable.
3. **Where it is honoured in code** — a file path.

A rule with no file reference cannot be checked, and will drift.

`new-app.mjs` also writes an `AGENTS.md` that **points at** `CLAUDE.md`, for tools looking for the
vendor-neutral name. It is a pointer on purpose: two files of rules become two *different* sets of
rules.

---

## What is committed, and why it matters

| Committed | Reason |
|---|---|
| `.claude/settings.json` | **Settings that live on one machine enforce nothing on anyone else.** |
| `.claude/commands/`, `agents/`, `hooks/` | The process travels with the repository |
| `.baselines/` | A ratchet with an uncommitted baseline is not a ratchet |
| `TEST_SUMMARY.md` | The append-only log guard G2 greps for |

| Ignored | Reason |
|---|---|
| `.claude/settings.local.json` | Personal overrides cannot weaken a guard for the team |

**Disabling a guard locally is a decision, not a workaround.** Prefer the per-guard escape token
in the commit message — that one is auditable in git history, which is the entire point.

---

## Using it without Claude Code

Everything degrades cleanly:

- **Commands** → open the `workflows/` file and follow it. That is where the content lives anyway.
- **Agents** → read `workflows/agents/README.md` as review *passes* and run the ones that apply.
- **The hook** → `npm run guard:install` installs the same guards as a plain git `pre-commit`
  hook. Same script, same guards, same escape tokens.

The framework does not depend on any particular tool. `.claude/` is the wiring for **one** tool,
kept in one directory precisely so that swapping it is a contained change.
