# Changelog

## 1.35.0 — A decision recorded only in a comment, in a file nothing ran - and the CI that could not see the class it was written for

v1.33.0 decided deliberately that the starter declares RANGES and ships no lockfile: it is a shape to copy, not a pinned tree. That decision was written down in THREE places and enforced in none: a comment inside ci/github-actions-ci.yml (a file which had never been copied into .github/workflows/, so it had never executed anything), and twice in docs/02-PROJECT-INITIALIZATION.md - "the starter is a shape, not a lockfile", and "lockfile committed" in the app's own checklist, which is the correct opposite rule for an app. That is the finding, sharper than "it was undocumented": the prose was right, repeated and consistent, and it still changed nothing, because no prose is reachable from fs.readdirSync. Meanwhile new-app.mjs's SKIP set listed only build output, because a lockfile is not build output and nobody had asked whether it should be SEEDED. So a routine npm install in starter/ left a lockfile that nothing ignored and the scaffolder copied byte-for-byte into every new app - verified by running the scaffolder, not by reading it - and since an app commits its lockfile, every app born from that checkout would have carried one machine's dependency resolution from one afternoon, permanently. The intent existed, was correct, and was enforced by nothing: CLAUDE.md's first idea applied to a decision rather than a rule. The second half of this release is the reason the first half was found late. RC-012 was a defect class visible only where the shell's path namespace and the interpreter's disagree, and CI ran ubuntu only, where they agree - so twelve false accusations would have sat behind a green pipeline indefinitely. Full analysis: docs/registers/ROOT_CAUSE_REGISTER.md RC-013, and decision 003 for the CI shape.

Added: A second CI job, self-tests-windows: audit:all and guard:test on windows-latest with shell bash, because the suites are bash scripts and the runner's default is pwsh. Deliberately NOT a mirror of the gate job - no browsers, no application gate, since those exercise the app's toolchain and that is not where the class lives. Decision 003 records the four options rejected, including the obvious one (an OS matrix over the whole gate, which roughly doubles the bill to re-prove what ubuntu already proved) · RC-013 and decision 003; cases FW-SEED-001..002 and FW-CI-001

bash scripts/upgrade.test.sh -> 42/42, including the new planted-lockfile case, which was OBSERVED FAILING against the pre-fix new-app.mjs (reverted via git stash, run, restored) - the only reason it is worth keeping. It plants a lockfile in starter/, scaffolds a real app, asserts the file did not arrive, and removes the plant; the plant is gitignored by this same release, so an interrupted run leaves no trace . the propagation it prevents was measured before the fix: a real scaffold carried the lockfile across at 81,552 bytes, byte-for-byte . the SKIP addition was checked against copy()'s other callers first - HALF_A is a list of directories and the framework's own root lockfile sits above all of them, so only the starter copy is affected . the CI file was PARSED, not eyeballed: both jobs resolve, gate on ubuntu-latest with 12 steps, self-tests-windows on windows-latest with 5 steps and shell bash . that job's two commands are already proven on this platform - npm run audit:all -> 11/11 and npm run guard:test -> 14/14 were run on Windows before the job was written . npm run gate -> VERDICT PASS, 12 pass, 0 fail, 0 blocked . MINOR, so npm run audit:compat was run: all three fixtures PASS (as required), no existing app goes green -> red.
## 1.34.0 — Three suites were accusing correct code: a path crossing into JavaScript source is data, and nothing translates it

npm run guard:test reported 10/13 off POSIX. The ratchet suite failed 6 of 9 assertions, theme-build 3 of 11, pwa-baseline 3 of 13 - and every subject those assertions named was correct. A path used as ARGV is translated by the shell on the way out, so `node "$ROOT/x.mjs"` resolves everywhere; the same string interpolated into JavaScript SOURCE - an import specifier, a readFileSync argument - is data, nothing rewrites it, and Git Bash's /c/Explorations/... reached Node as C:\c\Explorations\.... Ten of the thirteen suites pass paths only as argv, which is exactly why the distinction stayed invisible until the three that do not were run off POSIX. Two things turned a portability bug into a diagnostic one: the failures were reported as defects in the SUBJECT rather than as a harness that could not run - the third verdict exists for precisely this, and a bash harness had no way to say it - and 2>/dev/null on the node -e calls discarded the ERR_MODULE_NOT_FOUND and ENOENT that named the cause outright. The sweep added here found a fourth site nobody was looking for: scripts/upgrade.test.sh had the same defect and was NOT failing, because a || sed fallback silently absorbed the broken require() and produced the right answer by a route nobody intended. Two of the four shapes this class takes do not announce themselves, which is the whole argument for a sweep rather than three fixes. Full analysis: docs/registers/ROOT_CAUSE_REGISTER.md RC-012.

Added: scripts/lib/shpath.sh - jspath for anything fs opens, jsurl for an ESM specifier. Two functions because it is two requirements: a bare C:/... is rejected as ERR_UNSUPPORTED_ESM_URL_SCHEME, the drive letter parsing as a URL scheme. Where cygpath is absent - every POSIX system - the path is already the form Node wants, so passthrough is the correct answer rather than a degraded one · scripts/shpath.test.sh - 7 assertions, wired into npm run guard:test (now 14 suites). Case 3 asserts the bare native path is STILL rejected, so the day jsurl becomes redundant that is reported rather than assumed. Case 4 sweeps every shell harness in the tree; case 4a fails if it read fewer than 8 files, because a sweep over zero files reports clean and means nothing; case 5 plants a violation and proves the sweep fires on it · CP-31 in the canonical patterns register - argv is translated, source is not - and cases FW-PATH-001..004

bash scripts/ratchet.test.sh -> 9/9 (6 observed failing pre-fix) . bash scripts/theme-build.test.sh -> 11/11 (3 observed failing pre-fix) . bash scripts/pwa-baseline.test.sh -> 13/13 (3 observed failing pre-fix) . bash scripts/shpath.test.sh -> 7/7, and its own sweep was observed failing first: the initial regex was mangled by shell quoting and matched ZERO lines in the broken tree AND the fixed one, which reads exactly like a clean result - caught by case 4a, the companion assertion that fails when the sweep read too few files, before the verdict was trusted . scripts/upgrade.test.sh: NOT OBSERVED FAILING pre-fix, and that is the point - its || sed fallback absorbed the broken require() and returned the right answer, so the defect was found by the sweep rather than by a red test, and fixed on inspection . the three fixed suites were each re-run against the pre-fix tree to record the failure counts above . npm run audit:all -> 11/11 . npm run guard:test -> 14/14 suites . npm run gate -> VERDICT PASS, 12 pass, 0 fail, 0 blocked, slowest G8 1m 13s . MINOR, so npm run audit:compat was run: all three fixtures PASS (as required), no existing app goes green -> red.

## 1.33.0 — The starter declares its toolchain, and the gate is green for the first time

For thirty-one recorded runs the gate reported G5-G8 BLOCKED with the remediation 'run npm install', and every run - this framework's own included - accepted that as a fact about the environment. It was a claim, and nobody executed it. Running npm install in starter/ installed nothing, because starter/package.json declared no dependencies at all: 'a shape, not a lockfile' had been read as 'declare nothing' rather than 'pin nothing'. The registry was reachable the whole time. So the four application gates were structurally un-runnable everywhere, CI included, and everything they would have caught accumulated unseen for the reference implementation's whole life: 44 type errors under the starter's own strict settings, 7 lint findings and no lint configuration, a unit tier that booted the entire application and timed out, functional specs written against a route that served a 404, a configuration module whose PUBLIC_* values were undefined in every browser because it read process.env dynamically, a dialog whose class names no stylesheet defined, a tab row whose mount-time scrollIntoView made the first Tab skip the active tab, data assertions that raced one run in four, and two test projects on an engine the CI template never installs. Ten findings, one cause: a gate that cannot run finds nothing, and 'nothing found' is indistinguishable from 'nothing wrong' for exactly as long as it stays blocked. RC-009 made the block honest and RC-010 made the streak visible; this is what was behind it. The gate now reports 12 PASS, 0 FAIL, 0 BLOCKED - the first fully green run in the ledger.

Added: starter/package.json declares its toolchain as ranges - typescript, eslint, @playwright/test, next, react, dotenv - so npm install produces one. Every name was verified against the registry before being written. Still no lockfile: the shape is kept, the emptiness is not · The reference screen: src/app/page.tsx -> src/features/items/ (types, api, ItemsScreen, ItemForm), composing TabRow, ListControls, Dialog, ConfirmDialog and ToastHost and building none of them. Archive model (CP-26), edit parity (CP-25), a re-read after every write, and Save that hands control back at once with the draft restored on failure. Documented in starter/docs/modules/items.md · starter/eslint.config.js for gate G6, and starter/next.config.mjs to carry PUBLIC_* into the client bundle · Dialog, ConfirmDialog and the reference list have styles - semantic tokens only. They had rendered class names no stylesheet defined for as long as they existed · Cases FW-GATE-001..005; RC-011 in the root cause register

npm run gate -> VERDICT: PASS, 12 pass, 0 fail, 0 blocked, 1m 14s, slowest G8 (1m 05s) - the first green run in the ledger . G5 1.4s, G6 1.7s, G7 2.5s (113 unit specs), G8 1m 05s (108 functional specs, six projects) . npm run audit:all -> 11/11 . npm run guard:test -> 13/13 . MINOR, so audit:compat ran inside audit:all: all three fixtures PASS (as required) . Fail-first: every one of the ten findings was observed as a real failure of the gate that caught it, on the real tree, before its fix - 44 tsc errors, 7 eslint errors, G7 at 2m 01s timeout, G8 against a 404, 'Configuration error: 2 required client variable(s) are missing' in the browser console with both set on the server, a Tab walk that skipped tabs-overview, the keyboard journey passing 3 of 4 repeats, 36 of 108 failing at browserType.launch.
## 1.32.0 — A check that did not run is BLOCKED at every layer - and the framework pays its own recorded debt

Every item in this version was written down as honest debt in v1.30.0 or v1.31.0. Debt that is recorded and then left is the same as debt nobody recorded, one version later; this run reads the previous two entries and pays them. The sharpest one: a ratchet with no baseline exited 0 while printing 'this gate is INERT and is telling you so'. It told stderr, and the thing that decides reads the exit code - so the gate runner, which has three verdicts precisely so that 'did not run' is never mistaken for 'passed', recorded every baseline-less ratchet as PASS. Observed on a real scaffold with its service worker deleted and no PWA baseline: G12 PASS. Binding rule 3 said 'a missing baseline prints SKIPPED and passes' and binding rule 4 said 'a step that did not run is BLOCKED' one paragraph later; the code honoured the wrong one. Three more, same pass: nothing read TEST_SUMMARY.md for a trend, so RC-009's four steps sat there for 24 identical runs; VERSION and package.json disagreed by twenty-eight releases because the close-out rendered the story into three places and the number into none; and the fixture rung added for v1.31.0's upgrade-clobber turned out to pass under every ownership rule, because conformance aged its lineage the way adoption does rather than the way a scaffold does. A fixture walking the wrong path proves the wrong thing with the same green.

Added: scripts/ratchet.test.sh - executes the engine, par.mjs and the gate's reading of exit 3: no baseline is BLOCKED (3), never 0 and never 2; par labels it BLKD and exits 3; a FAIL still outranks it; the two-sided contract is unchanged · The gate reads its own ledger: a step BLOCKED for a reason of its own for three or more consecutive runs carries the streak on its own report line. On this repository's real ledger the first run said 28 consecutive for G5-G8. Runs narrowed by --only neither extend nor break a streak · fixtures/diverged carries a manifest and a theme module generated from its own tokens, aged the way a scaffold records them; conformance now fails if an upgrade replaces either with the framework's copy - and was observed failing against the pre-v1.31.0 ownership rule

bash scripts/ratchet.test.sh -> 9/9 (3 observed failing pre-fix) . bash scripts/gate-scope.test.sh -> 17/17 (cases 13-15 observed failing pre-fix; case 14 additionally observed failing against a first draft that read the ledger after rendering) . bash scripts/close-out.test.sh -> 30/30 (2 observed failing pre-fix) . conformance diverged: both new checks observed failing against HEAD~1 lineage.mjs once the fixture was aged as a scaffold, and observed PASSING against it before that - the vacuity finding . npm run audit:all -> 11/11 . npm run guard:test -> 13/13 suites . npm run gate -> 8 PASS, 0 FAIL, 4 BLOCKED on the absent app toolchain, now each carrying '28 consecutive runs' . MINOR, so npm run audit:compat was run: all three fixtures PASS (as required).
## 1.31.0 — CP-30 - every generated application is installable, and none of it is configuration

The component library has listed Install as a BASELINE concern since it was written - one of the things every application needs - and carried it as a GAP row with the note 'an option in the customizer, never a silent default'. The owner has directed otherwise: every application generated through the SDLC is to be installable and launchable standalone, with no additional manual configuration. So the gap is closed and the row is flipped, and the caution behind the old wording is kept where it belongs - the app is installable, but nothing installs itself. The decisive design choice is that the web app manifest is GENERATED from design/tokens.json rather than hand-written: theme_color and background_color are colour decisions, and colour lives in exactly one file. Hand-written they are two more literals outside the token file, drifting the first time anybody rebrands - the app changes colour and the installed window around it does not. Generated, a rebrand still costs one edit, a hand-edited manifest is caught by gate G1 exactly like a hand-edited stylesheet, and a scaffold is installable the moment it exists because the same theme:build that compiles the theme writes the manifest, the offline page and the launcher icons.

Added: CP-30 in CANONICAL_PATTERNS: the manifest is generated from the tokens; HTML is never cache-first; the data layer is never cached; an update is offered, never imposed · Generated installable artifacts - theme-build.mjs now renders public/manifest.webmanifest, public/offline.html and the maskable launcher icons from design/tokens.json alongside the stylesheet and the typed module, all covered by gate G1 · scripts/lib/png.mjs - writes a valid PNG from Node's own zlib, so the launcher icons follow a rebrand instead of being two committed binaries that ignore it, and no rasteriser dependency lands in the path of every scaffold · starter/public/sw.js - network-first for HTML, stale-while-revalidate for content-addressed assets, and the data layer not cached at all. It never calls skipWaiting() on its own · starter/src/lib/pwa.ts + starter/src/components/PwaProvider.tsx - the install and update decisions as pure functions, and the component that owns the browser APIs and decides nothing itself · starter/src/app/layout.tsx - the root layout, shipped so the wiring is in the box: it links the manifest, sets a theme-color per colour scheme, points apple-touch-icon at the raster, and mounts ThemeProvider and PwaProvider. ThemeProvider had always assumed a meta theme-color existed and nothing had ever created one · Gate G12 and npm run audit:pwa - scripts/audits/check-pwa-baseline.mjs, ratcheted, plus scripts/pwa-baseline.test.sh which executes it against thirteen scratch applications · KL-002..004 in KNOWN_LIMITATIONS - iOS has no beforeinstallprompt, iOS will not take an SVG launcher icon, and a service worker needs a secure context. Each states what the app does instead

npm run audit:all -> 11/11 . npm run guard:test -> 12/12 suites . npm run gate -> 8 PASS (G12 among them), 0 FAIL, 4 BLOCKED on the absent app toolchain . MINOR, so npm run audit:compat was run: all three fixtures PASS (as required), no existing app goes green -> red. starter/src/lib/pwa.ts compiled clean under the starter's own strict tsc settings and its 23 assertions were EXECUTED against the compiled output; three injected defects each failed exactly one assertion and no others. A real scaffold (new-app --name acme-invoices) produced a manifest naming 'Acme Invoices', and that name survived a real upgrade.
## 1.30.0 — Three checkers were describing their own invocation, not the tree

A checker must describe its subject. Three in this repository described the circumstances of their own run instead, and each looked like an unrelated complaint. The theme builder baked a cwd-relative path into every generated file, so identical tokens produced different bytes from the framework root and from starter/ - and its own byte-comparison then reported DRIFT, "stale or hand-edited", on files nothing had edited. The gate runner never asked where, inside the subject, the application lives: G5-G8 ran tsc, eslint and the app's test scripts against the framework root, which deliberately has no tsconfig and no test scripts, so the gate recorded BLOCKED in 24 of the 27 runs in TEST_SUMMARY.md - always the same four steps, always telling the reader to install a toolchain into a package.json that would never carry it. And the runner wrote its tree fingerprint after any run, including a two-step --only run, so npm run guard:test stamped "this tree has been gated" on trees that had not been, and the next mandatory run announced itself avoidable. A fourth instance of the same family: the CI workflow enumerated the audits by name, making it a hand-maintained copy of audit:all that had already drifted - audit:fixtures and audit:deadweight could not fail a pull request, under a file header reading "if CI and local run different checks, one of them is decoration".

Added: scripts/theme-build.test.sh - 5 cases: identical tokens build byte-identically from any directory, --check agrees from both, the header path is followable, and a genuinely hand-edited file is still caught · scripts/gate-scope.test.sh - 12 cases: the application subtree in both layouts, the BLOCKED remediation naming it, and the fingerprint contract from both ends

bash scripts/theme-build.test.sh -> 5/5 (3 observed failing pre-fix) . bash scripts/gate-scope.test.sh -> 12/12 (6 observed failing against HEAD:scripts/gate-runner.mjs) . npm run guard:test -> 11/11 suites . npm run audit:all -> 10/10 . npm run gate -> 7 PASS, 0 FAIL, 4 BLOCKED on an absent app toolchain, now naming starter as the directory to install in. With typescript installed under starter/, G5 reports a measured duration instead of '-' - the difference between a step that ran and one that never spawned. MINOR, so npm run audit:compat was run: all three fixtures PASS (as required) - no existing app goes green -> red.
## 1.29.0 — Six design directives, built once so no application builds them again

Six corrections arrived together, and five of them were the same shape: a rule the framework already stated in prose with nothing implementing it. Confirmation on destructive actions was written down and had a component; undo was written down beside it and had nothing at all — the bulk-action bar shipped a one-click delete over a selection built by shift-clicking. "Scope is the visible set" was a sentence in the bulk-selection pattern that no checkbox implemented, because there were no checkboxes. Tabs had a component, a scroll rule and a keyboard rule, and no styling whatsoever, so the selected tab was distinguished by nothing. A rule nothing executes is not a rule, and the cheapest place to execute these is the shared component every application already reaches for. So each directive lands as working code in the reference implementation with a rung under it, not as another paragraph.

Added: A designed full-surface wait — src/lib/loading.ts + src/components/LoadingScreen.tsx. It says what is being made for the user (configurable copy, defaulting to "We're working for you, making things for you."), draws the pipeline as a currentColor line diagram needing no per-theme asset, marks the active stage in words as well as colour, and past a threshold stops pretending: it reports that the wait has gone wrong and offers a route onward. Thresholds are settings; a misconfigured pair is repaired rather than left with the stalled state unreachable. · One itemised price breakdown — src/lib/pricing.ts + src/components/PricingPanel.tsx, CP-29. Items, adjustments, tax and the emphasised payable, in one order, on screen and in print. The rows shown add up to the total shown, because each row rounds once and the total is the sum of the rounded rows. Pass-through money is owed by the payer and kept out of revenue. An over-discount is reported, never clamped to zero behind the user. Currency formatting is the existing shared formatter, not a second one. · Undo, actually implemented — src/lib/undo.ts + src/components/ToastHost.tsx, CP-28. Undo is a deferred commit: the effect is held for the window and committed when it closes, so Undo is a local cancel that cannot fail — unlike the compensating write, which tells the user "Undone" about a change that is still there. The queue never drops a pending action: overflow commits early and unmount drains. · Row and header selection — src/lib/selection.ts + src/components/SelectionColumn.tsx, CP-18 amended. A checkbox on every row, a three-state header checkbox (some renders indeterminate), select-all scoped to the visible set, shift-select over the visible order, and a filter change that drops what left the view and says how many. · DR-3, the selected tab — every tab carries a visible border, and the selected one differs by fill, border and weight together, on the contrast-asserted primarySurface / onPrimarySurface pair. Styling hangs off aria-selected, so what is drawn and what is announced cannot disagree. · src/components/components.css — one token-only stylesheet for tabs, toasts, the wait, the price breakdown and row selection. No colour literal; every pair used is asserted by the contrast gate in both themes.

10/10 audits pass (`npm run audit:all`). 9/9 guard suites pass (`npm run guard:test`). The gate is BLOCKED, honestly: G5–G8 need a package registry this environment does not have, so types, lint and the test runners could not be obtained. What was verified instead, and stated rather than implied: the four new libs typecheck clean under `--strict` with the standalone compiler, and their 36 assertions were executed against the tsc-compiled actual modules — each of the four rungs first OBSERVED FAILING against the pre-fix implementation, with the exact message recorded in TEST_SUMMARY.md.
## 1.28.0 — CP-27 - the audit trail, as a reusable component

Owner requirement: wherever RBAC is enabled, record it - a super admin creating an account, assigning a role, or customising which features a role can reach. An audit log is the record you reach for on the worst day, and it is worth exactly as much as its weakest row, so the four ways it goes quietly worthless are each closed by a rule with a spec behind it.

Added: starter/src/lib/audit.ts - the model and the rules. An entry with no real actor is not an entry: a background job is System (<process>) and names the process; a *user* action whose identity did not resolve is Unknown (<id>) and is never dressed up as System - RC-007 shipped exactly that, and a plausible wrong author is never discovered while an ugly one gets fixed. A row never carries the secret it audits: 'Password changed' is the record, the password is not. A change that did not happen must not appear: arrays compare as SETS, so re-serialising a role list in a different order is not a role change, and null / undefined / empty string are one absence. Append-only: the module exports no updater and no deleter, and a spec asserts that it never grows one. · starter/src/components/AuditLogTable.tsx - the seven columns asked for: what changed, screen/module, previous value, new value, modified by, modified at, remarks. Search, module filter, date presets and sorting come from CP-23; the column picker from CP-21, which seven columns require. The component is read-only by construction - no row menu, no edit, no delete, and nowhere to add one without editing the file. It also counts unattributed entries on screen, because an identity-resolution defect that shows as one 'Unknown' among hundreds never gets fixed. · Three RBAC event builders for the named cases: account created, roles changed, feature access changed - the last recording the whole enabled SET before and after, since 'granted Billing' alone cannot answer 'what could they reach in March'. · CP-27, two COMPONENT_LIBRARY rows flipped straight to READY (a baseline concern, contributed in this run), and cases FW-AUDIT-001..005.

audit:all clean (10/10) including the column-control and test-id gates the seven-column table had to satisfy; guard:test 9/9; audit:compat clean, no fixture green to red. The audit spec: 19/19 against the compiled library, with fail-first by two injected defects. Gate BLOCKED on G5-G8: pre-existing, no local tsc.
## 1.27.0 — the request pre-sorter is withdrawn

Owner decision, one release after it shipped. It classified a SINGLE sentence, and a real chat carries several requests at once - so its input was ambiguous exactly where the stakes are highest, and a confident wrong route costs an entire track. Set against that, it never demonstrated a measured saving: the case for it rested on one run's ground stage which also contained a long design conversation. Removing an unproven mechanism that can be confidently wrong is the correct trade, and the framework's own rule-budget guidance says to propose compaction, not only growth.

audit:all clean (10/10); guard:test 9/9 suites (31.7s parallel vs 2m09s serial); audit:compat clean, no fixture green to red. Live-reference sweep for classify.mjs / classify.test.sh / classify= across the tree: 0 outside git's own index and the append-only history in CHANGELOG.md and UPGRADES.md. Gate BLOCKED on G5-G8: pre-existing, no local tsc.
## 1.26.0 — delete is a declared contract; verification is per commit; requests are pre-sorted

Three things in one release, deliberately: the release itself demonstrates the middle one. Corrections that land in one commit share one verification pass, so batching them is not a shortcut - it is the correct unit.

Added: CP-26 - deleting a record. The reported defect was 'Supabase soft-deletes where the frontend expects a hard delete'. The backend was behaving exactly as the reference schema intends: status active|archived, a PARTIAL unique index, and no delete policy granted at all. The defect is that the two layers disagree about what delete means, and each is self-consistent - which is why a row returning on refresh, a re-add hitting a unique constraint and a stale id 404-ing present as three unrelated bugs. Every entity now declares ONE model in writing - ARCHIVE or REMOVE - and the assertion is a round trip, never the response to the delete call, which only proves the request was accepted. · A3.3b-delete in feature.md - the design pass asks the question before any delete control is drawn. Unasked, each layer picks an answer independently, and both are defensible. · The gate names an avoidable run. It verifies a TREE, not a change, so re-running it after each correction in one tree re-verifies the same tree N times - only the last run describes what ships. When the tree is byte-identical to the previous run the report says so. A NOTICE, never a block and never a cache: a gate that skipped work because it believed nothing had changed would be trusting a fingerprint over the code. · classify.mjs - the request pre-sorter, the first piece of the routing question. One command sorts the obvious requests into their track before any agent reads the nine-row table, and answers UNSURE rather than guessing. NEW vs NEW-APP it settles by looking for a source tree, because that is a fact about the repository and no amount of re-reading the sentence can answer it. workflows/request.md R1 remains the authority on what the classes mean. · Cases FW-DEL-001..002, FW-VERIFY-001, FW-CLASS-001..002. classify.test.sh (18 executed cases) joins guard:test, now ten suites.

audit:all clean (10/10); guard:test 10/10 suites (31.8s parallel vs 2m23s serial); audit:compat clean, no fixture green to red. Gate BLOCKED on G5-G8: pre-existing, no local tsc in this repository.
## 1.25.0 — four levers on execution time, aimed by measurement

Owner report: runs take too long, and the proposal was to replace English decision-making with code. Measured first, on this repository: the whole mechanical stack was ~87s against runs of 27 to 65 minutes, and instruction-interpretation was the SMALLEST term, not the largest. So the four changes here are aimed where the time actually is - generation, sequential checking, and repeated judgement - and the routing question is deliberately still open.

Added: Stage breakdown in the run log. run-log.mjs stage <ground|plan|build|verify|gate> marks each boundary from the clock, and the row carries ground 4m · plan 2m · build 14m beside the total. Closes the last part of FW-SPEED-003 that was still prose: a total says a run was slow, only the breakdown says what to fix. An unmarked stage is absent, never 0. · par.mjs - independent checks run concurrently. audit:all 17.7s to 5.7s; guard:test 60.2s to 29.4s; the mechanical stack 87s to ~41s, now nine suites rather than six. It also aggregates every failure instead of stopping at the first, so one run tells you everything that is wrong. It deliberately does NOT parallelise the gate, whose order is a prerequisite chain: there is no value in running a browser suite against code that does not compile. · review-plan.mjs - the review matrix, executed. Reads the diff and names the passes: scale derived and justified, reviewers selected with reasons, the same diff twice giving a byte-identical plan. The matrix in workflows/agents/README.md now points here for SELECTION and keeps the job of saying why each pass exists. · close-out.mjs - write the release story once. One record renders the upgrade section, the changelog paragraph and the commit message. Generation is the dominant cost of a run, and telling the same story four times by hand was the largest single block of writing in a close-out - three quarters of it transcription. The record carries the real sentences; the script owns only scaffolding and repetition. · Cases FW-STAGE-001..002, FW-PAR-001, FW-PLAN-001..002, FW-CO-001..002. Two new executed suites (review-plan.test.sh 20 cases, close-out.test.sh 23) in guard:test.

audit:all clean (10/10, 5.7s); guard:test 9/9 suites (38.1s parallel vs 2m45s serial); audit:compat clean, no fixture green to red. Gate BLOCKED on G5-G8: pre-existing, no local tsc in this repository.
## 1.24.0 — the run log

An audit log of runs: what was asked (in the requester's words), which kind of request it was,
when it started, when it ended, how long it took — plus the gate's own measured cost beside the
total, so every row says whether a long run was the machine or the agent. Written by
`scripts/run-log.mjs`, never by hand: a start time recorded once a run is over is a recalled
time, and v1.23.0's RC-008 is what that costs. `end` without `start` is BLOCKED rather than a
guessed duration; back-fills are explicit and marked on the row. Opened at `/request` R1,
closed at the Definition of Done. 23 executed cases, fail-first by defect injection. Seeding
the first rows immediately found a defect — they filed into the glossary table above the data
table, and the write reported success anyway — now fixed by anchoring on the data header and
held by its own regression case.

## 1.23.0 — verification learns to measure itself

Owner report: corrections are quick, verification exceeds an hour. Measurement, not intuition:
the whole mechanical stack is ~87s (`audit:all` 17.7 · `guard:test` 60.2 · `gate` 8.6), about
2.4% of it. Root cause (RC-008): the stage-timing rule shipped in v1.13.0 had no rung, so three
versions produced no number and the first slow stage was diagnosed by feeling — the exact
anti-pattern its own case names. And proportionality had only ever been applied to the build
half: T1's nine blocking sub-steps ran identically for a two-file fix and a schema migration.
Fix: the gate now times every step and names the slowest in the append-only ledger
(`gate-timing.test.sh`, 8 cases, 4 observed failing first); `test-gate.md` gains a verification
lane on the existing `SCALE:` declaration, with fail-first, the registry delta and the gate
itself marked never-scales. No check was removed. See `UPGRADES.md`.

## 1.22.0 - seventeen escaped defects, three process failures closed

Root cause of a release that shipped 17 defects through a green run (RC-007): rules that
existed but had no rung; rules that did not exist at all; and capabilities re-implemented
instead of reused, re-inheriting bugs the library had already fixed. Added: the
`check-fixture-leak` ratchet (placeholder data in shipped source), **CP-25** edit parity with
three new reference journeys as its rung, CP-15 amended for imported/pasted dates, and
`bug.md` C2b - the five classes a green suite cannot see. See `UPGRADES.md`.

## 1.21.0 - reuse before you build, and the components that proves it

framework-update Route B gains step 0 (read the component library first) and a four-way
capability decision recorded every run: REUSE what exists, REFINE the shared implementation
rather than working around it locally, CONTRIBUTE a baseline concern in the same run, or say
app-only. Four components close standing gaps: ConfirmDialog, MoreMenu (isolated sign out),
HelpSupport (email/call/WhatsApp) and sentence-case text formatting (DR-1). DESIGN_RULES gets
its first two rows. Fixed: the command shim said "triple close-out" and omitted the VERSION
leg. See `UPGRADES.md`.

## 1.20.0 — validated parallel build

Generation is the slowest part of a run and the only part parallel agents genuinely shorten. A
plan with 3+ independent tasks now builds in concurrent lanes: `scripts/fanout-check.mjs`
validates the plan first (blocking a file written by two tasks, a task reading a file another is
rewriting, or a task with no contract/acceptance), then one `implementation-builder` per lane is
spawned in a single message. Contracts are declared before any lane starts; integration and the
gate happen once, centrally. Review still follows the build — it never overlaps it. See
`UPGRADES.md`.

## 1.19.0 — the micro lane

A third scale below scoped, for the corrections you make every day: ≤2 files, no schema, no
new screen or component, not correction round ≥ 2. It skips the design pass, the plan document
and the QA verdict table; it keeps every mechanical gate, the freeze rule and the hard stops.
New guard **G8** checks a `SCALE: micro` claim against the actual diff and blocks an
over-reaching one with a single instruction — promote to scoped. Guard suite 10 → 17 cases.
See `UPGRADES.md`.

## 1.18.0 — CP-24: analytics and dashboards as a reusable module

A dashboard is now configuration, not code: business-agnostic components (MetricCard,
DashboardShell, InsightCard, BarChart, Sparkline, ProgressMeter, AnalyticsTable) driven by a
DashboardConfig, with four honesty rules enforced in the logic — direction is not sentiment,
growth from zero is null, absent is never zero, restricted metrics are removed not hidden.
Filters reuse CP-23; no charting dependency. Restaurant, gym, academy and badminton configs
ship as the proof. See `UPGRADES.md` and `docs/25`.

## 1.17.0 — CP-23: every list searchable, filterable, sortable

New ListControls / useListControls / list-controls lib: one search box across key fields
(phone digits normalised), multi-select filters, date presets (Today · This week · Last week ·
This month · Custom, local time, inclusive), stable asc/desc sort with blanks last, and a
matching/total count. CP-23 with an executable rung; a baseline concern in the component
library; asked for by A3.3b, the Track B Lists row, docs/04 and design QA. See `UPGRADES.md`.

## 1.16.0 — Codex wiring committed, four defects fixed first

`.codex/` (agents, hook adapter, hooks.json) and root `AGENTS.md` are now tracked. Before
committing: the absolute machine path in hooks.json made relative; the Codex adapter test now
tests the .codex copy (it was testing .claude's) and runs in guard:test; agent descriptions
synced to the v1.15.0 review matrix; AGENTS.md turned into a pointer to CLAUDE.md instead of
a drifted copy. Registered in manifest/overview/docs 21. See `UPGRADES.md`.

## 1.15.1 — fix: starter tsconfig rejected by tsc

`"//strict"` and `"//paths"` inside compilerOptions were TS5025 errors (unknown compiler
option) since the initial commit, making tsc fail on the config in every scaffolded app —
so the type gate never truly ran. Converted to real JSONC comments; content preserved. Apps:
remove or convert those two lines in your tsconfig, then re-run the gate. See `UPGRADES.md`.

## 1.15.0 — the third speed pass: reviewers by scale, in parallel

Root cause: all eleven review agents self-described as "use PROACTIVELY" and the runbooks
never scoped them, so a run could spawn up to ten cold sub-agents in sequence to review a
scoped change already analysed inline. Fix: a review matrix (scoped vs full-scale) wired into
every agent description — scoped runs spawn code-reviewer plus only the reviewers the diff
triggers, in one parallel message; blast radius, plan, gate run and close-out stay inline.
DoD and screen checklist now emit compact tables. See `UPGRADES.md`.

## 1.14.0 — module access + app customizer components

Two contributed reference components: ModuleAccessPanel (role preset as reset-to-role,
per-capability custom grants, deny-by-default, worded confidential marks, honest save label)
and ModuleCustomizer (enable/disable + button reorder, alwaysOn locks the toggle not the
position, enabled-only position badges). Pure logic in libs with unit specs — executed
against the compiled actual files, and observed failing when inverted. Registered under
Settings and Permissions in COMPONENT_LIBRARY. See `UPGRADES.md`.

## 1.13.0 — the second speed release

Root cause of remaining slowness: process weight — ~1,700+ lines of process docs read up
front and ~130 checklist items answered with hand-written evidence, much of it duplicating
mechanical audits. Fix: the three budgets. Reading — runbook + rules + touched registers
once, everything else opened at the named section; evidence — one verdict + one line per
AREA, audits cited never re-verified, scoped runs cover the core six areas plus touched;
writing — line caps on scoped artifacts. Run reports now carry stage timings. No check was
removed. See `UPGRADES.md`.

## 1.12.0 — requirements that drive design

The requirement→UI gap was a format gap: prose carries the what, not the facts simplicity is
built from. REQUEST_NEW gains a structured USAGE PROFILE (objective, workflow, frequency,
environment, essential/optional, frequent/occasional, automate/manual); docs/24 §3b translates
those facts into forced UI decisions mechanically; §3c adds the subtraction pass (see it? do
it? fewer steps?) with recorded evidence; the no-manual bar lands in the craft doc and design
QA. Unknown profile lines are asked at Gate 1, never invented. See `UPGRADES.md`.

## 1.11.0 — the component library

New COMPONENT_LIBRARY register: the standard baseline every app ships (themes, auth flows,
navigation, states — auto-Must-Have in the advisor pass), stack-keyed implementations seeded
from starter/ with honest GAP rows, a lookup-before-build order (app → library → build), and
a contribute-back loop — baseline builds register immediately, everything else faces
/promote's rule of three. Discover → reuse → build missing → register → reuse. See
`UPGRADES.md`.

## 1.10.0 — the product-advisor pass

For a new application or module, Gate 1 now researches comparable products (timeboxed,
sources declared), filters through context lenses (region, legal, customers, scale, industry
standards), and delivers a Must-Have / Recommended / Good-to-Have triage plus a reasoned
ignored list. Every question ships with a recommendation, its reasoning, alternatives, and an
always-available "Other" — the requester decides, in every run mode, in one consolidated
stop. Scoped in-area features skip the pass. See `UPGRADES.md`.

## 1.9.0 — the speed release

Run modes: **auto** (new default) turns gates 1–4 into logged checkpoints with an ASSUMPTIONS
ledger and an end-of-run report — no waiting; **confirm** keeps the old stop-and-approve.
Hard stops (destructive ops, capability removal, safety floor, production) and the mechanical
test gate bind in every mode. Proportional ceremony: a scoped feature produces one combined
RUN document instead of four gate artifacts. Root cause of the 40-minute run: four synchronous
human waits plus uniform maximum ceremony. See `UPGRADES.md`.

## 1.8.0 — a new app can be born through /request

New NEW-APP classification: a whole-new-application ask now routes through initialization
(docs/02, `npm run new:app`) before Track A runs inside the new app, with the request file —
scoped to the first shippable slice — moving into the new app's `requests/` as entry #1.
Scaffolds now seed the intake ledger. Previously such an ask misclassified as NEW and ran a
feature track with no application under it. See `UPGRADES.md`.

## 1.7.0 — the design release

The design stage becomes a design-intelligence layer. New: docs/24 (the planning method —
discovery, infer/investigate/ask, IA-first placement, the ten-stage pipeline, scoring),
docs/23 (the craft bar and the anti-gimmick rule), the 18-area design-quality checklist with
verdict + evidence and a validate→refine→re-validate loop (Gate 3 sees Production-ready or
better), the armed DESIGN_RULES register, the three-interaction budget, named primary actions,
contextual dialogs, keyboard parity (CP-22, A-10, Space selects tabs, a reference spec), and
the Claude Design canvas as a Gate 3 deliverable. Simplify the experience, not the capability.
See `UPGRADES.md`.

## 1.6.0 — one command, end to end

`/request` now continues into the classified track after writing the request file — for every
classification. The field review moves to the track's first gate, which opens by restating the
FIELDS "from your request — correct anything wrong"; a correction there updates the file before
work proceeds. Mixed input repairs the process half first. See `UPGRADES.md`.

## 1.5.0 — intake is the single entry point

Routed-out classifications (list, open situation, restructure, process failure) produce no
request file, so `/request` now continues directly into triage / brainstorm / refactor /
framework-update in the same run — the destination runbook's own gates still stop the work.
Mixed input hands its process half to framework-update in the same run. The field-review STOP
for NEW/CHANGE/BUG is unchanged. See `UPGRADES.md`.

## 1.4.0 — intake

`/request` turns rough words into ONE binding request file (`requests/`): classify, fill only
what was said (`unknown` never invented), stop. Stated fields bind the track; `unknown` fields
become its questions; CORRECTION ROUND ≥ 2 forces "what did the last fix miss" before any new
fix. Track B's vague "mini design pass" became the defined, mandatory-when-visual correction
design pass (states · both themes · string table · permissions). Ten process cases. See
`UPGRADES.md`.

## 1.3.0 — CP-21, wide tables

More than three columns means the user chooses which show and in what order, and the choice
persists. Gate step G11 (`audit:columns`, ratcheted), a reference `ColumnControl` +
`useColumnPrefs` in the starter, seven unit cases on `reconcileOrder`, and a review item for the
dynamically-built tables the audit cannot see. Promoted from `academies-dashboard` at n=1 by
owner override — recorded as such in `CANDIDATES.md`.

## 1.2.0 — the adoption-safety release

See `UPGRADES.md` (the canonical per-version entry). Everything found by running v1.1.0
against a real adopted app and a workspace scaffold: the workspace gate and commit guards now
actually run, adopted apps are offered seed files instead of being buried in them
(`--decline` to refuse, `--refresh` to take), the backward-compat gate can no longer pass on
stale results, and Half A now genuinely reaches standalone apps on upgrade.

## 1.1.0 — the evolution release

See `UPGRADES.md` (the canonical per-version entry) and `docs/22-FRAMEWORK-EVOLUTION.md`.
Lineage + upgrade + promotion + fixtures + backward-compat gate; quadruple close-out.
The fixtures caught RC-005 (adoption clobbering) and RC-006 (baseline first-entry loss)
before release.

## 1.0.0

Initial release.

### The process
- Eight-stage SDLC with six gates, and seven track runbooks (feature, enhance, bug, refactor,
  triage, brainstorm, framework update) plus a test gate.
- The learning loop: every root cause asks whether the process should have caught it, and the
  process repairs itself when the answer is yes.
- The rule budget: cheapest workable enforcement level, and a screen checklist capped at 20 items.

### The theme system
- `design/tokens.json` as the single source of truth for every colour and scale.
- Generated CSS custom properties and typed tokens; hand-editing the output is blocked.
- Three-state theme preference (light / dark / system) with no flash of the wrong theme.
- 92 contrast assertions across both themes, all passing, as a build gate.
- Per-theme brand assets, verified to exist, switched by CSS rather than JavaScript.

### The gates
- A generic ratchet engine: adopt any rule today, on any codebase, backlog can only shrink.
- Contrast · theme sync · theme assets · hard-coded colours · test-id coverage · rule coverage.
- A three-valued gate runner where BLOCKED is a verdict and green-by-omission is impossible.
- Seven commit guards with per-guard escape tokens, and an executable proof that each can fire —
  including a type-error ratchet, a case-loss guard, and a guard that holds *process* changes to
  the same test-case obligation as application code.

### The wiring (`.claude/` + `CLAUDE.md`)
- `CLAUDE.md` at the root — binding rules, read before every task, each stating what, **why**, and
  **where it is honoured in code**.
- `.claude/settings.json` wires the commit guards as a `PreToolUse` hook, so they run in **every**
  session — including the ad-hoc fix that never opened a runbook. Committed, because settings that
  live on one machine enforce nothing on anyone else.
- Nine slash commands, written as **pointers to `workflows/`, never copies** — duplicating a
  runbook guarantees two versions, and the drifted one is always the one someone finds first.
- Eleven review sub-agents, each with a scope, a boundary, and a machine-readable verdict.
- A hook-protocol adapter that recovers escape tokens from the **command** at commit time and from
  the **log range** at push time, because a guard must read the same *change* in both modes, not
  the same *string*.
- Nine executable adapter tests: a correct guard behind a broken adapter enforces nothing, and
  looks installed.
- `new-app.mjs` carries all of it into every scaffolded application.

### The starter
- Pure/impure split error taxonomy with a reference unit spec.
- Fail-closed API handler, config with fail-fast validation, signature-based logging.
- Reference migration, cloud-function pipeline, and three test tiers.
