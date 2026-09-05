# AGENTS.md

See [CLAUDE.md](./CLAUDE.md) — the binding rules for this repository live there, and only there.

This file exists so tools that look for the vendor-neutral name (Codex and others) find them
too. It is a pointer **on purpose**: two files of rules become two *different* sets of rules —
the previous full copy here had already drifted (it named a `.codex/commands/` folder that does
not exist, and its runbook list lacked `/request`). The same convention is what
`scripts/new-app.mjs` writes into every scaffolded application.

The Codex wiring itself lives in `.codex/` (agent definitions, the hook adapter, `hooks.json`);
see [docs/21-AGENT-WIRING.md](./docs/21-AGENT-WIRING.md).
