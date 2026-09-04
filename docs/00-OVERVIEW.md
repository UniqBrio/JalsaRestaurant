# 00 — Overview

> Read this first. It is the map.

---

## What this framework is

A **domain-agnostic operating system for building web applications**: a defined SDLC, runbooks
for each kind of change, quality gates that actually execute, a centralised theme system with
enforced contrast, and runnable starter code.

It is not a UI library, a boilerplate, or a project template. Those give you code. **This gives
you a repeatable process for producing code that stays correct**, plus the minimum machinery to
make the process enforceable rather than aspirational.

## What it is for

Any web application, any domain. The process, the gates and the theme system carry no business
assumptions. The reference implementation uses TypeScript and React with a Postgres backend, but
the principles are stack-neutral and the documents say which parts are which.

## The two ideas everything rests on

1. **A rule that nothing executes is not a rule.** Every rule here names the thing that runs it
   — or declares itself prose-only, honestly.
2. **Demand no-worse, not clean.** Every gate is a ratchet, so any rule can be adopted today on
   any codebase without a cleanup sprint.

Both are explained in [01-SDLC.md](./01-SDLC.md) and
[17-ENFORCEMENT-RATCHETS.md](./17-ENFORCEMENT-RATCHETS.md).

---

## The map

### Start here
| | |
|---|---|
| [01-SDLC.md](./01-SDLC.md) | **The spine.** Tracks, stages, gates, the learning loop. |
| [02-PROJECT-INITIALIZATION.md](./02-PROJECT-INITIALIZATION.md) | Day one, in order. |
| [03-PROJECT-STRUCTURE.md](./03-PROJECT-STRUCTURE.md) | Where everything lives, and why. |

### Building
| | |
|---|---|
| [04-ARCHITECTURE-AND-DESIGN.md](./04-ARCHITECTURE-AND-DESIGN.md) | Canonical patterns, where logic belongs, multi-tenancy, interface rules. |
| [05-CONFIGURATION-MANAGEMENT.md](./05-CONFIGURATION-MANAGEMENT.md) | Environments, secrets, flags, build identity. |
| [06-ERROR-HANDLING.md](./06-ERROR-HANDLING.md) | The taxonomy, the three things a handler must never do. |
| [07-SECURITY-AND-PRIVACY.md](./07-SECURITY-AND-PRIVACY.md) | Fail closed, layered authorisation, the five permission questions. |
| [08-CLOUD-INTEGRATION.md](./08-CLOUD-INTEGRATION.md) | Migrations, functions, jobs, webhooks, third-party APIs. |
| [09-CODE-QUALITY.md](./09-CODE-QUALITY.md) | Surgical discipline, diagnostic discipline, review. |
| [10-DOCUMENTATION-STANDARDS.md](./10-DOCUMENTATION-STANDARDS.md) | Modules, registers, the copy layer. |
| [23-DESIGN-CRAFT.md](./23-DESIGN-CRAFT.md) | The bar: what separates working from crafted — and the anti-gimmick rule. |
| [24-DESIGN-PLANNING.md](./24-DESIGN-PLANNING.md) | The method: discovery, IA-first, the pipeline, scoring, the iteration loop. |

### Appearance — colours, themes, contrast, assets
| | |
|---|---|
| [11-THEME-AND-COLOR-SYSTEM.md](./11-THEME-AND-COLOR-SYSTEM.md) | One source of truth for every colour. |
| [12-LIGHT-AND-DARK-THEMES.md](./12-LIGHT-AND-DARK-THEMES.md) | Three preference states, no flash, designing for both. |
| [13-CONTRAST-AND-ACCESSIBILITY.md](./13-CONTRAST-AND-ACCESSIBILITY.md) | Three gates, eight failure modes, accessibility beyond contrast. |
| [14-LOGO-AND-IMAGE-ASSETS.md](./14-LOGO-AND-IMAGE-ASSETS.md) | Per-theme artwork, four strategies, favicons. |

### Verifying
| | |
|---|---|
| [15-TEST-CASE-GENERATION.md](./15-TEST-CASE-GENERATION.md) | Machine-executable cases, the four dimensions, fail-first. |
| [16-TESTING-AND-VALIDATION.md](./16-TESTING-AND-VALIDATION.md) | Three tiers, three verdicts, assertions worth making. |
| [17-ENFORCEMENT-RATCHETS.md](./17-ENFORCEMENT-RATCHETS.md) | How rules become mechanical. |
| [18-BUILD-AND-DEPLOYMENT.md](./18-BUILD-AND-DEPLOYMENT.md) | Caching, expand/migrate/contract, rollback, monitoring. |

### Working with agents
| | |
|---|---|
| [19-AI-AGENT-GUIDE.md](./19-AI-AGENT-GUIDE.md) | The two always-on obligations, buying real signal. |
| [21-AGENT-WIRING.md](./21-AGENT-WIRING.md) | `.claude/` — the layer that makes the framework LOAD. |
| [22-FRAMEWORK-EVOLUTION.md](./22-FRAMEWORK-EVOLUTION.md) | Versioning, lineage, upgrade, promotion, fixtures. |
| [20-GLOSSARY.md](./20-GLOSSARY.md) | Every term this framework uses in a specific way. |

### The wiring
`.claude/` — slash commands, review agents, and the hook that runs the commit guards in every
session. See [21-AGENT-WIRING.md](./21-AGENT-WIRING.md). Without this the rest is documentation.
`CLAUDE.md` at the repository root carries the binding rules, read before every task.

### The runbooks
`workflows/` — [request (intake)](../workflows/request.md) ·
[feature](../workflows/feature.md) · [enhance](../workflows/enhance.md) ·
[bug](../workflows/bug.md) · [refactor](../workflows/refactor.md) ·
[triage](../workflows/triage.md) · [brainstorm](../workflows/brainstorm.md) ·
[test gate](../workflows/test-gate.md) · [promote](../workflows/promote.md) ·
[framework update](../workflows/framework-update.md)

### The point-of-use checks
`checklists/` — screen · design quality *(the Gate 3 judge)* · definition of done ·
code review · security · accessibility · release readiness · business readiness · manual test

### The living registers
`docs/registers/` — root causes · canonical patterns · design rules · known limitations ·
permissions · feature truth · product lexicon · AI governance · candidates (promotion parking
lot) · environments · test accounts · technical debt · decisions

---

## How to actually use it

**Starting a new application** → [02-PROJECT-INITIALIZATION.md](./02-PROJECT-INITIALIZATION.md).

**Doing a piece of work** → classify it ([01](./01-SDLC.md) §2), open that runbook, follow it.
Or simply start every piece of work at [workflows/request.md](../workflows/request.md)
(`/request`) — it writes the binding request file and continues into the right track by
itself; stated fields bind, `unknown` fields become the track's questions, and the track's
first gate restates the FIELDS for correction.

**Adopting this on an existing codebase** → [17](./17-ENFORCEMENT-RATCHETS.md) §8. Baseline
first; nothing is blocked on day one that was not already broken.

**Something went wrong** → [workflows/bug.md](../workflows/bug.md). If the *process* should have
caught it, also [workflows/framework-update.md](../workflows/framework-update.md).

**An app learned something general** → [workflows/promote.md](../workflows/promote.md)
(`/promote`) — classify, park at n=1, promote at n=2 from a different app.

**Upgrading an app to a newer framework** → `npm run framework:upgrade` in the app, or
[22-FRAMEWORK-EVOLUTION.md](./22-FRAMEWORK-EVOLUTION.md).

---

### The executable parts
`scripts/` — the gate (`gate-runner.mjs`, eleven steps) · the theme build and its checks ·
the audits (`check-hardcoded-colors` · `check-testid-coverage` · `check-rule-coverage` ·
`check-column-control` · `check-dead-weight` · `check-backward-compat`) · the commit guards
under `hooks/` · and the evolution tooling (`lineage.mjs` · `upgrade.mjs` · `conformance.mjs`),
with shared engines in `lib/` (`ratchet` · `color` · `layout` · `lineage`).

---

## The honest part

Not every rule here is mechanically enforced. Some are review items, and the documents say
which. `scripts/audits/check-rule-coverage.mjs` counts the unenforced ones so the number can be
seen and reduced.

Saying which rules are *not* enforced is the difference between a process and a poster.
