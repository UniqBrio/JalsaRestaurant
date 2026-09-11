# Upgrade Log

> One section per framework version, **newest first**. This is the file `scripts/upgrade.mjs`
> reads out loud to an upgrading app, so every entry answers one question plainly:
> **what must an app do to adopt this version?**
>
> Bump meanings (defined for a *process*, see `docs/22-FRAMEWORK-EVOLUTION.md`):
> **PATCH** — wording/doc fixes, nothing behavioural → apps do nothing.
> **MINOR** — new optional capability or advisory gate (arrives baselined) → nothing required.
> **MAJOR** — a gate becomes blocking, a baseline format changes, a workflow step becomes
> mandatory → explicit migration step listed here, on the app's schedule.

---

## 1.35.0 — 2026-09-11 — MINOR

**A decision recorded only in a comment, in a file nothing ran - and the CI that could not see the class it was written for**

v1.33.0 decided deliberately that the starter declares RANGES and ships no lockfile: it is a shape to copy, not a pinned tree. That decision was written down in THREE places and enforced in none: a comment inside ci/github-actions-ci.yml (a file which had never been copied into .github/workflows/, so it had never executed anything), and twice in docs/02-PROJECT-INITIALIZATION.md - "the starter is a shape, not a lockfile", and "lockfile committed" in the app's own checklist, which is the correct opposite rule for an app. That is the finding, sharper than "it was undocumented": the prose was right, repeated and consistent, and it still changed nothing, because no prose is reachable from fs.readdirSync. Meanwhile new-app.mjs's SKIP set listed only build output, because a lockfile is not build output and nobody had asked whether it should be SEEDED. So a routine npm install in starter/ left a lockfile that nothing ignored and the scaffolder copied byte-for-byte into every new app - verified by running the scaffolder, not by reading it - and since an app commits its lockfile, every app born from that checkout would have carried one machine's dependency resolution from one afternoon, permanently. The intent existed, was correct, and was enforced by nothing: CLAUDE.md's first idea applied to a decision rather than a rule. The second half of this release is the reason the first half was found late. RC-012 was a defect class visible only where the shell's path namespace and the interpreter's disagree, and CI ran ubuntu only, where they agree - so twelve false accusations would have sat behind a green pipeline indefinitely. Full analysis: docs/registers/ROOT_CAUSE_REGISTER.md RC-013, and decision 003 for the CI shape.

### Added
- A second CI job, self-tests-windows: audit:all and guard:test on windows-latest with shell bash, because the suites are bash scripts and the runner's default is pwsh. Deliberately NOT a mirror of the gate job - no browsers, no application gate, since those exercise the app's toolchain and that is not where the class lives. Decision 003 records the four options rejected, including the obvious one (an OS matrix over the whole gate, which roughly doubles the bill to re-prove what ubuntu already proved)
- RC-013 and decision 003; cases FW-SEED-001..002 and FW-CI-001

### Fixed
- .gitignore ignores /starter/package-lock.json, so it cannot enter the framework's history by reflex
- scripts/new-app.mjs adds package-lock.json to SKIP, so a stray one cannot seed a scaffolded app. Two lines at the two places the file can escape - deleting the file would have fixed today and left both routes open
- The installed .github/workflows/ copy was re-synced with the ci/ template; it was already one version behind within an hour of being installed

### Stated as honest debt, not papered over
- ci/github-actions-ci.yml and its installed copy under .github/workflows/ are two files that must stay in step, and nothing compares them. They drifted within an hour of the first install and this run re-synced them by hand. It is the same class as RC-013 - a rule enforced by remembering - and it is recorded rather than fixed because the cheapest honest fix is a check, and the rule budget says propose compaction as readily as growth. Named here so the next person does not discover it the way this one did
- The Windows job has never actually run: it was authored and parsed, and its two commands were proven on this Windows machine, but the first real execution happens on the next push. If it fails it will be on the runner's environment, not on the commands

### App action required
Nothing, and one thing worth knowing. No gate, baseline or generated file changes, and an existing app is untouched - your own package-lock.json is yours and should stay committed; this release only stops the FRAMEWORK's starter from seeding one. The thing worth knowing is the shape of the mistake rather than the mistake: a decision that some script must honour belongs in that script's behaviour, with a rung, not in a comment beside it. If you scaffold a new app from this version it will generate its own lockfile on first npm install, as it should.

---
## 1.34.0 — 2026-09-11 — MINOR

**Three suites were accusing correct code: a path crossing into JavaScript source is data, and nothing translates it**

npm run guard:test reported 10/13 off POSIX. The ratchet suite failed 6 of 9 assertions, theme-build 3 of 11, pwa-baseline 3 of 13 - and every subject those assertions named was correct. A path used as ARGV is translated by the shell on the way out, so `node "$ROOT/x.mjs"` resolves everywhere; the same string interpolated into JavaScript SOURCE - an import specifier, a readFileSync argument - is data, nothing rewrites it, and Git Bash's /c/Explorations/... reached Node as C:\c\Explorations\.... Ten of the thirteen suites pass paths only as argv, which is exactly why the distinction stayed invisible until the three that do not were run off POSIX. Two things turned a portability bug into a diagnostic one: the failures were reported as defects in the SUBJECT rather than as a harness that could not run - the third verdict exists for precisely this, and a bash harness had no way to say it - and 2>/dev/null on the node -e calls discarded the ERR_MODULE_NOT_FOUND and ENOENT that named the cause outright. The sweep added here found a fourth site nobody was looking for: scripts/upgrade.test.sh had the same defect and was NOT failing, because a || sed fallback silently absorbed the broken require() and produced the right answer by a route nobody intended. Two of the four shapes this class takes do not announce themselves, which is the whole argument for a sweep rather than three fixes. Full analysis: docs/registers/ROOT_CAUSE_REGISTER.md RC-012.

### Added
- scripts/lib/shpath.sh - jspath for anything fs opens, jsurl for an ESM specifier. Two functions because it is two requirements: a bare C:/... is rejected as ERR_UNSUPPORTED_ESM_URL_SCHEME, the drive letter parsing as a URL scheme. Where cygpath is absent - every POSIX system - the path is already the form Node wants, so passthrough is the correct answer rather than a degraded one
- scripts/shpath.test.sh - 7 assertions, wired into npm run guard:test (now 14 suites). Case 3 asserts the bare native path is STILL rejected, so the day jsurl becomes redundant that is reported rather than assumed. Case 4 sweeps every shell harness in the tree; case 4a fails if it read fewer than 8 files, because a sweep over zero files reports clean and means nothing; case 5 plants a violation and proves the sweep fires on it
- CP-31 in the canonical patterns register - argv is translated, source is not - and cases FW-PATH-001..004

### Fixed
- scripts/ratchet.test.sh - 3/9 to 9/9. One line: the ESM import specifier now comes from jsurl
- scripts/theme-build.test.sh - 8/11 to 11/11. Six readFileSync sites and two writeFileSync sites, converted once into ROOT_JS / TMP_JS / MF_JS rather than at each site
- scripts/pwa-baseline.test.sh - 10/13 to 13/13. The three manifest mutations now go through a mutate() helper that ASSERTS the mutation happened: a node -e that dies leaves the fixture intact, and the case then fails as though the DETECTOR had missed something, which is the misread this whole entry is about
- scripts/upgrade.test.sh - found by the sweep, not by a failure. Its require() of a manifest path was broken off POSIX and masked by a || sed fallback

### Stated as honest debt, not papered over
- The sweep requires a following / to fire, so it catches '$VAR/path' and not a whole path held in one variable, '$MF'. That shape is not distinguishable by syntax from a JSON key, '$field', and a check that flags correct code is switched off within a day - the narrow form that never lies is the one that survives. The residual shape is covered by the _js / _url naming convention and by review, and is stated in RC-012 rather than implied
- guard:test is still only executed on whichever platform the person running it has. Nothing in CI runs it on Windows, so the class this entry closes was found by hand and the next one in the same family would be too

### App action required
Nothing. No application carries these shell harnesses, and no gate, baseline or generated file changes - the starter is untouched. The one thing worth knowing is the rule itself, CP-31, if you ever write a shell script that hands a path to node: convert at the boundary with $(jspath ...) for anything fs opens and $(jsurl ...) for an ESM specifier, and never send the interpreter's stderr to /dev/null. A harness that cannot say 'I could not run' says 'your code is broken' instead, and you will believe it.

---
## 1.33.0 — 2026-09-10 — MINOR

**The starter declares its toolchain, and the gate is green for the first time**

For thirty-one recorded runs the gate reported G5-G8 BLOCKED with the remediation 'run npm install', and every run - this framework's own included - accepted that as a fact about the environment. It was a claim, and nobody executed it. Running npm install in starter/ installed nothing, because starter/package.json declared no dependencies at all: 'a shape, not a lockfile' had been read as 'declare nothing' rather than 'pin nothing'. The registry was reachable the whole time. So the four application gates were structurally un-runnable everywhere, CI included, and everything they would have caught accumulated unseen for the reference implementation's whole life: 44 type errors under the starter's own strict settings, 7 lint findings and no lint configuration, a unit tier that booted the entire application and timed out, functional specs written against a route that served a 404, a configuration module whose PUBLIC_* values were undefined in every browser because it read process.env dynamically, a dialog whose class names no stylesheet defined, a tab row whose mount-time scrollIntoView made the first Tab skip the active tab, data assertions that raced one run in four, and two test projects on an engine the CI template never installs. Ten findings, one cause: a gate that cannot run finds nothing, and 'nothing found' is indistinguishable from 'nothing wrong' for exactly as long as it stays blocked. RC-009 made the block honest and RC-010 made the streak visible; this is what was behind it. The gate now reports 12 PASS, 0 FAIL, 0 BLOCKED - the first fully green run in the ledger.

Full analysis: `docs/registers/ROOT_CAUSE_REGISTER.md` **RC-011 - a gate that cannot run finds nothing, and a stated reason for a block is a claim to be executed like any other.**.

### Added
- starter/package.json declares its toolchain as ranges - typescript, eslint, @playwright/test, next, react, dotenv - so npm install produces one. Every name was verified against the registry before being written. Still no lockfile: the shape is kept, the emptiness is not
- The reference screen: src/app/page.tsx -> src/features/items/ (types, api, ItemsScreen, ItemForm), composing TabRow, ListControls, Dialog, ConfirmDialog and ToastHost and building none of them. Archive model (CP-26), edit parity (CP-25), a re-read after every write, and Save that hands control back at once with the draft restored on failure. Documented in starter/docs/modules/items.md
- starter/eslint.config.js for gate G6, and starter/next.config.mjs to carry PUBLIC_* into the client bundle
- Dialog, ConfirmDialog and the reference list have styles - semantic tokens only. They had rendered class names no stylesheet defined for as long as they existed
- Cases FW-GATE-001..005; RC-011 in the root cause register

### Fixed
- 44 type errors across 20 starter files, fixed at the site and never baselined; tsc-baseline.txt written at zero
- 7 lint findings, including a react-hooks suppression that stood in for a hook-ordering fix
- The unit tier starts no dev server; 113 unit specs run in under three seconds in any environment
- config.ts reads PUBLIC_* through a static table, because process.env[name] is never inlined by a bundler and every client component was throwing at import
- ConfirmDialog renders confirm-accept, as its own comment and the reference spec require
- TabRow scrolls the active tab into view only when it is actually out of view - Chromium moves the sequential focus starting point to a scrollIntoView target, so the mount-time scroll made the first Tab skip the active tab
- Every data assertion in the functional specs polls for the write instead of reading it the instant a keypress resolves; the reference spec's habit 3 now says so
- The tablet and mobile-ios projects run on Chromium, the engine the CI template installs; 36 of 108 functional runs had failed at browser launch in every environment
- The functional server is configured in webServer.env; a sandbox that forbids browser downloads names its Chromium in PW_CHROMIUM_PATH
- TEST_SUMMARY.md's header no longer states that the environment had no package registry; it says what was true, and that the claim went unexecuted for thirty-one runs

### Stated as honest debt, not papered over
- WebKit is exercised nowhere. The two iOS-device projects run on Chromium for viewport variety; real engine coverage is a CI decision (install webkit, drop the browserName override) and is named in the config rather than implied.
- The starter's type baseline is at zero, which makes G5 a clean gate here. That is the starter's fact. An adopting app with a backlog gets the ratchet, unchanged.
- The playwright config recognises the unit tier from the command line (tests/unit in argv), because Playwright hands a config no other signal before evaluation. It is the honest mechanism, and it is a string match.

### App action required
Nothing is required, and one thing is worth taking. NEW apps scaffold with the toolchain declared and a reference screen at / that every functional spec drives; npm install then npm run gate gives a real verdict on day one. EXISTING apps: the seed files that changed are offered through the usual upgrade path, and three deserve a look. (1) src/lib/config.ts now reads PUBLIC_* statically - if your app's client components import the API client, they were throwing at import in the browser until now, unless you had already worked around it; take this file, and add next.config.mjs, which inlines the framework's prefix. (2) ConfirmDialog's control id is confirm-accept, not confirm-ok; any test addressing the old id updates one string. (3) playwright.config.ts: the unit tier no longer starts a server, the functional server is configured in webServer.env so no .env is needed to run the suite, and the iOS-device projects run on Chromium - if you want WebKit coverage, install it in CI and drop the browserName override; that gap is now a decision you can see rather than a failure you could not explain. If your app carries a type-error backlog, keep your tsc-baseline.txt: the ratchet is unchanged, and the starter's own baseline sitting at zero is the starter's fact, not yours.

---
## 1.32.0 — 2026-09-10 — MINOR

**A check that did not run is BLOCKED at every layer - and the framework pays its own recorded debt**

Every item in this version was written down as honest debt in v1.30.0 or v1.31.0. Debt that is recorded and then left is the same as debt nobody recorded, one version later; this run reads the previous two entries and pays them. The sharpest one: a ratchet with no baseline exited 0 while printing 'this gate is INERT and is telling you so'. It told stderr, and the thing that decides reads the exit code - so the gate runner, which has three verdicts precisely so that 'did not run' is never mistaken for 'passed', recorded every baseline-less ratchet as PASS. Observed on a real scaffold with its service worker deleted and no PWA baseline: G12 PASS. Binding rule 3 said 'a missing baseline prints SKIPPED and passes' and binding rule 4 said 'a step that did not run is BLOCKED' one paragraph later; the code honoured the wrong one. Three more, same pass: nothing read TEST_SUMMARY.md for a trend, so RC-009's four steps sat there for 24 identical runs; VERSION and package.json disagreed by twenty-eight releases because the close-out rendered the story into three places and the number into none; and the fixture rung added for v1.31.0's upgrade-clobber turned out to pass under every ownership rule, because conformance aged its lineage the way adoption does rather than the way a scaffold does. A fixture walking the wrong path proves the wrong thing with the same green.

Full analysis: `docs/registers/ROOT_CAUSE_REGISTER.md` **RC-010 - the message and the verdict disagreed, and the consumer reads the verdict; rule 3 amended so it agrees with rule 4.**.

### Added
- scripts/ratchet.test.sh - executes the engine, par.mjs and the gate's reading of exit 3: no baseline is BLOCKED (3), never 0 and never 2; par labels it BLKD and exits 3; a FAIL still outranks it; the two-sided contract is unchanged
- The gate reads its own ledger: a step BLOCKED for a reason of its own for three or more consecutive runs carries the streak on its own report line. On this repository's real ledger the first run said 28 consecutive for G5-G8. Runs narrowed by --only neither extend nor break a streak
- fixtures/diverged carries a manifest and a theme module generated from its own tokens, aged the way a scaffold records them; conformance now fails if an upgrade replaces either with the framework's copy - and was observed failing against the pre-v1.31.0 ownership rule

### Fixed
- ratchet.mjs: RATCHET_SKIP is 3. A missing baseline is BLOCKED, with 'no baseline at' kept verbatim for upgrade.mjs; the parsed-nothing branch, which always PRINTED BLOCKED and exited 2, now exits 3 too, so it is no longer rendered as 'your code is broken' about a tree nothing looked at
- par.mjs reads exit 3 as BLKD, lists blocked tasks under their own heading, and exits 3 unless something genuinely FAILED
- close-out.mjs --apply writes VERSION and package.json's version from the record, so the two files that state which version this is cannot drift again (they had: 1.31.0 against 1.3.0)
- conformance.mjs ages the diverged fixture's generated artifacts as 'pristine' with the app's own hash - the scaffold path, which is the one that clobbered - instead of letting --init route them to review, where no rule could ever have failed the check
- CLAUDE.md binding rule 3 and docs/17 section 4 no longer contradict rule 4: tooling gaps fail open in the commit guard; a missing baseline in a gate is BLOCKED

### Stated as honest debt, not papered over
- A workspace app that has never run framework:upgrade against a version that added a gate it lacks a baseline for will see BLOCKED where it saw PASS. That is the honest verdict and the remedy is one command, but it is a change in what CI reports for such an app, and it is stated here rather than hidden inside 'MINOR'. Why not MAJOR: no app whose baselines exist changes verdict (all three fixtures PASS), the verdict being replaced was never a valid PASS under the framework's own rule 4, and the migration runs automatically inside the upgrade every app already runs.
- The streak is reported only at the gate. Ground, plan, build and verify are still narrator-reported (RC-008's debt), so a stage that never changes outside the gate is still invisible to any script.

### App action required
Nothing is required if your app was scaffolded from, or has run `npm run framework:upgrade` against, any version that introduced a gate it uses - upgrade.mjs has always baselined new ratchets on apply, and it probes for the phrase 'no baseline at', which this version keeps verbatim. (v1.31.0's note that G12 'arrives inert' was too pessimistic for exactly that reason; it is inert only in an app that never runs the upgrade.) One behaviour changes, and it is the true verdict replacing a false one: a ratchet with NO baseline now reports BLOCKED (exit 3) instead of PASS. In the gate that is the BLOCKED row; in `npm run audit:all` it is a BLKD label and exit 3, never FAIL; in CI it is a non-green run that names the audit. If that happens to you, the app has a gate it never baselined - a check that was silently not running - and the fix is one command: `npm run framework:upgrade` (which baselines it), or `node <framework>/scripts/audits/<audit>.mjs --write-baseline` directly. Nothing else in this version needs an action: the gate's streak line, the close-out writing VERSION, and the fixture are all framework-side.

---
## 1.31.0 — 2026-09-10 — MINOR

**CP-30 - every generated application is installable, and none of it is configuration**

The component library has listed Install as a BASELINE concern since it was written - one of the things every application needs - and carried it as a GAP row with the note 'an option in the customizer, never a silent default'. The owner has directed otherwise: every application generated through the SDLC is to be installable and launchable standalone, with no additional manual configuration. So the gap is closed and the row is flipped, and the caution behind the old wording is kept where it belongs - the app is installable, but nothing installs itself. The decisive design choice is that the web app manifest is GENERATED from design/tokens.json rather than hand-written: theme_color and background_color are colour decisions, and colour lives in exactly one file. Hand-written they are two more literals outside the token file, drifting the first time anybody rebrands - the app changes colour and the installed window around it does not. Generated, a rebrand still costs one edit, a hand-edited manifest is caught by gate G1 exactly like a hand-edited stylesheet, and a scaffold is installable the moment it exists because the same theme:build that compiles the theme writes the manifest, the offline page and the launcher icons.

Full analysis: `docs/registers/ROOT_CAUSE_REGISTER.md` **CP-30 - installability, generated from the token file; DECISION 002 in docs/registers/DECISION_LOG.md records the reversal and the options rejected.**.

### Added
- CP-30 in CANONICAL_PATTERNS: the manifest is generated from the tokens; HTML is never cache-first; the data layer is never cached; an update is offered, never imposed
- Generated installable artifacts - theme-build.mjs now renders public/manifest.webmanifest, public/offline.html and the maskable launcher icons from design/tokens.json alongside the stylesheet and the typed module, all covered by gate G1
- scripts/lib/png.mjs - writes a valid PNG from Node's own zlib, so the launcher icons follow a rebrand instead of being two committed binaries that ignore it, and no rasteriser dependency lands in the path of every scaffold
- starter/public/sw.js - network-first for HTML, stale-while-revalidate for content-addressed assets, and the data layer not cached at all. It never calls skipWaiting() on its own
- starter/src/lib/pwa.ts + starter/src/components/PwaProvider.tsx - the install and update decisions as pure functions, and the component that owns the browser APIs and decides nothing itself
- starter/src/app/layout.tsx - the root layout, shipped so the wiring is in the box: it links the manifest, sets a theme-color per colour scheme, points apple-touch-icon at the raster, and mounts ThemeProvider and PwaProvider. ThemeProvider had always assumed a meta theme-color existed and nothing had ever created one
- Gate G12 and `npm run audit:pwa` - scripts/audits/check-pwa-baseline.mjs, ratcheted, plus scripts/pwa-baseline.test.sh which executes it against thirteen scratch applications
- KL-002..004 in KNOWN_LIMITATIONS - iOS has no beforeinstallprompt, iOS will not take an SVG launcher icon, and a service worker needs a secure context. Each states what the app does instead

### Fixed
- An artifact generated from an app-owned source is now app-owned too. design/tokens.json was expected-divergent and the files rendered from it were not, so an upgrade classified them 'pristine, and the framework changed them' and applied the framework's defaults over them. Reproduced end to end: scaffolding acme-invoices and running ONE upgrade renamed the installed application back to 'Default Framework App' and reset a rebranded app's compiled stylesheet to the framework palette. Both silent; the manifest one visible only to somebody who had already installed it
- theme-build's served artifacts default to the directory beside the TOKENS, not beside the working directory. One flag defaulting to a different application than the other two is a footgun with no safe way to hold it - building a scratch app's tokens wrote its manifest over the real starter's
- docs/17-ENFORCEMENT-RATCHETS.md section 7 listed nine gates and the framework had thirteen. Four had been added to audit:all and never to the table, for the ordinary reason a second list drifts: nothing compared the two

### Stated as honest debt, not papered over
- G12 arrives INERT rather than baselined in an existing app - no baseline file means the ratchet skips loudly and passes. That is every ratchet's adoption path in this framework, and it is stated in the app action above rather than described as 'arriving baselined'.
- The conformance fixtures still carry no src/theme/ and no public/, so no fixture exercises a generated artifact across the scaffold-then-rebuild-upgrade path. The regression that WOULD have shipped here was caught by an end-to-end scaffold in scripts/upgrade.test.sh instead, which is a rung but not a fixture. Carried forward from v1.30.0, now with a second incident behind it.

### App action required
Nothing is required, and nothing breaks. A NEW app scaffolded from this version is installable with no step at all: new-app writes the app's name into design/tokens.json and the scaffold's theme build renders the manifest, the offline page and the icons from it. An EXISTING app gains the capability but does not switch it on by itself, because three of the pieces live in application source and are yours: take starter/public/sw.js, starter/src/lib/pwa.ts, starter/src/components/PwaProvider.tsx and the wiring in starter/src/app/layout.tsx, add the `app` block from starter/design/tokens.json to your own tokens, and run `npm run theme:build`. Gate G12 (`npm run audit:pwa`) then tells you what is still missing, by name. Until you do, G12 is INERT in your app rather than baselined - you have no .baselines/pwa-baseline.txt, so the ratchet prints a loud SKIPPED on stderr and passes. That is deliberate, and it is stated here rather than dressed up: an absent baseline is an unenforced gate, not a clean one. Run `node scripts/audits/check-pwa-baseline.mjs --write-baseline` to freeze where you actually are and start ratcheting down.

---
## 1.30.0 — 2026-09-10 — MINOR

**Three checkers were describing their own invocation, not the tree**

A checker must describe its subject. Three in this repository described the circumstances of their own run instead, and each looked like an unrelated complaint. The theme builder baked a cwd-relative path into every generated file, so identical tokens produced different bytes from the framework root and from starter/ - and its own byte-comparison then reported DRIFT, "stale or hand-edited", on files nothing had edited. The gate runner never asked where, inside the subject, the application lives: G5-G8 ran tsc, eslint and the app's test scripts against the framework root, which deliberately has no tsconfig and no test scripts, so the gate recorded BLOCKED in 24 of the 27 runs in TEST_SUMMARY.md - always the same four steps, always telling the reader to install a toolchain into a package.json that would never carry it. And the runner wrote its tree fingerprint after any run, including a two-step --only run, so npm run guard:test stamped "this tree has been gated" on trees that had not been, and the next mandatory run announced itself avoidable. A fourth instance of the same family: the CI workflow enumerated the audits by name, making it a hand-maintained copy of audit:all that had already drifted - audit:fixtures and audit:deadweight could not fail a pull request, under a file header reading "if CI and local run different checks, one of them is decoration".

Full analysis: `docs/registers/ROOT_CAUSE_REGISTER.md` **RC-009 - a checker must describe its subject, not its own invocation; and only a run that verified the thing may record that the thing was verified.**.

### Added
- scripts/theme-build.test.sh - 5 cases: identical tokens build byte-identically from any directory, --check agrees from both, the header path is followable, and a genuinely hand-edited file is still caught
- scripts/gate-scope.test.sh - 12 cases: the application subtree in both layouts, the BLOCKED remediation naming it, and the fingerprint contract from both ends

### Fixed
- theme-build.mjs names the token source relative to the generated file's own directory, so the build is a function of its inputs alone - and yields the same string in both layouts, ending the phantom upgrade churn on the two generated theme files
- gate-runner.mjs resolves the application subtree through appPath(), the helper every audit already uses; G5-G8 run there, resolve their local binaries from there, and the report states the directory. A BLOCKED step now names where to install
- gate-runner.mjs writes the tree fingerprint only after a run narrowed by neither --only nor --skip, so the redundancy notice can no longer fire on a run that was mandatory
- gate-runner.mjs gains --logdir, so a harness driving the real runner keeps its step logs out of the subject's .gate-logs/ instead of leaving logs describing a run nobody performed
- ci/github-actions-ci.yml calls audit:all instead of restating it - two of the ten audits had been missing from CI, and the copy that could drift no longer exists
- close-out.mjs takes its commit trailers from the record instead of hardcoding one, so a generated commit message can no longer carry two Co-Authored-By lines naming the same author differently
- close-out.mjs wraps the App action line like every other field - it was the one line pushed unwrapped, and the suite's width assertion could not see it because the fixture's appAction was short enough never to overflow
- close-out.mjs prints its "===== SECTION =====" banners only under --all. With one rendering selected the output is a single document the caller will redirect, and the banner became the commit's subject line - which this repository did once, to itself

### Stated as honest debt, not papered over
- The conformance fixtures still carry no src/theme/, so no fixture exercises a generated artifact across the scaffold-then-rebuild path. The two new suites test the builder and the runner directly, which closes the defect but not the fixture gap.
- TEST_SUMMARY.md is append-only and read by no script. The gate wrote the same verdict on the same four steps for 24 consecutive runs and nothing noticed, because a signal that never changes is indistinguishable from no signal. A rule that nothing executes is not a rule; an output nobody reads is not a signal.

### App action required
Nothing required, and the upgrade is quieter than it used to be. The two new suites arrive green, so they cannot turn an existing app red. src/theme/tokens.generated.css and .ts arrive with a new first line - the token source is now named relative to the generated file itself (../../design/tokens.json), which reads the same in the framework and in your app. Take them; they are generated files and nothing else in them changed. That identical-in-both-layouts header is the point: your app rebuilds the theme at scaffold time, so until now every app differed from its own recorded seed and the upgrader auto-overwrote both files on EVERY upgrade, whether or not a token had moved. That churn stops here. If you run the gate from your app root, expect one new line in the report - "Application steps ran in ." - naming the directory the type, lint and test steps were aimed at.

---
## 1.29.0 — 2026-09-10 — MINOR

**Six design directives, built once so no application builds them again**

Six corrections arrived together, and five of them were the same shape: a rule the framework already stated in prose with nothing implementing it. Confirmation on destructive actions was written down and had a component; undo was written down beside it and had nothing at all — the bulk-action bar shipped a one-click delete over a selection built by shift-clicking. "Scope is the visible set" was a sentence in the bulk-selection pattern that no checkbox implemented, because there were no checkboxes. Tabs had a component, a scroll rule and a keyboard rule, and no styling whatsoever, so the selected tab was distinguished by nothing. A rule nothing executes is not a rule, and the cheapest place to execute these is the shared component every application already reaches for. So each directive lands as working code in the reference implementation with a rung under it, not as another paragraph.

### Added
- **A designed full-surface wait** — `src/lib/loading.ts` + `src/components/LoadingScreen.tsx`. It says what is being made for the user (configurable copy, defaulting to "We're working for you, making things for you."), draws the pipeline as a `currentColor` line diagram needing no per-theme asset, marks the active stage in words as well as colour, and past a threshold **stops pretending**: it reports that the wait has gone wrong and offers a route onward. Thresholds are settings; a misconfigured pair is repaired rather than left with the stalled state unreachable.
- **One itemised price breakdown** — `src/lib/pricing.ts` + `src/components/PricingPanel.tsx`, CP-29. Items, adjustments, tax and the emphasised payable, in one order, on screen and in print. The rows shown add up to the total shown, because each row rounds once and the total is the sum of the rounded rows. Pass-through money is owed by the payer and kept out of revenue. An over-discount is reported, never clamped to zero behind the user. Currency formatting is the existing shared formatter, not a second one.
- **Undo, actually implemented** — `src/lib/undo.ts` + `src/components/ToastHost.tsx`, CP-28. Undo is a **deferred commit**: the effect is held for the window and committed when it closes, so Undo is a local cancel that cannot fail — unlike the compensating write, which tells the user "Undone" about a change that is still there. The queue never drops a pending action: overflow commits early and unmount drains.
- **Row and header selection** — `src/lib/selection.ts` + `src/components/SelectionColumn.tsx`, CP-18 amended. A checkbox on every row, a three-state header checkbox (`some` renders indeterminate), select-all scoped to the **visible** set, shift-select over the visible order, and a filter change that drops what left the view and says how many.
- **DR-3, the selected tab** — every tab carries a visible border, and the selected one differs by fill, border and weight together, on the contrast-asserted `primarySurface` / `onPrimarySurface` pair. Styling hangs off `aria-selected`, so what is drawn and what is announced cannot disagree.
- `src/components/components.css` — one token-only stylesheet for tabs, toasts, the wait, the price breakdown and row selection. No colour literal; every pair used is asserted by the contrast gate in both themes.

### Fixed
- **The bulk-action bar had a one-click delete.** The highest-consequence control in the starter, over a selection the user may not be able to see all of, with no confirmation at all. It now routes through `ConfirmDialog` with the count and the scope named in the message and the verb on the button. Archive stays one click — it is reversible, so its safety net is Undo, and confirming it too is how a user learns to click through the dialog that matters.
- **The column-control audit counted `<th scope="row">` as a column.** A correct three-column table with a row header was reported as four and told to add a column control. That is worse than a miscount: the cheapest way to satisfy it was to demote the `<th>` to a `<td>` and lose the accessible row name — a gate pushing an accessibility regression to make itself green. Only column headers count now; an unmarked `<th>` still counts, so a genuinely wide table cannot slip past.
- **`BulkBar` described the selection in its own words.** It now uses `selectionSummary` from the shared module, so the bar and the header checkbox cannot drift into two wordings for one selection.

### Stated as honest debt, not papered over
- TD-002 — the addressability audit reads an opening tag with a `[^>]` scan, so it stops at the first `>` (an arrow function's included) and cannot see attributes after one; it also matches a tag written inside a comment. Both are false positives. Fixing it needs a JSX parser; the convention (`data-testid` ahead of any arrow-function prop) costs nothing and is now recorded rather than folklore.
- The two tab targets added to the render contrast spec are NOT OBSERVED FAILING: they need a browser and a running application, which this environment has neither of. The token pair they assert is verified by G2 in both themes.

### App action required
**Nothing is required.** Every change is additive: four new modules, four new components, one new stylesheet, and amendments to three patterns and one audit. No existing export changed shape and no rule became stricter about code you have already written.

What you may want, and in what order:

1. **`BulkBar` gained an optional `subject` prop** (`{ one, many }`) used in the delete confirmation, defaulting to `record` / `records`. If you use `BulkBar`, pass what your rows actually are — "Delete 3 records" is worse than "Delete 3 invoices", and the default is a placeholder, not an answer. **Note the behaviour change:** bulk delete now opens a confirmation instead of firing immediately. If your `onAction('delete', …)` handler had its own confirmation, remove one of the two.
2. **If any list of yours supports multi-select**, adopt `SelectionColumn` + `lib/selection` rather than keeping a local implementation — the three-state header and the filter reconciliation are the parts that are easy to get subtly wrong.
3. **If you show an amount payable anywhere**, adopt `PricingPanel` + `lib/pricing`. If your totals are computed in more than one place today, that is the defect CP-29 exists for.
4. **If you have a full-surface loading state**, `LoadingScreen` replaces it and gives you the stalled case for free.
5. **Tabs:** if you render `TabRow` and import `components.css` (the component imports it itself), your tabs pick up DR-3 styling. If you style tabs yourself, check them against DR-3 — border always, and the selected state differing by more than colour.
6. **The column-control audit will now count one fewer column** on any table with a `<th scope="row">`. If such a table sits in your baseline, regenerate it (`node scripts/audits/check-column-control.mjs --write-baseline`) — a fixed-but-still-listed entry blocks.

---
## 1.28.0 — 08-Sep-2026 — MINOR

**CP-27 - the audit trail, as a reusable component**

Owner requirement: wherever RBAC is enabled, record it - a super admin creating an account, assigning a role, or customising which features a role can reach. An audit log is the record you reach for on the worst day, and it is worth exactly as much as its weakest row, so the four ways it goes quietly worthless are each closed by a rule with a spec behind it.

### Added
- **`starter/src/lib/audit.ts`** - the model and the rules. **An entry with no real actor is not an entry**: a background job is `System (<process>)` and names the process; a *user* action whose identity did not resolve is `Unknown (<id>)` and is never dressed up as System - RC-007 shipped exactly that, and a plausible wrong author is never discovered while an ugly one gets fixed. **A row never carries the secret it audits**: 'Password changed' is the record, the password is not. **A change that did not happen must not appear**: arrays compare as SETS, so re-serialising a role list in a different order is not a role change, and null / undefined / empty string are one absence. **Append-only**: the module exports no updater and no deleter, and a spec asserts that it never grows one.
- **`starter/src/components/AuditLogTable.tsx`** - the seven columns asked for: what changed, screen/module, previous value, new value, modified by, modified at, remarks. Search, module filter, date presets and sorting come from **CP-23**; the column picker from **CP-21**, which seven columns require. The component is read-only by construction - no row menu, no edit, no delete, and nowhere to add one without editing the file. It also **counts unattributed entries on screen**, because an identity-resolution defect that shows as one 'Unknown' among hundreds never gets fixed.
- **Three RBAC event builders** for the named cases: account created, roles changed, feature access changed - the last recording the whole enabled SET before and after, since 'granted Billing' alone cannot answer 'what could they reach in March'.
- **CP-27**, two COMPONENT_LIBRARY rows flipped straight to READY (a baseline concern, contributed in this run), and cases FW-AUDIT-001..005.

### Fixed
- **A memo bug caught while composing, not after shipping.** `useListControls` memoises on its config BY IDENTITY, so the inline object literal every other caller would write is a new object each render - silently defeating the memo and re-filtering the whole log on every keystroke. Invisible at ten rows; the reason a search box feels heavy at ten thousand. The config is memoised, with the reason recorded at the call site.

### Stated as honest debt, not papered over
- **The component is built and registered; nothing mounts it.** Where the audit log appears, and which events an application records beyond the three RBAC builders, is the application's call - this repository holds no application.
- **Persistence is the application's too.** The library produces entries; storing them append-only, and keeping them readable only by those who should see them, is a schema and policy decision per app.
- **The 19 assertions ran against the esbuild-compiled lib** using a local harness, because this repository has no node_modules - the same route earlier component releases took. Two defects were injected (unresolved-actor-becomes-System, and positional array comparison) and both were observed failing before revert.

### App action required
None required. To adopt: render `AuditLogTable` wherever roles or access can be changed, and call the three builders from those flows. If your app already logs RBAC changes, check two things against CP-27 - that an unresolved actor is not being written as 'System', and that role lists are compared as sets rather than positionally.

---
## 1.27.0 — 08-Sep-2026 — MINOR

**the request pre-sorter is withdrawn**

Owner decision, one release after it shipped. It classified a SINGLE sentence, and a real chat carries several requests at once - so its input was ambiguous exactly where the stakes are highest, and a confident wrong route costs an entire track. Set against that, it never demonstrated a measured saving: the case for it rested on one run's ground stage which also contained a long design conversation. Removing an unproven mechanism that can be confidently wrong is the correct trade, and the framework's own rule-budget guidance says to propose compaction, not only growth.

### Fixed
- **Removed `scripts/classify.mjs` and `scripts/classify.test.sh`**, the `classify` npm script, and the `classify` suite from `guard:test` (ten suites back to nine). The manifest and the overview no longer list them. **Classification is a reading task again**, done at `workflows/request.md` R1, which never stopped being the authority on what the classes mean.
- **`workflows/request.md` records the withdrawal rather than quietly reverting.** A step that appears and disappears with no trace invites the same idea to be re-proposed and re-built; the note says what was tried and why it was removed.

### Stated as honest debt, not papered over
- **Cases FW-CLASS-001..002 are RETIRED, not deleted**, and their IDs are not reused - the feature is gone, so the cases are marked rather than left describing a script that no longer exists.
- **The routing question is open again, and honestly so.** Nothing measured was lost here. If it is revisited, the lesson is recorded: a router must take the SET of requests in a conversation, not one sentence, and it must still be allowed to answer UNSURE.

### App action required
None. If you scripted `npm run classify`, it is gone; use /request. Nothing else changed shape.

---
## 1.26.0 — 08-Sep-2026 — MINOR

**delete is a declared contract; verification is per commit; requests are pre-sorted**

Three things in one release, deliberately: the release itself demonstrates the middle one. Corrections that land in one commit share one verification pass, so batching them is not a shortcut - it is the correct unit.

### Added
- **CP-26 - deleting a record.** The reported defect was 'Supabase soft-deletes where the frontend expects a hard delete'. The backend was behaving exactly as the reference schema intends: status active|archived, a PARTIAL unique index, and no delete policy granted at all. **The defect is that the two layers disagree about what delete means, and each is self-consistent** - which is why a row returning on refresh, a re-add hitting a unique constraint and a stale id 404-ing present as three unrelated bugs. Every entity now declares ONE model in writing - ARCHIVE or REMOVE - and the assertion is a **round trip**, never the response to the delete call, which only proves the request was accepted.
- **A3.3b-delete in `feature.md`** - the design pass asks the question before any delete control is drawn. Unasked, each layer picks an answer independently, and both are defensible.
- **The gate names an avoidable run.** It verifies a TREE, not a change, so re-running it after each correction in one tree re-verifies the same tree N times - only the last run describes what ships. When the tree is byte-identical to the previous run the report says so. A NOTICE, never a block and never a cache: a gate that skipped work because it believed nothing had changed would be trusting a fingerprint over the code.
- **`classify.mjs` - the request pre-sorter**, the first piece of the routing question. One command sorts the obvious requests into their track before any agent reads the nine-row table, and **answers UNSURE rather than guessing**. NEW vs NEW-APP it settles by looking for a source tree, because that is a fact about the repository and no amount of re-reading the sentence can answer it. `workflows/request.md` R1 remains the authority on what the classes mean.
- Cases FW-DEL-001..002, FW-VERIFY-001, FW-CLASS-001..002. `classify.test.sh` (18 executed cases) joins `guard:test`, now ten suites.

### Fixed
- **The redundancy notice could never have fired, and its own test caught that.** The fingerprint counted TEST_SUMMARY.md and .gate-logs/ - which every gate run rewrites - so it differed from the previous run BY DEFINITION. The detector was reading its own output as evidence, the one thing a detector in this repository may never do. Observed failing exactly that way before the exclusion existed.

### Stated as honest debt, not papered over
- **`classify.mjs` decides the clear cases only, and that is the design.** 'improve X' and requests that read as both broken and preferred are refused with exit 3 and the one question to ask. A router that answers everything answers some of them wrongly, and a confident wrong route costs an entire track against the seconds this saves.
- **The remaining routing decisions are still made by reading.** This release converts the first one. The measured case for doing more rests on a single run's ground stage (13 of 25 minutes) which also contained a long design conversation - an upper bound, not a clean reading. Two or three more runs before converting the next one.

### App action required
None mechanically. If your application grants a delete policy or offers a Delete control, declare its model against CP-26 - and check the control's wording, because a button labelled Delete that archives is a lie the user acts on.

---
## 1.25.0 — 08-Sep-2026 — MINOR

**four levers on execution time, aimed by measurement**

Owner report: runs take too long, and the proposal was to replace English decision-making with code. Measured first, on this repository: the whole mechanical stack was ~87s against runs of 27 to 65 minutes, and instruction-interpretation was the SMALLEST term, not the largest. So the four changes here are aimed where the time actually is - generation, sequential checking, and repeated judgement - and the routing question is deliberately still open.

Full analysis: `docs/registers/ROOT_CAUSE_REGISTER.md` **RC-008**.

### Added
- **Stage breakdown in the run log.** `run-log.mjs stage <ground|plan|build|verify|gate>` marks each boundary from the clock, and the row carries `ground 4m · plan 2m · build 14m` beside the total. Closes the last part of FW-SPEED-003 that was still prose: a total says a run was slow, only the breakdown says what to fix. An unmarked stage is absent, never `0`.
- **`par.mjs` - independent checks run concurrently.** `audit:all` 17.7s to **5.7s**; `guard:test` 60.2s to **29.4s**; the mechanical stack **87s to ~41s**, now nine suites rather than six. It also aggregates every failure instead of stopping at the first, so one run tells you everything that is wrong. It deliberately does NOT parallelise the gate, whose order is a prerequisite chain: there is no value in running a browser suite against code that does not compile.
- **`review-plan.mjs` - the review matrix, executed.** Reads the diff and names the passes: scale derived and justified, reviewers selected with reasons, the same diff twice giving a byte-identical plan. The matrix in `workflows/agents/README.md` now points here for SELECTION and keeps the job of saying why each pass exists.
- **`close-out.mjs` - write the release story once.** One record renders the upgrade section, the changelog paragraph and the commit message. Generation is the dominant cost of a run, and telling the same story four times by hand was the largest single block of writing in a close-out - three quarters of it transcription. The record carries the real sentences; the script owns only scaffolding and repetition.
- Cases FW-STAGE-001..002, FW-PAR-001, FW-PLAN-001..002, FW-CO-001..002. Two new executed suites (`review-plan.test.sh` 20 cases, `close-out.test.sh` 23) in `guard:test`.

### Fixed
- **The visible-string detector, twice, before it shipped.** It first looked only for QUOTED strings and so read a component full of user-facing sentences as having none - most React copy is JSX text, which carries no quotes. Broadened to JSX text, it then matched `=> <div`, the arrow function returning JSX that almost every component is written with, which would have selected the copy pass on nearly every change. A pass that fires on everything is noise, and a noisy pass stops being read. Both were caught by their own negative cases.

### Stated as honest debt, not papered over
- **Only the gate stage arrives measured.** Ground, plan, build and verify are marked by hand, because nothing observes wall-clock across an agent's stages - there is no hook to attach. Honest, but a mark that is forgotten leaves a gap rather than an error.
- **`review-plan.mjs` cannot see history or schema intent.** Hotspot status is declared, never inferred; a migration is detected but never judged safe. Both are stated in its output rather than guessed at.
- **Deterministic ROUTING - the owner's original proposal - is not implemented here.** It is the smallest measured term of the four, and the brainstorm on it is still open.

### App action required
None. Two npm scripts changed shape (`audit:all`, `guard:test`) and now run concurrently; `--serial` variants are kept as the escape hatch for isolating a failure. Everything else is new and optional.

---
## 1.24.0 — 08-Sep-2026 — MINOR

**The run log — what was asked, which kind of request, and what it actually cost.** Owner
request, immediately after v1.23.0 taught the gate to measure itself: keep an audit log of runs.

### Added
- **`docs/registers/RUN_LOG.md`** — one row per run, newest first, append-only:
  **ID · Action · Type · Scale · Started · Ended · Total · Gate · Verdict · Notes.**
- **`scripts/run-log.mjs`** (`npm run runlog`) — `start`, `end`, `status`. **The rows are
  written by the script, not by hand**, and that is the whole design: a start time entered when
  the run is already over is a recalled time, and a duration built from two recalled times is
  an estimate presented as a record. This framework has already paid for that once — RC-008,
  where a stage-timing *rule* produced no measured number for three versions because the only
  party asked to honour it was a narrator. Writing the same log as a markdown template would
  have repeated it exactly.
- **`end` without `start` exits 3 (BLOCKED) and writes nothing.** It does not invent a start
  time. A log whose durations are sometimes measured and sometimes guessed is worse than no
  log, because nothing on the row says which kind each one is. Back-filling is supported but
  **explicit** — `--started <ISO>` — and the row's Notes cell says `back-filled start`.
- **`Gate` sits next to `Total` on purpose.** The gate's own cost is lifted from the newest
  `Time:` line in `TEST_SUMMARY.md` — the number v1.23.0 made available — so every row answers
  the first question a long run raises: *was it the machine or the agent?* The whole mechanical
  stack measures ~87s, so a fifty-minute gap between those columns is not the tooling.
- **Wired at both ends, or it would be another unenforced rule**: `/request` **R1** opens the
  log *before* classifying, and `DEFINITION_OF_DONE.md` closes it. `run-log.mjs status` reports
  what is still open — an unclosed run is not a fast run, it is an unmeasured one.
- **`scripts/run-log.test.sh`** — 23 executed cases in `npm run guard:test`. Fail-first by
  **defect injection** twice: `end` was made to invent a start time (both honesty assertions
  observed failing), and the row anchoring was reverted to its original form (the regression
  case below observed failing). Both injections were reverted.

### A defect the first real use found, and the case that now holds it
Seeding the register's first two rows filed them into **the wrong table**. The file explains its
columns before it lists anything, so the first markdown table in it is the glossary — and
`appendRow` anchored on "the first separator". The rows rendered as documentation, and **the
write still reported success**. It now anchors on the data table's own header
(`| ID | Action | Type | …`) and refuses a file that has none, rather than guessing. A register
that silently files entries where nobody reads them is worse than one that refuses.

### The type vocabulary is the one `/request` R1 already uses
`NEW-APP` · `NEW` · `CHANGE` · `BUG` · `REFACTOR` · `TRIAGE` · `BRAINSTORM` · `FRAMEWORK` —
covering the owner's four names (new app · new feature · functionality correction · bug
correction) plus the tracks that produce no request file but still consume time. A second set
of names for one concern means two different answers to "how many bug runs did we do".

### App action required
**None.** New register and script; nothing existing changed behaviour. Apps that want the log
run `node <framework>/scripts/run-log.mjs start …` at the top of a run and `end` at the
close-out; the register is created from the template on first use.

---

## 1.23.0 — 08-Sep-2026 — MINOR

**Verification was the longest stage in every run, and nothing measured it.** Owner report:
corrections finish quickly, verification "often exceeds one hour". Full analysis:
`docs/registers/ROOT_CAUSE_REGISTER.md` **RC-008**.

### What the measurement actually showed
`audit:all` **17.7s** · `guard:test` **60.2s** · `npm run gate` **8.6s** — about **87 seconds**
for the entire mechanical stack, roughly **2.4%** of the reported hour. The scripts were never
the bottleneck. The other ~58 minutes were agent-side and completely unattributed, because
`grep -rniE "elapsed|duration|hrtime|performance\.now|Date\.now\(\)" scripts/` returned
**three matches, all CSS `animation-duration`**.

### The two failures
1. **A rule with no rung — this framework's own first idea, failing on itself.** v1.13.0
   shipped "run reports carry stage timings", case **FW-SPEED-003**, whose anti-pattern reads
   *"a slow run with no timing data, diagnosed by feeling."* Nothing executed it; the only
   party asked to honour it was the narrator. Three versions later the first real report of
   slowness arrived in exactly that shape.
2. **Proportionality was applied to half the run.** v1.19.0 gave the **build** side three lanes,
   v1.20.0 parallelised generation, and the review matrix scaled *who reviews*. Nothing scaled
   *what verification executes*: `test-gate.md` had nine T1 sub-steps, each marked
   **(blocking)**, and no scale column — so a two-file label fix enumerated the same constraint
   and configuration space as a schema migration.

### Added
- **The gate measures itself.** `scripts/gate-runner.mjs` records per-step wall-clock and
  prints `Time: <total> total - slowest <id> <name> (<duration>)` plus a duration on every step
  line, into the append-only `TEST_SUMMARY.md` — so the trend accrues with no upkeep. A step
  that **never spawned prints `-`, never `0ms`**: zero is a measurement, and a step that did not
  run has none; printing zero would make the cheapest possible run look like the fastest one.
- **`scripts/gate-timing.test.sh`** — 8 executed cases, wired into `npm run guard:test`. Four
  were **observed failing** against the pre-timing runner; the other four are regression guards
  on the verdict contract and correctly pass in both trees (a gate that got faster and lost its
  three-valued verdict would be a worse gate wearing a stopwatch).
- **The verification lane** (`workflows/test-gate.md`) — which T-steps run at micro · scoped ·
  full-scale, keyed to the **same `SCALE:` declaration guard G8 already verifies against the
  diff**. No new token, no new guard, no addition to the rule budget. What shrinks is the
  *enumeration of classes the change cannot reach*; **T1.5 fail-first, T1.6 the registry delta
  and T2 the mechanical gate are marked "never scales"**, and a skipped row is discharged in
  `TEST_SUMMARY.md` with its reason — never silent.
- Cases **FW-SPEED-006..009**; **FW-SPEED-003 updated in place** to name its rung and to state
  plainly that the four non-gate stages remain narrator-reported.

### Stated as honest debt, not papered over
**Only the gate stage is mechanically measured.** Ground · plan · build · verify are still
narrator-reported, because nothing in this framework observes wall-clock across an agent's
stages — there is no hook to attach. FW-SPEED-003's rung is scoped to the gate stage and says
so. Equally, **G8 verifies a `micro` claim against the diff, but a `scoped` claim on a
full-scale change has no mechanical rung** and is review-only. Both are recorded in RC-008
rather than disguised as coverage.

### Why the rule-coverage audit reported a clean gate over this
`check-rule-coverage.mjs` reads `CANONICAL_PATTERNS.md`, `ROOT_CAUSE_REGISTER.md` and
`DESIGN_RULES.md` — IDs `CP|RC|DR|FP`. `FW-*` process cases are outside its population, so
"backlog is zero" was true of what it reads and silent about this rule. The audit did not
overclaim; its scope simply never included that register. Left as-is this release: widening it
is a change to a ratchet's population and deserves its own run, not a footnote in this one.

### App action required
**None.** The gate prints more; it decides exactly as before, and no check was removed. The
verification lane is available on the `SCALE:` field your runs already declare.

---

## 1.22.0 — 06-Sep-2026 — MINOR

**Seventeen defects reached a user through a green run. Three process failures, closed.**
Full analysis: `docs/registers/ROOT_CAUSE_REGISTER.md` **RC-007**.

### The three failures
1. **Rules with no rung.** "A save is proved against the data, never the toast" is a
   Definition-of-Done item *and* a documented spec habit — and both false-success defects
   walked past it, because nothing executed it.
2. **Rules that did not exist.** Nothing said an edit surface must arrive populated, that an
   unchanged save must round-trip untouched fields, that selection is keyed by database id,
   or that placeholder data must not reach shipped source.
3. **Capabilities re-implemented instead of reused.** The library's dialog already uses the
   `overlay` token (verified correctly translucent in both themes), CP-11 already forbids raw
   engine strings, CP-8 already covers fixed-chrome clearance. The black backdrop, the raw
   database error and the keypad overlap were each a re-encounter of a solved problem.
   **Rebuilding a registered component re-inherits every bug it had already fixed.**

### Added
- **`scripts/audits/check-fixture-leak.mjs`** + `npm run audit:fixtures` (now in `audit:all`) —
  ratcheted detection of fixture-path imports, placeholder-named literals (`MOCK_*`,
  `sampleRows`) and hardcoded datasets in shipped source. Verified: clean across the
  framework's own 43 source files with **no false positives** (a legitimate `STATUSES`
  constant is not flagged), and observed **firing on all three leak shapes**.
- **CP-25 — editing an existing record.** An edit surface loads before it renders: populated
  fields, selected multi-selects, edit mode addressed by **database id** — never the create
  form with a different title, never keyed by a label two records can share. **An unchanged
  save is a no-op**: every field the form did not load still round-trips, because a field
  returned empty destroys the stored value silently. Rung: three new journeys in
  `starter/tests/functional/reference.functional.spec.ts`.
- **CP-15 amended in place** (superseded text kept): a date arriving by import, paste or API
  bypasses the picker, so it is **unambiguous or rejected** — `01/09/2026` is two different
  days, and accepting it silently picks one.
- **`workflows/bug.md` C2b** — the five classes a green suite does not see (claimed success ·
  placeholder data · edit parity · non-unique key · resolved actor), each with the assertion
  that catches it.

### Stated as honest debt, not papered over
The **false-success** class keeps a rule, a DoD item and a reference assertion but **no
automated rung**: deciding "asserts a toast but never asserts the write" requires knowing
which assertion is the effect, which a scanner cannot. The rule budget forbids minting a
fourth restatement of a rule that already exists, so this is recorded as debt in RC-007 rather
than disguised as coverage.

### App action required
**None mechanically** — the new audit arrives baselined at your current state
(`node <framework>/scripts/audits/check-fixture-leak.mjs --write-baseline`). The six
application-domain defects (sign-out routing, existence checks before the PIN screen, actor
propagation) have their classes named in `bug.md` C2b; their fixes belong in the application's
own `/bug` runs.

---

## 1.21.0 — 06-Sep-2026 — MINOR

**Reuse before you build — made a step, not an aspiration.** Owner finding: nothing in
`framework-update.md` ever asked whether a correction should become (or already was) a reusable
component. So the same capability could be rebuilt per application, and a shortfall in a shared
component could be worked around locally — leaving the gap in place for every other app.

### Added
- **Route B step 0 — the reuse check, first, always.** Read `COMPONENT_LIBRARY.md` and
  `CANONICAL_PATTERNS.md` for every concern the correction touches. If it exists, the
  correction is "wire it up", not "write it again".
- **Route B step 4 — the capability decision, recorded every run**, one of four:
  **REUSE** (it exists — delete the local re-implementation) · **REFINE** (it exists but falls
  short — improve the *shared* one so every app gains it; a local workaround forks this app and
  abandons the others) · **CONTRIBUTE** (a baseline concern that does not exist yet — generalise,
  place, flip GAP→READY in this run) · **PARK / APP-ONLY**. *"App-only" is a valid answer;
  silence is not.* `starter/**` and the library register are now in the governed-files table.
- **Four components**, each closing a standing GAP and each reusing rather than duplicating:
  `ConfirmDialog` (composes CP-14; destructive variant separated and **named** — never "OK";
  reversible actions still use undo, not confirmation) · `MoreMenu` (overflow menu; sign out
  isolated at the end and routed through confirmation) · `HelpSupport` (email · call · WhatsApp
  as real links, every channel worded, absent details render no dead channel) ·
  `text-format.ts` (sentence case that **never lowercases the tail** — the naive version turns
  "WhatsApp" into "Whatsapp").
- **`DESIGN_RULES.md` gets its first rows**: **DR-1** sentence case (rung: the unit spec; the
  rule over arbitrary strings is honestly declared review-only) and **DR-2** session ends when
  the user says so — survives reload and backgrounding, ends on explicit sign out, for JWT and
  username/password alike.

### Fixed
- **The `/framework-update` command shim had drifted**: it said "triple close-out" and listed
  three legs, omitting **VERSION** — the one leg that makes a change reachable by an app's
  upgrade command. Now quadruple, matching the workflow.

### Already existed — reused, not rebuilt
Search / filter / sort (**CP-23**), non-dismissible dialogs and the unsaved-changes guard
(**CP-14**), dialog-instead-of-navigation (docs/04 §5 + docs/24 §4), custom UI selection
(`ModuleCustomizer`), role-based access (`ModuleAccessPanel`). The requested list named these;
none was re-implemented.

### Still open, registered honestly as GAP rows
Session persistence (policy stated as DR-2) and PWA install. Both are baseline concerns with no
code yet; the first application to build either contributes it back.

### App action required
**None.** New seed files and process steps.

---

## 1.20.0 — 06-Sep-2026 — MINOR

**Validated parallel build — the only lever that shortens generation.** Aimed deliberately:
wall-clock in an agent run is dominated by token *generation*, not reading. Writing several
hundred lines is the slowest single act in a run; file reading is fast prefill and v1.13 already
trimmed it. Concurrent lanes are therefore the only remaining change that attacks the actual
bottleneck.

### Added
- **`scripts/fanout-check.mjs`** (+ `npm run fanout:check`) — validates a parallel-build plan
  **before any agent is spawned**, which is the cheapest possible moment. It BLOCKS on:
  a file written by two tasks (the lost-write failure — both agents report success and one's
  work is gone) · a task reading a file another task is rewriting (the race read) · a task with
  no declared `contract` or `acceptance` · a duplicate id · an empty or unparseable plan. It
  WARNS, without blocking, below three tasks, where per-agent context costs more than it saves.
- **`scripts/fanout-check.test.sh`** — 11 executed cases, wired into `npm run guard:test`.
  Every block was observed firing and every pass observed passing before commit.
- **`implementation-builder` agent** (`.claude/agents/` + the `.codex/` twin, descriptions
  generated identical): builds ONE task inside its declared file lane, implements against
  declared contracts, and may never write outside `files`, change a declared signature, or run
  the gate. Verdicts: `DONE` · `BLOCKED` · `CONTRACT-DEFECT`.
- **Contract-first** is the rule that makes it work: shared signatures are written by the
  planner *before* any lane starts. Interface drift found at integration costs every lane that
  built on it; a contract defect found before spawning costs one message.
- `feature.md` A5 and `docs/01` Stage 5 carry the rule; integration and the gate run **once,
  centrally**, and a lane that gates alone is testing a half-built tree.

### The limit, stated plainly
**Fan out the build only.** Design and planning are sequential by nature — each stage constrains
the next — and a **reviewer cannot run concurrently with the code it reviews**: a reviewer
reading a half-written file produces findings about code that no longer exists, which is rework
wearing the costume of speed. Build in parallel; review after. Never at `micro` scale.

### App action required
**None.** New scripts and a new agent; `guard:test` gains a suite.

---

## 1.19.0 — 06-Sep-2026 — MINOR

**The micro lane — proportional process for the change you make every day.** Owner report:
even a small correction takes too long. Root cause: the lightest path was `scoped`, which
still runs a design pass, a QA verdict table, a plan document, an assumptions ledger and a
spawned reviewer. For "change this label" that is absurd — and it is why a two-minute fix took
twenty.

The fix is **differentiation by risk, not thinning by default.** The earlier lighter workflow
was fast because it applied one thin process to everything — fast on small changes, and the
source of the design gaps this framework was built to close. Three lanes keep both properties.

### Added
- **`micro` scale** (`docs/01` §Run modes, `enhance.md` **B0**, `bug.md` **C0b**,
  `feature.md` Step 0). Entry test, all required: **≤2 source files · no schema change · no
  new screen, route or component · no new dependency · no permission change · no invented
  user-visible string · not a hotspot file · not CORRECTION ROUND ≥ 2.**
  It **skips** the impact table, the clarification round, the plan, the design pass and the QA
  verdict table. It **keeps** every mechanical gate, the diff-traces-to-request rule, the copy
  freeze, canonical patterns, both-theme and keyboard verification, and all hard stops.
- **Guard G8** (`scripts/hooks/pre-commit-guard.sh`) — the rung. A commit declaring
  `SCALE: micro` is checked **against its own diff**: more than two source files, a migration,
  a newly added component, or a dependency change → BLOCKED, with one instruction: *promote to
  scoped*. Silent when micro is not claimed; `MICRO-NA:` excuses only this guard.
  Guard suite grows 10 → **17 executed cases**, seven of them G8: each block observed firing,
  each pass observed passing.
- **Mid-run promotion is stated, never silent.** A disqualifier discovered during the run
  promotes it to scoped and discharges the skipped obligations out loud.
- **Round ≥ 2 is refused the lane** — a fix that did not hold gets the full "what did the last
  attempt miss" analysis. Making the second attempt cheaper is how a two-round loop becomes a
  five-round one.
- Review matrix gains a micro column: no planner, no parity, no permission pass; `code-reviewer`
  spawned **only when a shared or exported symbol is touched** — the moment two files acquire a
  twenty-file blast radius, and the thing an inline reviewer who just wrote the code sees worst.
- `REQUEST_CHANGE.md` gains a `SCALE` field. Cases FW-MICRO-001..004.

### App action required
**None** — but note `scripts/hooks/pre-commit-guard.sh` changed. Workspace-mode apps get it
through the link; standalone apps pick it up on the next `framework:upgrade`.

---

## 1.18.0 — 06-Sep-2026 — MINOR

**CP-24: analytics and dashboards become a reusable module.** Owner directive: every business
application needs a dashboard, and regenerating one per app is both slow and inconsistent. A
dashboard is now **configuration, not code** — the largest single block of generated code
removed from a new-app run.

### Added — `starter/src/lib/analytics/` (pure) + `starter/src/components/analytics/`
- **Metric model** (`metrics.ts`): `MetricDefinition` (dataSource · aggregation · format ·
  comparison · target · priority · visualization · breakdown · visibleTo · actions) and the
  aggregations `count · sum · avg · min · max · distinct · ratio · percentage`.
- **Four honesty rules, enforced in code and covered by the spec:**
  **(1) Direction is not sentiment** — `higherIsBetter: false` makes rising expenses, churn,
  cancellations and outstanding report as *bad*; the arrow says which way, the **word** says
  whether that is good. **(2) Growth from zero is `null`**, never `+∞%` or a silent `+100%`.
  **(3) An absent value renders `—`, never `0`** — and suppresses its comparison.
  **(4) Role-restricted metrics are REMOVED** from the resolved config, not CSS-hidden.
- **Formatting** (`format.ts`): currency with the lakh/crore ladder *or* K/M/B, percent,
  compact, duration, dates — locale and convention are options, never literals.
- **Components:** `MetricCard` (value · comparison · target · sparkline as layers, not five
  components), `DashboardShell`, `InsightCard`/`InsightList` (insight · exception ·
  recommendation · goal · alert), `BarChart` (ranking and comparison), `Sparkline`,
  `ProgressMeter`, `AnalyticsTable` — which **composes CP-23** rather than building a second
  filter system, and becomes cards below 48rem.
- **No charting dependency.** Every visual is inline SVG or CSS: nothing to install, nothing to
  version, and the theme is inherited automatically.
- **Four domain configs** (`examples.ts`): restaurant · gym · academy · badminton — the standing
  proof that a new domain is a config, not a component edit.
- `docs/25-ANALYTICS-AND-DASHBOARDS.md`; CP-24; component-library baseline concern + rows,
  including **honest GAP rows** for donut/funnel/heatmap/stacked/area/timeline — deliberately
  unbuilt until an application has a real need. `feature.md` **A3.3c** asks for it at design
  time. Cases FW-DASH-001..002.

**Fail-first evidence:** ~70 assertions executed against the esbuild-compiled actual libs. The
role-visibility assertion was **observed failing** and caught a real defect — the academy
example gated the fee *section* but not the fee *metrics*, leaving them in the instructor's
resolved config. The config was fixed, not the assertion.

### App action required
**None.** New seed files; new scaffolds include them, existing apps copy via upgrade or by hand.

---

## 1.17.0 — 05-Sep-2026 — MINOR

**CP-23: every list and table view is searchable, filterable and sortable — by default.**
Owner standard: a list shipped bare, or with a per-module search box that behaves differently
from the next screen's, is the inconsistency users stop trusting. The capability is now a
canonical pattern with a shared implementation, and the design passes ask for it.

### Added
- **`ListControls`** (`starter/src/components/ListControls.tsx`) + **`useListControls`**
  (`starter/src/hooks/useListControls.ts`) + the pure **`list-controls.ts`** lib: one search
  box across the module's key fields (case-insensitive; **phone numbers compared
  digit-to-digit**, so "98765 43210" finds "+91 98765-43210"); **multi-select contextual
  filters** (OR within a field, AND across fields); **date presets** — Today · This week ·
  Last week · This month · Last month · All time · **Custom range** (inline date inputs, no
  dialog) — computed in local time, Monday weeks by default, inclusive ends; **stable
  ascending/descending sort** per column (locale for strings, value for numbers and dates,
  **blanks last in both directions**); the count shown as **matching / total**; one
  "Clear all". Native inputs and buttons throughout (CP-22); host renders the list and its
  own empty state.
- **CP-23** in `CANONICAL_PATTERNS.md`, rung `starter/tests/unit/list-controls.unit.spec.ts`.
  Fail-first: 40+ assertions executed against the esbuild-compiled actual lib (all passed);
  a deliberately inverted blanks-last assertion observed failing.
- **Lists & tables** as a baseline concern in `COMPONENT_LIBRARY.md` §1 (auto-Must-Have in
  the advisor pass) + the READY row.
- The design passes ask for it: `feature.md` **A3.3b** (per list: search fields · filter
  groups · date field · sortable columns), `enhance.md` B4 **Lists** row (seven rows now),
  `docs/04 §5`, design-QA area 16. Cases FW-LIST-001..002; FW-ENH-002 updated.

### App action required
**None.** New seed files; new scaffolds include them, existing apps copy via upgrade or by
hand. Existing bare lists are debt to be closed as each is next touched (Track B's Lists row).

---

## 1.16.0 — 05-Sep-2026 — MINOR

**Codex wiring, committed properly.** The owner had built `.codex/` (a Codex-CLI mirror of
`.claude/`: eleven agents as TOML, the hook adapter, `hooks.json`) and a root `AGENTS.md`, both
untracked. Committing them as found would have shipped four defects, so they are fixed first:

### Fixed before committing
- `.codex/hooks.json` hardcoded an **absolute path on one machine** — now
  `node .codex/hooks/pre-tool-use-guard.mjs`, relative, like `.claude/settings.json`.
- `.codex/hooks/adapter.test.sh` tested **`.claude/`'s adapter**, not the `.codex` copy — the
  Codex adapter had never been executed by anything. It now tests its own copy, and
  `npm run guard:test` runs it.
- The ten Codex agent **descriptions still said "PROACTIVELY"** — pre-1.15.0 wording, so Codex
  would have spawned every reviewer on every run. Synced verbatim to `.claude/agents` (the
  review matrix applies to both); keep them synced together.
- Root `AGENTS.md` was a **full copy of `CLAUDE.md` that had already drifted** (it named a
  `.codex/commands/` folder that does not exist; its runbook list lacked `/request`). It is
  now a pointer to `CLAUDE.md` — the same convention `new-app.mjs` writes into every app.

### Added
- `.codex/` and `AGENTS.md` registered in `FRAMEWORK_MANIFEST.md`, `docs/00-OVERVIEW.md`,
  `docs/21-AGENT-WIRING.md`. Stated honestly: `.codex/` is framework-repo wiring today — not in
  `HALF_A`, so scaffolds do not yet carry it (a future MINOR if wanted).

### App action required
**None.** `framework:upgrade` note: that script exists only in a *scaffolded app's*
`package.json` (written by `new-app.mjs`); it is not a framework-repo command.

---

## 1.15.1 — 05-Sep-2026 — PATCH (seed defect fix — one app action, see below)

**`starter/tsconfig.json` made `tsc` fail in every scaffolded app.** Present since the
initial commit. The file carried `"//strict": "…"` and `"//paths": "…"` inside
`compilerOptions` — the `"//key"` comment convention that npm tolerates in `package.json`, but
which TypeScript rejects: `error TS5025: Unknown compiler option '//strict'` (and `'//paths'`).
Observed with `tsc --showConfig -p starter/tsconfig.json` before the fix; clean after. The
consequence in an app: the gate's type step fails on the *config* before checking any source,
so the type ratchet was never actually running.

### Fixed
- The three explanatory entries are now real JSONC `//` comments — legal for tsc, Vite,
  esbuild and Next, and no framework script parses tsconfig as strict JSON. The didactic
  content is preserved verbatim.

### App action required
**Yes, one edit:** in your app's `tsconfig.json`, delete the `"//strict"` and `"//paths"`
lines inside `compilerOptions` (and optionally the top-level `"//exclude"`), or replace them
with `//` comments. If the file is unmodified since scaffold, `npm run framework:upgrade`
offers the corrected seed. Then run `npm run gate` — expect the type step to *start reporting*
real results for the first time; a baseline regenerate (`scripts/hooks/tsc-baseline.sh`) may
be needed to record the true starting debt.

*Taxonomy note:* PATCH by content (a wording-level config fix), but it carries an action
because the defect was hiding a gate — stated rather than buried.

---

## 1.15.0 — 05-Sep-2026 — MINOR

**The third speed pass: reviewers spawn by scale, in parallel.** After the waiting (1.9.0)
and the process weight (1.13.0), the largest remaining sink was the review layer: all eleven
agents self-described as "use PROACTIVELY", the runbooks never scoped them, so a run could
spawn up to ten sub-agents **sequentially, each a cold start** re-reading rules, registers and
files — to review a scoped change the main agent had already analysed inline. The close-out
checklists (DoD's 33 items, 20 per screen) also still invited prose.

### Added
- **The review matrix** (`workflows/agents/README.md`): per pass, what a **scoped** run does
  vs a **full-scale/hotspot** run. Scoped: blast radius, plan, gate run and close-out stay
  **inline**; `code-reviewer` is spawned always (it built nothing, so it *is* the fresh
  context); `copy-gate` / `permission` / `parity` reviewers spawn **only when the diff
  triggers them**; `fresh-context-reviewer` is a full-scale second pass only;
  `preview-smoke-verifier` remains never optional after merge. **Whatever applies is spawned
  in ONE message, in parallel** — three reviewers cost the slowest one, not the sum.
- **Agent descriptions gated to the matrix** (`.claude/agents/*.md`) — the actual lever that
  stops auto-spawning: "PROACTIVELY" replaced with the matrix condition on ten agents.
- **Compact close-out output**: DoD as one table (`item · done | N/A: <reason>`, gate-proven
  items cite the gate); SCREEN_CHECKLIST as one row of 20 symbols per screen. Same close-out,
  a fraction of the writing.
- `feature.md` A5, `enhance.md` B6, `docs/21` aligned. Cases FW-SPEED-004..005.

### App action required
**None** — but note `.claude/agents/*.md` changed; workspace-mode apps carry a copy of
`.claude/`, which `framework:upgrade` replaces wholesale (it is linked-managed).

### What remains, honestly
The floor is the build itself and the mechanical gate (`tsc`, the audits, the specs). If a run
is still slow, the run report's **stage timings** line names the stage — send that line.

---

## 1.14.0 — 05-Sep-2026 — MINOR

**Two contributed components: module access and app customization.** Owner-commissioned from
a real app's screens, generalized (domain-free) into the reference stack's library — the
contribute-back loop's first exercise.

### Added
- **`ModuleAccessPanel`** (`starter/src/components/ModuleAccessPanel.tsx` +
  `starter/src/lib/module-access.ts`) — grant another member limited access: role preset as
  a starting point (**reset-to-role, never a merge** — a merge would make "Manager preset"
  a lie to every access reviewer), per-capability custom switches, **deny-by-default**
  stated in the UI, confidential capabilities marked with a word never a colour, collapsed
  sections showing granted/total counts, and an honest save button ("No changes" /
  "Save N changes" — never silently disabled). Compose inside `Dialog.tsx`; the
  login-lifecycle buttons beside it (enable/disable login, reset credential) are host-app
  chrome, destructive ones isolated.
- **`ModuleCustomizer`** (`starter/src/components/ModuleCustomizer.tsx` +
  `starter/src/lib/module-customizer.ts`) — the user shapes their own app: per-module
  enable/disable, **button reorder never drag** (CP-21 reasoning — this edits navigation,
  where the least confident users end up), `alwaysOn` locks the **toggle not the position**
  (a worded "Always on" mark, never a dead ghost toggle), children keep their flags across a
  parent's disable, and position badges ("Main tab 2") count **enabled modules only**.
- Unit specs for every branch (`starter/tests/unit/module-{access,customizer}.unit.spec.ts`).
  Fail-first: the assertions were executed against the esbuild-compiled actual libs (20/20
  passed) and a deliberately inverted alwaysOn assertion was observed failing.
- Registry rows in `COMPONENT_LIBRARY.md`: Settings gains the customizer, Permissions gains
  the access editor. All logic is in the pure libs; the components render state, never
  compute it.

### App action required
**None.** New seed files — new scaffolds include them; existing apps copy them via upgrade
or by hand when needed.

---

## 1.13.0 — 05-Sep-2026 — MINOR

**The second speed release: the process weight itself was the bottleneck.** After 1.9.0
removed the waiting, runs were still slow. Measured root cause: the design releases stacked
~1,700+ lines of process documents into Track A's orbit and ~130 checklist items into a run —
and a faithful agent was (a) reading the whole library up front, and (b) hand-writing
evidence per bullet item, much of it re-verifying what the mechanical audits already prove.
The obligations were right; the reading and writing they induced were not.

### Added — the three budgets (`docs/01` §Run modes, `feature.md` Step 0)
- **Reading budget.** A run READS its runbook, the project rules, and the touched modules'
  registers — once each. Every other process document (docs/23, docs/24, 04, 13, checklists)
  is **lookup material**: opened at the section a stage names, never front-loaded. The
  process documents describe the work; reading all of them is not the work.
- **Evidence budget.** ONE verdict per checklist area (or screen) with ONE evidence line;
  bullet items are prompts for the reviewer's eye, not paperwork. **Never hand-verify what a
  mechanical audit already checks** — cite the audit ("theme:contrast PASS") as the evidence.
  Design QA scoped runs cover the core six areas (1 · 5 · 7 · 10 · 15 · 18) plus touched
  areas; untouched areas are one line each. Full scale still runs all 18.
- **Writing budget.** Scoped `RUN_<feature>.md` ≤ ~150 lines; ledger entries one line; the
  QA table 18 lines + grade.
- **Stage timings** in the run report (ground · plan · build · verify · gate, minutes each) —
  the next slow run is diagnosed from data, not feeling. Cases FW-SPEED-001..003.

### App action required
**None.** No check was removed — what shrank is reading the library and writing essays about
what a script already proved.

---

## 1.12.0 — 05-Sep-2026 — MINOR

**Requirements that drive design.** Root cause of the requirement→UI gap: prose requirements
carry the *what* but not the facts a simple UI is built from — frequency, priority,
essential-vs-optional, automatable-vs-manual. Fed prose, the design stage had nothing to
subtract with, so it added: extra screens, extra fields, extra navigation. The correction is
a structured, machine-interpretable requirement layer plus mechanical translation rules, so
the conversion never depends on individual interpretation.

### Added
- **`REQUEST_NEW.md` §USAGE PROFILE** — the structured half of the requirement: primary
  objective · primary workflow · frequency of use · operating environment · essential vs
  optional information · frequent vs occasional actions · automate vs must-stay-manual.
  Intake fills it from the customer's words only; every `unknown` becomes a Gate 1 question
  (new mandatory usage-profile section in `GATE1_QUESTIONS.md`, asked with recommendations —
  never invented). `REQUEST_CHANGE.md` gains a one-line USAGE field.
- **`docs/24` §3b — the translation table**: requirement facts → forced UI decisions.
  Frequent/essential → primary screen, one interaction, early Tab order; occasional/optional →
  progressive disclosure, *never a separate screen just because the information exists*;
  automatable → the field is **eliminated**, the outcome shown with an override;
  must-stay-manual → an explicit visible decision; operating environment → density, targets,
  keyboard model.
- **`docs/24` §3c — the subtraction pass**, run per screen with recorded evidence: *does the
  user really need to see this? really need to do this? can it take fewer steps?* Complexity
  is never justified by "technically possible" or "other apps have it". New A3.1b executes
  it in Track A; the Track B correction design pass gains a Subtraction row (six rows now).
- **The no-manual bar**, stated in docs/23 and tested in design QA area 18: a first-time
  user completes the primary workflow with no instruction — simplicity as the selling point.
- Design-QA hooks: area 14 checks the usage-profile translation held; area 15 demands the
  subtraction evidence. Cases FW-REQ-001..003; FW-ENH-002 updated.

### App action required
**None.** Old-format request files keep working — a missing USAGE PROFILE simply means Gate 1
asks those questions.

---

## 1.11.0 — 05-Sep-2026 — MINOR

**The component library: discover → reuse → build the missing piece → register → reuse.**
The same functionality was being rebuilt per app — auth flows, theme plumbing, navigation,
shared states — costing time and breeding inconsistency. The framework already *was* a
component library for one stack (`starter/`); what was missing was the registry, the
lookup-before-build step, and the contribute-back loop.

### Added
- **`docs/registers/COMPONENT_LIBRARY.md`** — the central registry. §1 the **standard
  baseline** every app includes regardless of business requirements (light+dark themes and
  theme configuration, login/logout/forgot/reset, navigation shell, shared states, data
  plumbing, safety defaults) — the advisor pass places these in Must-Have automatically and
  spends no research on them. §3 implementations **keyed by stack**: the reference stack
  (`typescript-react-postgres`) seeded from `starter/` with honest **GAP** rows for what is
  wanted but not yet built (login/logout screens, forgot/reset flow, header/footer shell,
  common forms) — a row is a claim that working code exists, never an intention. New stacks
  get their own subsection pointing at one implementation repository each.
- **The lookup order** (feature.md A3.1, docs/24 §6): this app → the library for this stack →
  build. Rebuilding a registered component is a defect — the CANONICAL_PATTERNS rule applied
  to components.
- **The contribute-back loop** (registry §4, promote.md, DoD): a component built for a
  *baseline* concern is generalized (lexicon-grep clean), registered, and its GAP row flipped
  READY **in the same change** — baseline concerns were declared common in advance, so they
  skip the rule of three. Every other reusable-looking component still goes through
  `/promote` (park n=1, promote at n=2 from a different app) — the museum-of-accidents guard
  stands.
- `docs/02` step 2: a non-reference stack reads the registry first; unbuilt baseline concerns
  are built once against the same standards and contributed back, so the next app on that
  stack starts where this one finished.
- Cases FW-LIB-001..003; a DoD item carries the contribute-back obligation.

### App action required
**None.** Reference-stack apps already receive the library via the scaffold; the registry
makes it discoverable and gives its gaps a place to close.

---

## 1.10.0 — 05-Sep-2026 — MINOR

**The product-advisor pass.** For a new application or a new module there is no codebase to
answer scope questions from — they are product decisions, and guessing them ships the wrong
v1. Gate 1 now runs as an advisor for those cases: **research → context → questions →
recommend with reasoning → alternatives → the requester decides.**

### Added
- **`docs/24` §2 — the product-advisor pass.** Timeboxed research (3–5 comparable products,
  one pass; web research where available, model knowledge declared and dated where not);
  candidate features filtered through explicit context lenses (complexity, type/purpose,
  region and market, legal/regulatory/cultural, business context, target customers,
  scale/growth, industry standards, deliberate exclusions); triaged **Must-Have /
  Recommended / Good-to-Have**, each tier reasoned, plus the **ignored list** — features
  found in research and deliberately excluded, with why. Research is input, never authority.
- **Question format hardened** (`GATE1_QUESTIONS.md`, `feature.md` A1, `01-SDLC` Stage 1):
  every question carries the recommendation, *why it wins here*, and real alternatives;
  options always end with **"Other: describe your own"**; the requester's choice — including
  a custom one — binds like a stated FIELD.
- **Run-mode interaction defined:** the triage + questions are ONE consolidated package and
  a **hard stop in every run mode** — scope is the requester's decision and is expensive to
  undo. A scoped in-area feature skips the advisor pass entirely, so the 1.9.0 speed win is
  untouched where it matters.
- `REQUEST_NEW.md` gains a `MARKET / REGION` field feeding the regional/legal lenses.
- Cases FW-ADVISOR-001..003.

### App action required
**None.** The pass fires only for new applications and new modules.

---

## 1.9.0 — 05-Sep-2026 — MINOR

**The speed release: run modes and proportional ceremony.** Root-cause finding from a real
comparison (a bulk-import feature: ~40 minutes here vs ~5 minutes in the owner's previous
lighter flow): (1) Track A blocked **four times** waiting for a human — the synchronous
round-trips, not the work, dominated wall-clock; (2) every feature ran maximum ceremony —
four separate gate artifacts, the full 18-area loop, a canvas — regardless of size; (3) prose
restated and registers re-read across stages.

### Added
- **Run modes** (`docs/01` §Run modes). **auto** *(new default)*: gates 1–4 become
  checkpoints — the artifact is produced in full, open decisions are taken on the written
  recommendation and logged to the run's **ASSUMPTIONS ledger**, and the run proceeds
  immediately. **confirm**: the pre-1.9.0 behaviour, every gate waits — chosen with
  `RUN MODE: confirm` in the request file or by saying so. Auto moves the review to the end
  (the run report: FIELDS + ledger + artifacts + QA verdicts + preview URL); it never removes
  it. Stated request FIELDS bind identically in both modes.
- **Hard stops that survive auto**: destructive/hard-to-reverse operations, capability
  removal or reshaping, the safety floor, outbound sends, production (Gate 6 is human in
  every mode), and genuine expensive forks. The mechanical test gate blocks in every mode.
- **Proportional ceremony**: the run declares its **scale** at Step 0. A *scoped* feature
  (≤5 files, additive-only schema, no new nav area or shared component) produces ONE combined
  `RUN_<feature>.md` instead of four gate artifacts, skips the feasibility brief unless
  build-vs-buy is real, and skips the canvas in auto mode. Obligations identical — states,
  themes, keyboard, verdicts all still checked — only the packaging shrinks.
- **Speed discipline** (Track A Step 0): registers read once per run, terse tables over
  prose, no restating, independent checks batched.

### Changed
- `workflows/feature.md` (Step 0 items 7–8, gates 1–4, close-out run report),
  `workflows/enhance.md` (B3/B4), `workflows/refactor.md` (D0), `workflows/request.md`
  (RUN MODE capture), both request templates (RUN MODE field + standing instructions),
  `docs/01-SDLC.md`, `README.md`, `.claude/commands/feature.md`. Cases FW-MODE-001..004.

### App action required
**None mechanically — but note the default changed:** a run with no `RUN MODE` stated now
proceeds through gates 1–4 without waiting. Any requester who wants the old behaviour writes
`RUN MODE: confirm` in the request file or says so. Production approval and the test gate
are unchanged in every mode.

---

## 1.8.0 — 05-Sep-2026 — MINOR

**A new app can now be born through `/request`.** Audit finding: a whole-new-application ask
("build me a CRM") classified as **NEW** and dropped into Track A — a feature track whose
Step 0 reads the app's rules, registers and sibling screens, none of which exist for a
greenfield product. There was no intake route to initialization, so the one command that is
supposed to start *any* work could not start an application.

### Added
- **NEW-APP classification** in `workflows/request.md` — the test is whether a scaffolded
  codebase exists to receive the work. The flow: REQUEST_NEW scoped to the **first shippable
  slice** (the rest listed in EXPLICITLY OUT as later `/request` runs — an application is a
  list, and a list is triage's job, not one request file's) → continue into
  `docs/02-PROJECT-INITIALIZATION.md` (`npm run new:app`, day-one steps) → the request file
  moves into the new app's `requests/` as its first ledger entry → Track A runs **inside the
  new app**, first gate restating the FIELDS as always. Empty registers and the starter as
  the sibling pattern are stated as expected, not blockers.
- `scripts/new-app.mjs` seeds the **`requests/` intake ledger** (folder + contract README)
  in every scaffold, so `/request` inside a new app finds its ledger armed like the registers.

### Changed
- `templates/requests/REQUEST_NEW.md` standing instructions carry the NEW-APP note;
  `.claude/commands/request.md`, `docs/01-SDLC.md` §2 table, `docs/02` preamble and
  `docs/00-OVERVIEW.md` aligned. Case FW-INTAKE-007 added.

### App action required
**None.** Existing apps already exist — this route only fires when nothing is scaffolded.
An existing app missing `requests/README.md` gains it on the next upgrade or first `/request`.

---

## 1.7.0 — 04-Sep-2026 — MINOR

**The design release: the design stage becomes a design-intelligence layer.** Motivated by a
real adoption failure: simple design corrections were missed or misaligned with standards,
designs shipped as first drafts, and the design QA was effectively outsourced to the
requester — who paid for it in correction rounds. Built to the owner's Design Intelligence
Blueprint (04-Sep-2026) as the reference specification.

### Added
- **`docs/24-DESIGN-PLANNING.md`** — the method: the discovery inventory and inspect-first
  order; the infer/investigate/ask question framework ("ask only high-value questions", with
  good and bad examples); the design-plan structure; the IA-first placement table
  (tab/page/section/dialog/drawer/inline/disclosed/removed) and its anti-patterns; the
  ten-stage screen-design pipeline with exit tests; design-system strategy
  (reuse → extend → refactor → create); responsive planning per breakpoint; the state matrix;
  real-world scenario validation (first-time/daily/expert/keyboard-only/role/dataset/failure
  lenses); the iteration loop; the scoring model
  (Basic → Acceptable → Production-ready → High quality → Exceptional).
- **`docs/23-DESIGN-CRAFT.md`** — the bar: the wow factor decomposed into checkable
  mechanisms; IA and grouping; consolidation rules (**simplify the experience, not the
  capability** — nothing lost · logical groups · internal structure · scales); visual
  hierarchy; information density; flows; interaction craft; the polish pass; the
  **anti-gimmick rule** (no unnecessary animation/gradients/cards/colour/shadows/icons —
  sophistication through simplicity); ask-instead-of-assume.
- **`checklists/DESIGN_QUALITY_CHECKLIST.md`** — the judge: 18 areas (user flow → overall UX
  quality), each requiring a verdict (PASS · NEEDS-IMPROVEMENT · CRITICAL) **with evidence**;
  the validate → refine → re-validate protocol; the output verdict table that travels to
  Gate 3 and is re-run on the rendered screens.
- **`docs/registers/DESIGN_RULES.md`** — armed, empty: design lessons promoted via
  `/promote` land here as DR rows with enforcement rungs, so repeated design mistakes are
  prevented by process, not memory. Already parsed by `check-rule-coverage.mjs`.
- **Interaction principles** in `docs/04 §5`: navigation predictability, the
  **three-interaction budget** (counted in the scenario dry run, never estimated), one named
  primary action per screen, quick actions in contextual dialogs (substitution row added).
- **Keyboard parity** as a first-class contract: `docs/13 §4` (Tab/Shift+Tab order, Enter
  activates, **Space selects tab-style controls**, no traps, keyboard-only workflow parity),
  rule A-10, **CP-22** (real buttons, never div-as-button — Enter and Space come free), and
  the executable reference shape `starter/tests/functional/keyboard.functional.spec.ts`.
- Gate 3 gains the **design canvas deliverable**: where the environment provides Claude
  Design (`/design`), the key screens are published as a visual canvas the requester refines
  before approving; the spec remains the binding artifact, and unavailability is stated.

### Changed
- `workflows/feature.md` — A1 runs the docs/24 discovery order (inspect first, ask only
  high-value); A3 reframed as the design-intelligence layer with the ask-don't-assume
  discipline; A3.8 becomes the real-data **and scenario** dry run (interactions counted, one
  pass keyboard-only); new **A3.9 validation loop** — Gate 3 sees Production-ready or better,
  or the blocking findings with a question; A5 drives the primary flow once keyboard-only.
- `workflows/enhance.md` — the correction design pass gains a Keyboard row and, for
  visual-change scope, scoped design-quality validation with optional canvas.
- `checklists/SCREEN_CHECKLIST.md` — item 4 **merged** (cap respected: focus chain +
  keyboard operability in one item). Still 20 items, still full.
- `checklists/ACCESSIBILITY_CHECKLIST.md` — Enter/Space semantics, Shift+Tab, and the
  keyboard-only end-to-end pass.
- `docs/01-SDLC.md` Stage 3 — Interaction and Validation-loop passes added to the table.

### App action required
**None.** All additions are process guidance and an advisory reference spec; no gate,
baseline, or guard changed. The keyboard spec arrives as a reference shape — point it at
your own screens and observe it fail before trusting it (fail-first).

---

## 1.6.0 — 04-Sep-2026 — MINOR

**One command, end to end.** In 1.5.0 only the routed-out classifications flowed onward; a
NEW / CHANGE / BUG classification still stopped after writing the request file and asked the
requester to run the track themselves. Owner decision (04-Sep-2026, reaffirmed): the requester
types exactly one command.

### Changed
- `workflows/request.md` + `.claude/commands/request.md` — after writing the request file, the
  run **continues directly into the classified track**. The field review is not removed, it is
  **moved**: the track's first gate (Track A's Gate 1, Track B's B3/B4, Track C's root-cause
  statement) opens by restating the request FIELDS verbatim — "from your request — correct
  anything wrong" — and a correction there updates the request file before work proceeds, so
  the file and the work never tell different stories. Mixed input runs the framework-update
  half FIRST, so a process gap that caused the app issue is repaired before the app track runs.
- `workflows/feature.md`, `workflows/enhance.md`, `workflows/bug.md` — each carries the
  same-run arrival rule: first stop restates FIELDS.
- `requests/README.md` — the legitimate-edit window is now the first gate.
- `docs/01-SDLC.md` §2, `docs/00-OVERVIEW.md`, `FRAMEWORK_MANIFEST.md` aligned.
- `tests/cases/FRAMEWORK_PROCESS_CASES.md` — FW-INTAKE-001, FW-INTAKE-005, FW-ENH-001 updated.

### App action required
**None.** Every track still accepts a plain one-line request or a hand-run `requests/` file;
the human approval count is unchanged — the first approval simply carries the FIELDS with it.

---

## 1.5.0 — 04-Sep-2026 — MINOR

**Intake is the single entry point.** In 1.4.0, a `/request` run that classified the ask as a
list, an open situation, a pure restructure, or a process failure produced no file and told
the requester to run `/triage`, `/brainstorm`, `/refactor`, or `/framework-update` themselves.
That stop bought nothing — with no request file there is nothing to review — so it only made
the requester retype the same words into a second command, and a retype the requester forgets
is a process failure that never gets routed.

### Changed
- `workflows/request.md` + `.claude/commands/request.md` — routed-out classifications now
  **continue directly into the destination runbook in the same run**; that runbook's own gates
  (triage's queue approval, framework-update's diff approval) still stop the work before
  anything changes. The field-review STOP is unchanged for the file-producing classifications
  (NEW / CHANGE / BUG). Mixed input now continues into `workflows/framework-update.md` with the
  process half in the same run, instead of leaving it as advice.
- `docs/01-SDLC.md` §2 intake paragraph updated to match.
- `tests/cases/FRAMEWORK_PROCESS_CASES.md` — FW-INTAKE-004 and FW-INTAKE-005 updated in place.

### App action required
**None.** Behaviour within a single command's run; no gate, baseline, or guard changed.

---

## 1.4.0 — 04-Sep-2026 — MINOR

**Intake: `/request` writes the binding request file.** Motivated by a real adoption failure:
rough one-line requests fed straight into `/enhance` and `/feature` had the tracks filling the
gaps silently — each silent fill a design decision the requester never made — producing design
gaps found only after the build, and correction-on-correction loops. The gap was at intake,
not in the tracks.

### Added
- `workflows/request.md` + `/request` (`.claude/commands/request.md`) — classify rough words
  into the right track, fill the matching template using **only what the requester said**
  (uncovered = `unknown`, never invented), write `requests/<date>-<slug>.md`, and STOP.
  Stated fields **bind** the consuming track; `unknown` fields become its questions.
- `templates/requests/` — `REQUEST_NEW.md` (Track A) · `REQUEST_CHANGE.md` (Track B, with
  always-populated MUST NOT CHANGE and a DESIGN SURFACE declaration) · `REQUEST_BUG.md`
  (Track C, error wording verbatim, selectivity as root-cause evidence). CHANGE and BUG carry
  a CORRECTION ROUND field: round ≥ 2 obliges the track to explain what the previous fix
  missed before proposing anything.
- `requests/README.md` — the intake ledger's contract (committed, superseded files kept).
- `tests/cases/FRAMEWORK_PROCESS_CASES.md` — ten manual process cases (FW-INTAKE-001..006,
  FW-ENH-001..004) on classification, binding-field discipline, and the design pass.

### Changed
- `workflows/enhance.md` — the optional, undefined "mini design pass" is now the **correction
  design pass**: mandatory when the change is visual, still scoped to the touched area, and
  defined (states · both themes in semantic tokens · string table · permission answer). A
  "not visual" claim is verified against the diff at B6. B1 gains the correction-round check;
  B4's "deliberately NOT changing" list is seeded by the request's MUST NOT CHANGE line.

### App action required
**None.** Intake is a new optional entry point; every track still accepts a plain one-line
request. Adopt by using `/request` when the ask is rough. No gate, baseline, or guard changed.

---

## 1.3.0 — 30-Aug-2026 — MINOR

**CP-21: a wide table is the user's to arrange.** Promoted from `academies-dashboard` (see
`docs/registers/CANDIDATES.md` CAND-001 — an owner override of the n=2 rule, recorded as such).

Past three columns a table scrolls sideways and most of it is off screen. Which columns matter
is a property of the task, not the table, so a fixed layout guesses wrong for everyone. More
than three columns now means the user chooses which columns show and in what order, and the
choice persists.

### Added
- **Gate step G11** + `npm run audit:columns` — `scripts/audits/check-column-control.mjs`.
  Ratcheted like every other audit, so it **arrives baselined** and blocks only new violations.
- `starter/src/components/ColumnControl.tsx` and `starter/src/hooks/useColumnPrefs.ts` — the
  reference implementation. `reconcileOrder` is pure and exported: it is the part with all the
  branches, so it is the part worth testing without a browser.
- `starter/tests/unit/column-prefs.unit.spec.ts` — seven cases on the release-day failures
  (a column added or removed since the preference was stored; a newcomer landing at its code
  position rather than at the front of a reordered table).
- CP-21 in `CANONICAL_PATTERNS.md`; the rule in `docs/04` §5; a review item in
  `CODE_REVIEW_CHECKLIST.md`.

### Known limit, stated rather than implied
The audit counts **literal `<th>` elements**. A table built by mapping over a column definition
array is invisible to it — including, ironically, the 14-column table in the app that motivated
the rule. That is why the review checklist carries an item too: the gate is a floor, not the
substance. `--threshold` is configurable if three proves wrong for another app.

The screen checklist is **unchanged** — it is capped at 20 and full, and this rule earned an
automated check plus a review item instead of a slot.

### App action required
**None.** The gate arrives baselined at your current state: run
`node <framework>/scripts/audits/check-column-control.mjs --write-baseline` once and commit it,
or let `upgrade.mjs` do it for you. Existing tables are accepted as debt; only new ones block.

---

## 1.2.0 — 30-Aug-2026 — MINOR

**The adoption-safety release.** Everything here was found by running v1.1.0 against a real
adopted app (a JavaScript/Vite project) and against a workspace-mode scaffold. Each item was a
promise the framework made and did not keep.

### Fixed
- **The gate was entirely broken in workspace mode** — the default scaffold. Every step resolved
  its own script relative to the app being checked, but a workspace app deliberately has no
  `scripts/`, so all six framework gates reported `Cannot find module` as **FAIL**: the app's code
  judged broken because the checker was looking for itself in the wrong repository. Gate steps now
  resolve against the framework (`fwScript`), and a missing gate script reports BLOCKED, not FAIL.
- **`check-backward-compat` could pass having measured nothing.** It read
  `.gate-logs/conformance.json` if the file merely existed, so when conformance failed to run the
  *previous* run's results were reported as current. Observed: with `conformance.mjs` deleted
  outright, the gate printed three PASSes and exited 0. It now clears the file first, and requires
  that this run produced it.
- **`conformance` exit code depended on fixture ORDER** — a BLOCKED fixture ahead of a FAIL one
  reported exit 3, downgrading "this breaks an existing app" to "we could not check". FAIL now
  outranks BLOCKED, matching `gate-runner`.
- **Half A never reached a standalone app.** `new-app.mjs` promised the copied process half was
  "replaced wholesale on upgrade"; no such code existed, so a client app could never receive a
  fixed guard or a new workflow. `upgrade.mjs` now refreshes it — overwrite, never delete, and
  expected-divergent paths (`docs/registers/`, `docs/modules/`) are skipped so an app's own
  registers survive.
- **New gates were never baselined in workspace mode.** The baselining step looked only in
  `APP/scripts/audits`, which a linked app does not have, so WS3.3's "a new gate arrives baselined,
  green on day one" silently did not apply to the default scaffold.
- A corrupt or `files`-less `lineage.json` now fails with a stated reason instead of a bare
  `TypeError`.

### Changed
- **An ADOPTED app is now OFFERED new seed files, never given them.** `upgrade` routed any file
  absent from the lineage to auto-apply. For an app adopted via `lineage --init` — different
  layout, often a different stack — that is every seed file: 31 TypeScript files pushed into a
  JavaScript app, including a `playwright.config.ts` landing beside a working
  `playwright.config.js` and breaking its test harness. Adopted apps get the same rule modified
  files already had: offer it, a human decides. Scaffolded apps are unchanged — they asked for the
  seed, so a new file there is a gift, not a collision.

### Also fixed
- **Workspace apps had no commit guards at all.** The PreToolUse adapter looked for
  `pre-commit-guard.sh` only inside the app, warned, and allowed — on every commit, in the
  default scaffold mode. It now follows `.framework-link.json` to the linked guard, and the
  guard itself resolves `theme-build.mjs` the same way (guard G4 previously went SKIPPED-forever
  in workspace apps).
- **`lineage --refresh` refused a taken offer.** The upgrade plan's own instruction — copy the
  incoming file, then `--refresh` it — failed with "Not a tracked seed file" for offered files,
  which are untracked by definition. Refresh now accepts an untracked path when the current seed
  has that file; typos are still refused.

### Added
- `lineage.mjs --decline <path>` — permanently refuse an offered file. Without it every upgrade
  re-lists the same rejects, and a report nobody reads enforces nothing.

### App action required
**None.** Every change makes the tooling do less or report more honestly. Workspace-mode apps
should re-run `npm run gate` — it will now actually execute.

---

## 1.1.0 — 28-Aug-2026 — MINOR

**The evolution release** (EVOLUTION_PLAN.md, all phases). The framework becomes versioned,
apps become lineage-tracked, and improvements can travel in both directions.

### Added
- `VERSION` + this file — the framework now has a version identity.
- **Lineage**: `scripts/lineage.mjs` — apps record what they received and from which version.
- **Upgrade**: `scripts/upgrade.mjs` — plan-first (`--apply` to act); pristine files auto-update,
  modified files require review, expected-divergent files are skipped.
- **Promotion**: `workflows/promote.md` + `/promote` + `docs/registers/CANDIDATES.md` — the
  classification gate between an app lesson and a framework change.
- **Conformance**: `fixtures/` + `scripts/conformance.mjs` + `scripts/audits/check-backward-compat.mjs`
  — every framework change is proven against three fixture apps before it counts.
- `templates/docs/FRAMEWORK_ADOPTION.md` — the per-app adoption log.
- `docs/22-FRAMEWORK-EVOLUTION.md` — how all of this works.

### Changed
- `scripts/new-app.mjs`: workspace mode **links** the process half instead of copying it;
  `--standalone` keeps the old copy-everything behaviour for client apps. Writes
  `.framework/lineage.json` and `FRAMEWORK_ADOPTION.md` into every new app.
- `workflows/bug.md`: close-out gains the generality check (route to `/promote`).
- `workflows/framework-update.md`: the triple close-out becomes **quadruple** — every run now
  also bumps `VERSION` and writes its entry here.
- `FRAMEWORK_MANIFEST.md`: every entry marked Half A (process) or Half B (seed).

### App action required
**None.** Existing apps keep working untouched. To join the lineage system, run
`node <framework>/scripts/lineage.mjs --init` from the app root once; from then on
`upgrade.mjs` can serve it.

---

## 1.0.0 — 28-Aug-2026 — initial release

The framework as extracted and hardened: SDLC + runbooks, ratchet gates, theme/contrast system,
commit guards, `.claude/` wiring, starter. See `CHANGELOG.md`.
