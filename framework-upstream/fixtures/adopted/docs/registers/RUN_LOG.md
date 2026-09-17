# Run Log

> The fixture app that has **adopted the registers**. Newest first.
>
> This file is not decoration: its presence is what makes guard G9 live for this fixture, and
> `conformance.mjs` stages a change against it to prove the guard still fires. An app that keeps
> its run log is the app that must never be turned red by a framework release — that is the
> whole job of this fixture.

| ID | Action | Type | Scale | Started | Ended | Total | Stages | Gate | Verdict | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| R-002 | Close the run properly, so the next release can prove it still can | CHANGE | micro | 2026-09-11 09:10 | 2026-09-11 09:14 | 4m | build 2m · gate 2m | PASS | PASS | the shape G9 requires |
| R-001 | Adopt the registers | CHANGE | scoped | 2026-09-10 14:00 | 2026-09-10 14:22 | 22m | - | PASS | PASS | - |
