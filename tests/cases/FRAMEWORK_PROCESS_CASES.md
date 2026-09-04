# Framework process cases

> Cases for the **process's own behaviour** — a runbook step runs or is skipped, a field binds
> or is overridden. Executed manually by running the named runbook against the given input;
> Automation = Manual is honest here because the system under test is an agent following prose,
> which no spec file can execute. Lifecycle per `starter/tests/cases/README.md`:
> add / update-in-place / retire-only-on-removal, IDs never reused.

**Fail-first evidence (docs/15 §6):** cases FW-INTAKE-001..006 and FW-ENH-001..003 were run in
spirit against the pre-change tree by the failure that motivated them: rough one-line requests
fed to `/enhance` and `/feature` produced silent assumption-filling, no defined design pass for
visual corrections, and repeated correction-on-correction rounds (owner report, 04-Sep-2026).
Each case below encodes one observed shape of that failure.

| ID | Title | Input / steps | Expected | Negative (must NOT happen) | Date |
|---|---|---|---|---|---|
| FW-INTAKE-001 | Rough "does not exist yet" ask classifies NEW and flows to Track A | `/request` with a description of a capability the codebase lacks | REQUEST_NEW filled; file written to `requests/<date>-<slug>.md`; the SAME run continues into workflows/feature.md, whose Gate 1 opens by restating the FIELDS "from your request - correct anything wrong" | Any field invented beyond the requester's words; the run ending by asking the requester to run a second command; Gate 1 proceeding without restating the FIELDS | 2026-09-04 |
| FW-INTAKE-002 | "Works but should differ" vs "broken" boundary | Two `/request` runs: (a) "export should also offer CSV"; (b) "export gives wrong totals since last week" | (a) → REQUEST_CHANGE / Track B; (b) → REQUEST_BUG / Track C with error selectivity captured verbatim | (b) classified as CHANGE (skips root cause); (a) classified as BUG | 2026-09-04 |
| FW-INTAKE-003 | Uncovered field = `unknown`, never invented | `/request` with a description that names no users, no repro, no priority | Every uncovered field literally `unknown` (or the template's stated default); MUST NOT CHANGE defaults to "everything not named in DESIRED BEHAVIOUR" | Plausible-sounding invented users/steps/priorities in any field | 2026-09-04 |
| FW-INTAKE-004 | List / open situation / process failure continue directly, with NO file | Three `/request` runs: a 5-item list; a "what should happen when…" situation; "the gate never caught it" | No request file; the SAME run continues into workflows/triage.md, brainstorm.md, framework-update.md respectively, each stopping at its own gate | A file generated for any of the three; the run stopping to ask the requester to retype into a second command | 2026-09-04 |
| FW-INTAKE-005 | Mixed input keeps both halves | `/request` with "the price bug shipped AND the pipeline never caught it" | REQUEST_BUG written for the app half AND the same run handles both: framework-update first (diff-approval gate), then Track C with the file (FIELDS restated at its first stop) | Either half silently dropped; either half left as advice for the requester to run later | 2026-09-04 |
| FW-INTAKE-006 | Re-correction records the round | `/request` with "the export STILL shows old columns after last week's fix" | CORRECTION ROUND ≥ 2 recorded with a pointer to the previous attempt (or `unknown`) | Round field absent or reset to 1 | 2026-09-04 |
| FW-ENH-001 | Stated fields bind; `unknown` fields become questions | `/enhance requests/<file>` where the file states the screen and marks WHY `unknown` | B3 asks about WHY (and only genuine unknowns); the stated screen is never re-asked or overridden; arriving from `/request` in the same run, the first stop opens by restating the FIELDS for correction | A stated field re-asked, or silently overridden by an assumption; a same-run arrival proceeding without the FIELDS restated | 2026-09-04 |
| FW-ENH-002 | Visual correction carries the defined design pass | `/enhance` with a change touching a rendered surface | B4 plan contains all four rows: states · both themes in semantic tokens · string table · permission answer (each or a per-row reasoned N/A) | Plan reaching approval with the pass absent and no "not visual" claim | 2026-09-04 |
| FW-ENH-003 | "Not visual" is checked against the diff | Plan claims "not visual"; the diff then touches a rendered file | B6 voids the claim; the B4 correction design pass runs before the change proceeds | Merge proceeding on the voided claim | 2026-09-04 |
| FW-ENH-004 | Round ≥ 2 explains the previous miss first | `/enhance requests/<file>` with CORRECTION ROUND: 2 and a pointer | B1 states what the previous attempt missed and why, BEFORE any proposal; process-fault misses flagged for `/framework-update` | A new fix proposed with no account of the previous one | 2026-09-04 |

**Delta 2026-09-04 (v1.4.0):** added FW-INTAKE-001..006, FW-ENH-001..004; updated none; retired none.
**Delta 2026-09-04 (v1.5.0):** added none; updated FW-INTAKE-004, FW-INTAKE-005 (routed-out
classifications now continue in the same run instead of instructing the requester); retired none.
**Delta 2026-09-04 (v1.6.0):** added none; updated FW-INTAKE-001, FW-INTAKE-005, FW-ENH-001
(file-producing classifications also continue in the same run; the field review moves to the
track's first gate, which restates the FIELDS); retired none.
