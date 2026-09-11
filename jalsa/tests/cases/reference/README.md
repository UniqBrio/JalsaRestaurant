# Reference specs — kept as shapes, not run as assertions

These two files arrived with the scaffold. They are the framework's **worked examples** of a
journey spec and a keyboard-parity spec, and they assert against the starter's demo screen
(`list-add`, `item-name`, `item-form-mode`, `confirm-accept`) — a screen Jalsa deliberately does
not have.

They were moved here from `tests/functional/` on 10-Sep-2026, unedited. Nothing was overwritten
and no Jalsa assertion was lost: they had never encoded anything about this application, and
every one of their eighteen cases had been red since the scaffold was created.

**Why moved rather than left red.** A permanently-failing suite is the fastest way to an ignored
suite, and an ignored suite is worse than no suite — it looks like coverage. The framework's own
rule is that a dead gate must be audible; the audible version of this one is a directory that
says out loud what it is.

**Why moved rather than deleted.** They are the reference shape an adopting screen is written
against, and they are worth reading before writing the next Jalsa journey. The canonical copies
live in the framework at `starter/tests/functional/`.

## The rungs these carry, and where Jalsa stands on each

| Rung | Framework pattern | Jalsa status |
|---|---|---|
| Journey, empty → save → error | — | **Executed** — `tests/functional/signin.functional.spec.ts` |
| Geometry at a short viewport | — | **Executed** — `signin.functional.spec.ts`, `degraded.functional.spec.ts` |
| Keyboard parity | CP-22 | **Executed** — `tests/functional/keyboard-signin.functional.spec.ts` |
| Edit opens populated; unchanged save is a no-op | CP-25 | **NOT EXECUTED** — the menu-item editor is in the owner console, behind the database |
| Archive semantics, round-tripped through a re-read | CP-26 | **NOT EXECUTED** — same |
| Two records with the same name stay distinguishable | CP-26 | **NOT EXECUTED** — same |

The three NOT EXECUTED rungs were blocked by KL-1 until 11-Sep-2026. **KL-1 is now closed** —
`tests/functional/reachability.functional.spec.ts` proved the configured instance reaches the
seeded database in CI (run 34577750747) — so nothing blocks them any more. They are a **coverage
gap**, and the first thing to write: each needs a test that runs only in CI and, because the only
project is the seeded one, writes nothing it does not clean up.
