# Root Cause Register

> Every defect that reached a user, or that cost more than an hour to diagnose.
>
> **Append-only. Newest first. Never renumber. Never backfill.**
>
> Read before every bug fix, cited in every implementation plan, and consulted at every test run.
> Its value is entirely in having been kept from the start.

---

## Template

```markdown
## RC-000 — <one-line title>
**Date:** DD-MMM-YYYY  ·  **Severity:** S1 | S2 | S3 | S4  ·  **Modules:** <list>

**Symptom** — what was observed, in the words of whoever reported it.

**Root cause** — the reason it existed. Distinct from the symptom, and distinct from the file
where the error surfaced. One or two sentences.

**Fix** — what changed, and why that addresses the cause rather than the symptom.

**Files** — the paths touched.

**How to verify** — a specific instruction a future test run can execute to prove this has not
returned. This is the field that makes the register useful rather than historical.

**Recurrence risk** — where else this class can occur. If it is a pattern, say how many other
sites were found and how you searched. An unevidenced sweep did not happen.

**Prevention** — the rule, checklist item or gate that now catches it, **named as a path**.
Or, honestly: "no rung — prose only", and why a rung is not currently feasible.

**Process check** — would a correctly functioning process have caught this?
No → one line, done. Yes → the framework-update workflow ran, and here is what changed.
```

---

## Severity

| | |
|---|---|
| **S1** | Data loss, security exposure, or the application is unusable. Fix now. |
| **S2** | A major flow is broken with no workaround. Fix this release. |
| **S3** | A flow is degraded, or there is a workaround. Schedule it. |
| **S4** | Cosmetic or rare. Backlog. |

---

## Entries

> The four entries below were found **by this framework's own gates, while it was being built**.
> They are kept as worked examples of the format — and as evidence that the gates fire.
> RC-005 and RC-006 were found by the **fixtures**, during the evolution release (v1.1.0),
> before either defect ever reached an app.

---

## RC-023 — RC-022's split left the owner's pre-deploy sessions valid on the staff app
**Date:** 25-Sep-2026  ·  **Severity:** S3  ·  **Modules:** auth, sessions

**Symptom** — found in review before push: RC-022 says "anyone signed in to the owner console signs
in once more", but the danger ran the other way.

**Root cause** — RC-022 kept the staff app's cookie name `jalsa_staff` so captains stayed signed in.
Every owner sign-in BEFORE the split had been written into that same cookie, so a captain's phone
the owner had used would still open /staff as the owner for up to 14 hours after the deploy, and
the owner console's new sign-out clears only `jalsa_owner`.

**Fix** — the staff app's cookie is renamed `jalsa_staff_app`; the old `jalsa_staff` is honoured by
nobody and expires on its own. Everyone, on both surfaces, signs in once after the deploy.
**Files** — `jalsa/src/lib/cookie-names.ts`, `jalsa/tests/unit/session-surfaces.unit.spec.ts`.

**How to verify** — `session-surfaces.unit.spec.ts` ("each surface has its own cookie"): no surface
uses `jalsa_staff`.

**Recurrence risk** — any rename of a session's MEANING must rename its cookie; a cookie whose
contents change meaning in place carries old grants forward.

**Prevention** — the spec above. **Process check** — yes: the review rung caught it before push.

---

## RC-022 — One sign-in opened both the owner console and the staff app (closes RC-017's open risk)
**Date:** 25-Sep-2026  ·  **Severity:** S3  ·  **Modules:** auth, sessions

**Symptom** — a round placed from a captain's phone was recorded against the owner (RC-017, KOT-129).

**Root cause** — `/owner` and `/staff` read the same `jalsa_staff` cookie, so signing in on either
signed the handset in on both, and the owner's name travelled to the floor with the phone.
RC-017 recorded who signed in where; it left the shared session itself in place.

**Fix** — the owner decided "separate the sessions". The owner console has its own cookie
(`jalsa_owner`); the staff app keeps `jalsa_staff`, so captains already signed in stay signed in.
`readStaffSession`, `writeStaffSession`, `clearStaffSession`, `signInWithPin` and `currentStaff`
take a required `surface`; every `/api/owner/*` route reads the owner session and every
`/api/staff/*` floor route the staff session. The keypad, choose-PIN and sign-out send the
surface they belong to. The sign-in audit now names that surface instead of the Referer.
Consequence on deploy: anyone signed in to the owner console signs in once more.

**Files** — `jalsa/src/lib/{cookie-names,sessions}.ts`, `jalsa/src/lib/db/auth.ts`,
`jalsa/src/app/{owner,staff}/page.tsx`, `jalsa/src/app/api/owner/**`, `jalsa/src/app/api/staff/**`,
`jalsa/src/features/staff/{PinSignIn,ChoosePin,StaffApp}.tsx`, `jalsa/src/features/owner/OwnerConsole.tsx`.

**How to verify** — `jalsa/tests/unit/session-surfaces.unit.spec.ts`. By hand: sign in on
/owner, open /staff on the same browser - the keypad shows.

**Recurrence risk** — a new route reading a session must name its surface; there is no default,
so the compiler asks. The spec scans all of `src/` for an argument-less reader.

**Prevention** — `session-surfaces.unit.spec.ts` ("no reader anywhere asks for whichever session
is there").

**Process check** — no.

---

## RC-021 — CI on main went red on Node 20 while every local run on Node 22 passed
**Date:** 25-Sep-2026  ·  **Severity:** S3  ·  **Modules:** print bridge packaging, CI

**Symptom** — the `jalsa` job on UniqBrio/JalsaRestaurant#11 and on main failed in
`bridge-package.unit.spec.ts` ("THE REGRESSION ... fails at 125:97"); `gate` and
`self-tests-windows` showed as cancelled on the same pushes.

**Root cause** — two. (1) `ansiView()` decoded with `TextDecoder('windows-1252')`. Node 20's
small-ICU build treats that label as Latin-1, so byte 0x92 became U+0092 instead of `’` and the
very quote the view exists to expose disappeared; Node 22 decodes it correctly, and CI pins Node 20.
(2) Both workflow files are named `CI` and keyed their concurrency group on the workflow name, so
each push's second workflow cancelled the first's run.

**Fix** — `ansiView` maps 0x80-0x9F through an explicit Windows-1252 table (the only range where it
differs from Latin-1). Each workflow has its own concurrency group.

**Files** — `jalsa/bridge/package/powershell-lint.ts`, `.github/workflows/ci.yml`,
`.github/workflows/github-actions-ci.yml`, `jalsa/tests/unit/bridge-package.unit.spec.ts`.

**How to verify** — `npx -y node@20 node_modules/@playwright/test/cli.js test
tests/unit/bridge-package.unit.spec.ts` from `jalsa/` (with a unit-only config): all pass.

**Recurrence risk** — `grep -rn "TextDecoder(" jalsa/src jalsa/bridge`: no other non-UTF-8 label.

**Prevention** — the appended rung "the ANSI view maps 0x80-0x9F as Windows-1252 itself" pins the
mapping and forbids the ICU-dependent decoder.

**Process check** — No: local runs used the container's Node, not CI's; one line, done.

---

## RC-020 — A printer set up through a printing computer could not be saved: the form demanded a network address it will never have
**Date:** 24-Sep-2026  ·  **Severity:** S3  ·  **Modules:** printing (Print setup)

**Symptom** — "Disable → Save Changes does not persist" (24-Sep correction list, B1).

**Root cause** — `savePrinterMapping` creates a computer-reached printer with `connection:
'Ethernet'` (any non-USB Windows port) and an empty address, because the computer is how it is
reached. `upsertPrinter` and the Configure form both required an address of every non-USB
machine, so Save was disabled and the server would have refused it. `testPrintBlocker` already
exempted exactly these printers; the save path never learned the same rule.

**Fix** — mapped printers are exempt on both sides; the update is restaurant-scoped and must
change exactly one row. **Files** — `jalsa/src/lib/db/owner-mutations.ts`,
`jalsa/src/features/owner/sections/PrintSetupSection.tsx`.

**How to verify** — `jalsa/tests/unit/printer-management.unit.spec.ts` (B1 cases).

**Recurrence risk** — one rule ("does this printer need an address") in two places; the third
copy (`testPrintBlocker`) had it right. Swept: the three paths that judge an address.

**Prevention** — the spec above. Not verified against a live save (G8 not run here); all five
live printers are USB, so the tester's exact failing save may have been a different path.

**Process check** — no; a rule written in three places is a known risk the review matrix already
names.

---

## RC-019 — Seating a queued party stamped the queue row and nothing else, so the table stayed free
**Date:** 24-Sep-2026  ·  **Severity:** S2  ·  **Modules:** queue, floor

**Symptom** — "Called queue guest → table selection appears → table is not actually assigned"
(24-Sep correction list, F2).

**Root cause** — `seatWaitlist` wrote `waitlist_entry.seated_table_id` only, by design ("opens no
bill and touches no table"). Every floor derives occupancy from an OPEN BILL, and nothing on the
staff side reads `seated_table_id`, so the table showed free and was offered to the next party.
Live: W-1 seated at A2 on 19-Sep, no bill ever opened there.

**Fix** — seating checks the table server-side, claims the queue row with a guarded update that
must match one row, opens the bill through `ensureOpenBill` (guests = party size), and releases
the claim if the bill fails (owner decision, 24-Sep). **Files** —
`jalsa/src/lib/db/owner-mutations.ts`, `jalsa/src/app/api/owner/action/route.ts`.

**How to verify** — `jalsa/tests/unit/queue-seat-and-closed.unit.spec.ts` (F2 cases).

**Recurrence risk** — any state recorded somewhere the floor does not read. None other found.

**Prevention** — the spec above. **Process check** — no.

---

## RC-018 — Reissue PIN failed on every press: a migration dropping an ambiguous overload was never applied to the live database
**Date:** 24-Sep-2026  ·  **Severity:** S2  ·  **Modules:** staff, auth

**Symptom** — "Reissue PIN is failing" (24-Sep correction list, F1).

**Root cause** — `set_staff_pin(uuid,text)` and `set_staff_pin(uuid,text,boolean)` both exist on
`yxgxmbyilpivbmeemqkp` (verified in `pg_proc`): `20260917120000_jalsa_drop_ambiguous_set_staff_pin`
is in the repository and absent from the live migration list. `issuePin` named two arguments,
which match both, and PostgREST refused the call as ambiguous. It also never passed
`p_provisional`, so once the drop is applied an issued PIN would not have been provisional.

**Fix** — `issuePin` names `p_provisional: true` (resolves today, and is correct after the drop);
the PIN drawn is never one another active member of staff holds. **Files** —
`jalsa/src/lib/db/owner-mutations.ts`.

**How to verify** — `jalsa/tests/unit/pin-and-attribution.unit.spec.ts` (F1 case); and on the
live project, `select oid::regprocedure from pg_proc where proname = 'set_staff_pin'` returns one
row once 20260917120000 is applied.

**Recurrence risk** — any migration committed and not applied. `function-overloads.unit.spec.ts`
checks the repository only; nothing compares the repository's migration list with the live one.

**Prevention** — no rung: a repository-vs-live migration diff needs database access the gate
does not have here. Recorded, prose only.

**Process check** — yes: a migration was committed and never applied, and nothing noticed for
seven days. Candidate for /framework-update (a parity check before merge); raised, not run here.

---

## RC-017 — Every "Bill opened" was credited to the guest's phone, and nothing recorded who signed in where
**Date:** 24-Sep-2026  ·  **Severity:** S3  ·  **Modules:** audit, auth

**Symptom** — "Order placed by Imran (captain) shows under Javeed" (24-Sep correction list, G2).

**Root cause** — two gaps, one of which is the reported one. (1) KOT-129 (24-Sep 08:33 IST, on
Imran's bill B-1052) is stored with `placed_by` = Javeed and `source = captain`: the round was
placed from the captain surface under Javeed's session. `/staff` and `/owner` share one sign-in,
and no sign-in was recorded, so whose session was on which device could not be established
afterwards. (2) `ensureOpenBill` wrote every "Bill opened" as `GUEST_ACTOR`, so B-1052's opening
by staff reads "Guest · QR".

**Fix** — every sign-in is audited with person and surface; `ensureOpenBill` takes the actor;
a captain opening a table with no standing captain becomes its captain. **Files** —
`jalsa/src/app/api/staff/session/route.ts`, `jalsa/src/lib/db/mutations.ts`, staff and owner routes.

**How to verify** — `jalsa/tests/unit/pin-and-attribution.unit.spec.ts` (G2 cases).

**Recurrence risk** — the shared sign-in itself is unchanged: a phone signed in as the owner is
the owner on both surfaces. Separating the two sessions is a design change, not made here.

**Prevention** — the spec above; the audit entry makes the next case diagnosable.

**Process check** — no.

---

## RC-016 — Every "today" on the server began at 05:30 IST: the host clock is UTC
**Date:** 24-Sep-2026  ·  **Severity:** S2  ·  **Modules:** payments, dashboard, ledgers, uplift, printing, guest

**Symptom** — Payments "Closed today" misfiled bills closed 00:00–05:29 IST (24-Sep correction
list, A2).

**Root cause** — RC-014's class, at the sites RC-014 recorded and did not change:
`listClosedBillsToday` and tips-today used `setHours(0,0,0,0)` on a UTC host; server time labels
and printed KOT/bill date and time had no zone; the door-code and guest hours highlighted the
host's weekday; screens named today with `toISOString().slice`; Reports presets used the device
date.

**Fix** — all read `jalsa/src/lib/restaurant-time.ts` (`todayIn`, `todayWindow`, `shiftDay`,
`weekdayIn`, `timeLabelIn`, `dateLabelIn`, `nowForRangeCheck`).

**How to verify** — `jalsa/tests/unit/restaurant-day.unit.spec.ts` under `TZ=UTC`: 23:59, 00:00,
00:01, 05:29, 05:30 IST, plus source pins against host-clock "today".

**Recurrence risk** — remaining: `dates.ts` `dayRange` (unused) and an `Intl` fallback in
`analytics/format.ts`. Swept with `grep -rnE "setHours\(0|toISOString\(\)\.slice|getDay\(\)"`.

**Prevention** — the source pins in the spec above. **Process check** — yes: RC-014 recorded
these siblings and left them; a sweep that finds siblings should fix them or open an item.

---

## RC-015 — The Reports screen read an envelope the server never sends, so every report arrived and was shown as "Nothing in this range"
**Date:** 24-Sep-2026  ·  **Severity:** S2  ·  **Modules:** owner reports, guest queue

**Symptom** — "When I recorded a payment it's not reflecting under reports" (owner, 24-Sep-2026),
the second report of R-025 ("In Reports, nothing is showing up", 17-Sep-2026) after RC-014 was
shipped as its fix.

**Root cause** — a contract mismatch between one screen and the route it calls. `ok()` in
`src/lib/route.ts` sends the payload as the bare JSON body and `fail()` sends `{ code, message }`
at the top level. `ReportsSection` was written (1c6aa5c, 16-Sep) against the `{ data, error }`
envelope of the scaffold's `src/lib/api-client.ts`, which nothing in the app uses and no route
produces. It read `body.data`, always `undefined`, so `report` was always null and the screen
fell through to its empty state; a refusal's `body.error.message` was likewise always missing.
The empty state and a discarded answer looked identical, so nothing on screen said a read had
been thrown away.

**Proof it was real, not theoretical** — Supabase edge logs for 23-Sep: after bill B-1044 was
closed at 08:00:05Z, eight report reads for 23-Sep (08:00:15Z to 12:41:57Z) each returned
`content-range: 0-0/*` (one row, B-1044), and a 30-day read returned seven rows. The data reached
the route every time; the screen still showed nothing. RC-014 fixed a real window defect on the
same path, but not this one, which is why R-025 recurred.

**Fix** — the screen's parsing moved into `readReportAnswer` (`src/lib/report-range.ts`), which
reads the shape `ok()`/`fail()` actually send: the body IS the report; a refusal's reason is the
top-level `message`, with a fixed sentence when there is none. `GuestQueue` read a refusal the
same wrong way and now reads `message`.

**Files** — `jalsa/src/lib/report-range.ts`, `jalsa/src/features/owner/sections/ReportsSection.tsx`,
`jalsa/src/features/guest/GuestQueue.tsx`, `jalsa/tests/unit/report-answer.unit.spec.ts` (new).

**How to verify** — run `tests/unit/report-answer.unit.spec.ts`. It builds responses with
`NextResponse.json` exactly as `ok()` and `fail()` do and asserts the report survives, an empty
range stays an empty report, and a 403 shows the server's sentence. Against the pre-fix parsing
three of its four cases fail, which was observed. In the running app: close a bill, open Reports
on its day, and the Sales tile and All orders list include it.

**Recurrence risk** — the class is "a client reading a response shape the server does not send".
Swept every `res.json()` in `jalsa/src` (6 sites, `grep -rn "json()" src`): `ReportsSection`
(success and error, fixed), `GuestQueue` (error, fixed), `useLiveData`, `ChoosePin`, `PinSignIn`
(correct), and `api-client.ts` (the envelope reader itself - unused by any screen, left in place;
its presence is what made the wrong shape look canonical). The route side is one helper, so
the server has one shape.

**Prevention** — `jalsa/tests/unit/report-answer.unit.spec.ts` pins the Reports contract. No
rung yet stops a NEW screen from reading `.data`: the unused `api-client.ts` still advertises the
envelope and `src/app/README.md` still calls it "CP-4: one client". Retiring it, or making the
routes use it, is a decision for the owner of the pattern register, not a bug fix - recorded here
rather than done.

**Process check** — yes. R-025 was closed by RC-014 with its screen never opened ("G8 functional
did not run ... evidence of the DATA, not of the screen"). A fix for "nothing is showing up" was
accepted without anything observing the screen show something; a rung asserting the parse of the
route's real response would have caught it on 16-Sep. The framework-update question is whether a
display-bug fix may close with the display unobserved; raised with the user, not run here.

---

## RC-014 — A calendar day was turned into an instant in the SERVER's timezone, so every report began five and a half hours into the day it claimed to cover
**Date:** 22-Sep-2026  ·  **Severity:** S2  ·  **Modules:** owner reports, db/queries

**Symptom** — "In 'Report' section, nothing is showing up" (R-025, 17-Sep-2026). The range bar
read a date and the panel below it stayed on its reading state or came back empty.

**Root cause** — `listClosedBillsBetween` built its window with ``new Date(`${from}T00:00:00`)``.
A date-time string with no offset is parsed in the HOST's zone, and the host is Vercel, which
runs in UTC. A report for a Hosur day therefore covered 05:30 that morning to 05:30 the next.
The same mistake appeared twice more on the same path: the route validated the requested range
against the server's clock, so between midnight and 05:30 local it answered "that range has not
happened yet" for the shift in progress, and it stamped each bill's day by slicing the stored
UTC string, which files a sitting that ended after midnight under the previous day.

**Proof it was real, not theoretical** — bill B-1048 in the live database is stamped
`2026-09-21T18:46:01.597Z`, which is 00:16 on the 22nd in the restaurant. Under the old window it
was absent from the 22nd and counted on the 21st. Both readings are wrong, and a restaurant that
serves past midnight has one most nights.

**Fix** — `src/lib/restaurant-time.ts`: one place where a `YYYY-MM-DD` becomes an instant, in the
restaurant's zone, with the offset MEASURED via `Intl` at the instant in question rather than
written as `+05:30`. The window is half-open so the last millisecond of a day cannot fall out of
it. The query, the range validation and the per-day stamp all read it. This addresses the cause
rather than the symptom: no caller now owns a zone decision.

**Files** — `jalsa/src/lib/restaurant-time.ts` (new), `jalsa/src/lib/db/queries.ts`,
`jalsa/src/app/api/owner/report/route.ts`, `jalsa/tests/unit/report-timezone.unit.spec.ts` (new).

**How to verify** — run `report-timezone.unit.spec.ts`. It asserts that 22-Sep begins at
`2026-09-21T18:30:00.000Z`, that an instant of `2026-09-21T18:46:01.597Z` falls inside the 22nd
and outside the 21st, and that neither the query nor the route contains the host-local parse or
the UTC slice. Restoring either construction fails seven of its nine cases, which was observed.

**Recurrence risk** — the class is "a local date used as an instant". The sweep found no other
host-local parse in `src/`. It did find four `toISOString().slice(0, 10)` sites that take the
UTC date where a local one is meant: the CSV export filename (cosmetic), `StaffPaperwork`'s
`today()`, `LedgersSection`'s default `spentOn`, and an `Intl` fallback in `analytics/format.ts`.
None is on the report path and none was changed here; they are recorded so the next person does
not have to find them again. The framework already warned about exactly this in `dates.ts`
(CP-15), whose own `dayRange` uses host-local time — correct in the browser, wrong on the server.
Prose was not enough; this register entry and the spec are.

## RC-013 — The starter's "no lockfile, on purpose" was a comment in an uninstalled CI file, and the scaffolder copied whatever `npm install` left behind

**Date:** 11-Sep-2026  ·  **Severity:** S3 (nothing was broken; every app scaffolded from a checkout where anyone had run `npm install` in `starter/` would have been silently born pinned, and would have committed the pin)  ·  **Modules:** `scripts/new-app.mjs`, `.gitignore`, `ci/`

**Symptom** — `starter/package-lock.json` appeared after a routine `npm install` in `starter/`. It was untracked, but nothing ignored it, so `git add -A` would have committed it; and scaffolding a real app with `node scripts/new-app.mjs` copied it into the new app **byte-for-byte** (81,552 bytes), verified by running the scaffolder rather than by reading it.

**Root cause** — v1.33.0 decided deliberately that the starter declares **ranges and ships no lockfile** — it is a shape to copy, not a pinned tree. That decision was written down in **three** places and enforced in none: a comment inside `ci/github-actions-ci.yml` (a file which at the time had never been copied into `.github/workflows/`, so it had never executed anything), and twice in `docs/02-PROJECT-INITIALIZATION.md` — *"The starter is a shape, not a lockfile"* at line 24, and *"lockfile committed"* in the app's own checklist at line 106, which is the correct opposite rule for an app.

That is the finding, sharper than "it was undocumented": the prose was **right, repeated, and consistent**, and it still changed nothing, because no prose is reachable from `fs.readdirSync`. Meanwhile `new-app.mjs`'s `SKIP` set listed only build output — `node_modules`, `.next`, `dist`, `test-results`, `playwright-report`, `.gate-logs` — because a lockfile is not build output and nobody had asked whether it should be *seeded*.

So the intent existed, was correct, and was enforced by nothing. CLAUDE.md's first idea, applied to a decision instead of a rule.

**Fix** — Two lines, at the two places the file can escape. `.gitignore` gains `/starter/package-lock.json`, so it cannot enter the framework's history by reflex. `new-app.mjs`'s `SKIP` gains `package-lock.json`, so a stray one cannot seed an app. Only the starter copy is affected: `copy()` also walks `HALF_A`, which is a list of *directories*, and the framework's own root lockfile sits above all of them — checked before the edit, not after.

This addresses the cause rather than the instance: deleting the file would have fixed today and left both escape routes open.

**Files** — `.gitignore` · `scripts/new-app.mjs` · `scripts/upgrade.test.sh` (the rung) · `ci/github-actions-ci.yml` + `.github/workflows/github-actions-ci.yml`

**How to verify** — `bash scripts/upgrade.test.sh` — the case *"a stray lockfile in the starter never seeds a scaffolded app"*. It **plants** a lockfile in `starter/`, scaffolds a real app, asserts the file did not arrive, and removes the plant. Observed FAILING against the pre-fix `new-app.mjs`, which is the only reason it is worth keeping.

**Recurrence risk** — The class is *a decision recorded only in prose, in a file nothing runs*. One other instance was found in the same sweep and is recorded as debt rather than fixed: `ci/github-actions-ci.yml` and its installed copy under `.github/workflows/` are two files that must stay in step, with nothing comparing them — the installed copy was already one version behind within an hour of being installed, and this run had to re-sync it by hand.

**Prevention** — `rung: scripts/upgrade.test.sh` (the planted-lockfile case). Planted rather than asserted-absent on purpose: with no lockfile in `starter/`, "the app has no lockfile" passes because nothing was there to copy, which proves nothing — the vacuity finding already recorded as FW-SUBJ-008.

**Process check** — **Yes.** The DoD asks whether a decision record was written for a hard-to-reverse decision; "the starter ships unpinned" was treated as too small to record anywhere executable, and it was — until the scaffolder made it every future app's decision too. The lesson is the placement, not the size: a decision that some *script* must honour belongs in that script's behaviour, with a rung, not in a comment beside it.

---

## RC-012 — Three guard suites reported twelve defects in code that was correct: a path crossing from the shell into JavaScript source is data, and nothing translates it

**Date:** 11-Sep-2026  ·  **Severity:** S3 (no application defect; the cost was diagnostic — the suites accused healthy code, and off-POSIX the framework's own `guard:test` could not go green)  ·  **Modules:** `scripts/*.test.sh` — the shell test harnesses

**Symptom** — `npm run guard:test` reported 10/13 on Windows. `ratchet` failed 6 of 9, `theme-build` 3 of 11, `pwa-baseline` 3 of 13. The messages named assertions and called them broken: *"no baseline is BLOCKED, neither pass nor fail (expected 3, got 1)"*, *"the manifest is valid and its colours come from the tokens"*. Every one of those subjects was in fact correct.

**Root cause** — A path used as **argv** is translated by the shell on the way out, so `node "$ROOT/x.mjs"` resolves everywhere. A path interpolated into JavaScript **source** — an ESM import specifier, a `readFileSync` argument — is *data*, and no translation runs. Git Bash's `/c/Explorations/...` therefore reached Node verbatim and was resolved as `C:\c\Explorations\...`. Ten of the thirteen suites pass paths only as argv, which is exactly why the distinction stayed invisible until the three that do not were run off POSIX.

Two things turned a portability bug into a diagnostic one. The failures were reported **as defects in the subject** rather than as a harness that could not run — the third verdict exists for precisely this and a bash harness had no way to say it. And `2>/dev/null` on the `node -e` calls discarded the `ERR_MODULE_NOT_FOUND` and `ENOENT` that named the cause outright.

**Fix** — `scripts/lib/shpath.sh`, sourced by every harness that crosses the boundary. `jspath` yields the native form for `fs`; `jsurl` yields a `file://` URL, which is the **only** form Node accepts as an ESM specifier — a bare `C:/...` is rejected as `ERR_UNSUPPORTED_ESM_URL_SCHEME` because the drive letter parses as a scheme. That is two functions because it is two requirements, and `shpath.test.sh` case 3 asserts the bare form is still rejected, so the day it is not, the redundancy is reported rather than assumed.

This addresses the cause rather than the three symptoms: the conversion exists once, and the sweep in case 4 means a fourth harness cannot reintroduce it quietly.

**Files** — `scripts/lib/shpath.sh` (new) · `scripts/shpath.test.sh` (new) · `scripts/ratchet.test.sh` · `scripts/theme-build.test.sh` · `scripts/pwa-baseline.test.sh` · `scripts/upgrade.test.sh` · `package.json`

**How to verify** — `bash scripts/shpath.test.sh` — 7 assertions. Case 4 sweeps every harness in the tree; case 5 plants a violation and proves the sweep fires on it. On any platform, `npm run guard:test` is 14/14.

**Recurrence risk** — Searched every shell harness in the repo with `grep -nE "'[\$][A-Za-z_][A-Za-z0-9_]*/"` over the 13 files matched by `scripts/*.test.sh`, `scripts/hooks/*.test.sh`, `.claude/hooks/*.test.sh`, `.codex/hooks/*.test.sh`. Four files were affected: the three that failed, **plus `scripts/upgrade.test.sh:199`**, which was not failing — its `|| sed` fallback silently absorbed the broken `require()`, so it produced the right answer by a route nobody intended. That fourth site is the argument for the sweep: two of the four shapes this class takes do not announce themselves.

The class is not confined to Windows — it is any shell whose path namespace differs from the interpreter's. It stayed dormant because CI runs Ubuntu, where the two coincide.

**Prevention** — `rung: scripts/shpath.test.sh` (case 4, the sweep; case 5, the fail-first plant), wired into `npm run guard:test`. Deliberately **not** a ratcheted audit in `audit:all`: an application has no shell harnesses, so the detector would parse nothing there and report BLOCKED, turning every green app red — the precise outcome the ratchet exists to prevent. The check is scoped to the tree that owns the harnesses.

The sweep requires a following `/` to fire. A whole path held in one variable — `'$MF'` — is not distinguishable by syntax from a JSON key — `'$field'` — and a check that flags correct code is switched off within a day. The narrow form that never lies is the one that survives; the residual shape is covered by the `_js` / `_url` naming convention and by review. Stated here rather than implied, per CLAUDE.md rule 1.

**Process check** — **Yes.** Two gaps, both now closed. `guard:test` was only ever executed on the platform that happened to work, so "every guard is proven to fire" was true on Ubuntu and unverified anywhere else. And the harnesses suppressed the interpreter errors that named the cause — the same "never go quietly dead" rule the `.mjs` layer obeys had no expression in the shell layer. CP-31 records the boundary rule; this entry records why it cost twelve false accusations to find.

---

## RC-011 — The reference implementation had never been compiled, linted, or run: the starter declared no toolchain, so four gates could not execute anywhere

**Date:** 10-Sep-2026  ·  **Severity:** S2 (the framework's own reference implementation did not type-check, and its functional specs described a screen that did not exist)  ·  **Modules:** the starter — toolchain, types, lint, unit tier, functional tier, configuration, the reference screen

**Symptom** — `npm run gate` reported G5–G8 BLOCKED in 30 consecutive runs. Every entry blamed the
environment: *"no local tsc — run npm install"*. Running `npm install` in `starter/` installed
**nothing**, because `starter/package.json` declared no dependencies at all — not here, not in
CI, not on any machine. The registry was reachable the whole time.

**Root cause** — the starter was "a shape, not a lockfile", and that sentence had been read as
"declare nothing" rather than "pin nothing". With no toolchain obtainable, the four application
gates were structurally un-runnable, and everything they would have caught accumulated unseen
for the reference implementation's whole life. Making them runnable surfaced, in order:

1. **44 type errors** across 20 files — nearly all the starter's own strict settings
   (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) biting code nobody had ever
   type-checked; one missing dependency (`dotenv`); one error in v1.31.0's own `PwaProvider`.
2. **7 lint findings** and no ESLint configuration for G6 to run against.
3. **The unit tier booted the whole application.** `webServer` is global, so `playwright test
   tests/unit` started `next dev` and waited two minutes — contradicting the first sentence of
   the config's own header — and G7 timed out in any environment that could not serve the app.
4. **The functional specs described a screen that did not exist.** `tests/functional/` drove a
   list, an add/edit dialog, an archive confirmation and a keyboard journey against `/`, which
   served a 404. Both specs were worked examples of tests with no worked example of the thing
   tested.
5. **`config.ts` read `process.env[name]` dynamically**, which no bundler inlines, so every
   `PUBLIC_*` value was undefined in the browser and `publicConfig` threw at import in every
   client component. Nothing noticed because nothing had ever loaded a client component.
6. **`ConfirmDialog` rendered `confirm-ok`** while its own comment and the spec said "never OK".
7. **`Dialog`/`ConfirmDialog` rendered class names no stylesheet defined**, so the dialog had
   never been drawn.
8. **`TabRow` called `scrollIntoView()` on every mount.** Chromium moves the sequential focus
   navigation starting point to the scrolled element, so the first Tab on the page skipped the
   active tab. Found by the keyboard spec the first time it could run.
9. **The specs' data assertions raced.** `expect(written).toHaveLength(1)` the instant a
   keypress resolved failed one run in four with no defect — the write is dispatched inside the
   event and intercepted a moment later. The reference spec's own habit 3 ("assert the DATA")
   now says: and wait for it.
10. **Two projects ran on WebKit**, which the CI template never installs — 36 of 108 functional
    runs failed at browser launch in every environment.

Ten findings, one cause: **a gate that cannot run finds nothing, and "nothing found" is
indistinguishable from "nothing wrong" for as long as the gate stays blocked.** Binding rule 4
says BLOCKED is never a pass; RC-009 made the block audible; RC-010 made the streak visible.
This is what was behind it.

**Fix** —
- `starter/package.json` declares its toolchain **as ranges** (still no lockfile — the shape
  is kept, the emptiness is not). Every name verified against the registry before being written.
- All 44 type errors fixed at the site, never baselined; `tsc-baseline.txt` written at zero.
- `eslint.config.js` (the two recommended sets, nothing else); all 7 findings fixed.
- The unit tier starts no server (`playwright.config.ts` recognises `tests/unit` on the
  command line — the only signal that exists before the config is evaluated).
- **The reference screen exists**: `src/features/items/` composes `TabRow`, `ListControls`,
  `Dialog`, `ConfirmDialog` and `ToastHost` and builds none of them (documented in
  `starter/docs/modules/items.md`). Archive model, edit parity, re-read after every write, Save
  hands control back at once and a failed save returns the dialog with the draft.
- `config.ts` reads `PUBLIC_*` through a static table; `next.config.mjs` inlines them under
  the framework's own prefix. `confirm-accept`. Dialog and list styles, tokens only. `TabRow`
  scrolls only when out of view. Every `written` assertion polls. The iOS-device projects run
  on Chromium, with the WebKit gap named in the config rather than implied.
- The functional server is configured in `webServer.env` and needs no `.env`; a sandbox that
  forbids browser downloads names its Chromium in `PW_CHROMIUM_PATH`.

**Files** — `starter/package.json` · `starter/eslint.config.js` (new) · `starter/next.config.mjs`
(new) · `starter/playwright.config.ts` · `starter/src/lib/config.ts` · `starter/src/app/page.tsx`
(new) · `starter/src/features/items/*` (new) · `starter/docs/modules/items.md` (new) ·
`starter/src/components/{Dialog,ConfirmDialog,TabRow,PwaProvider,ModuleAccessPanel}.tsx` ·
`starter/src/components/analytics/{InsightCard,MetricCard,AnalyticsTable}.tsx` ·
`starter/src/components/components.css` · `starter/src/lib/{api-client,audit,loading,logger,
module-customizer,module-access,pricing,selection,list-controls}.ts` · `starter/src/lib/analytics/metrics.ts`
· `starter/src/hooks/{useListControls,useAsync}.ts` · `starter/tests/**` · `starter/.baselines/tsc-baseline.txt`

**How to verify** — in `starter/`: `npm install` → `npm run typecheck` (clean) → `npm run lint`
(clean) → `npm run test:unit` (113 pass) → `npm run test:functional` (108 pass, six projects).
Then `npm run gate` at the root: **G5–G8 PASS, each with a measured duration** — the first time
in 31 recorded runs that any of the four has reported anything but BLOCKED.

**Fail-first evidence** — every finding above was observed as a real failure of the gate that
caught it, on the real tree, before its fix: `tsc` 44 errors · `eslint` 7 errors · G7 timed out
at 2m 01s · G8 against a 404 · "2 required client variable(s) are missing" in the browser
console with both set on the server · Tab order `[details, add, search]` with `overview` skipped
· the keyboard journey passing 3 of 4 repeats · 36 of 108 failing at `browserType.launch`.
Every one of those runs is in the session's gate logs and ledger.

**Recurrence risk** — **Structurally closed for the class**: with a declared toolchain, G5–G8
run in CI and locally, and nothing can accumulate unseen behind them again. What remains, named:
WebKit is not exercised anywhere (a CI decision, recorded in the config); `tsc-baseline.txt`
is at zero and is therefore a clean gate — the moment an app adopts with a backlog, the ratchet
takes over, which is what it is for.

**Prevention** — `rung: starter/tests/functional/reference.functional.spec.ts` ·
`rung: starter/tests/functional/keyboard.functional.spec.ts` · `rung: starter/tests/unit/*.spec.ts`
(113) · gate G5–G8 themselves, now executable; the `Time:` line of every gate run is the proof
that they ran.

**Process check** — **Yes.** The gate said "install the toolchain" for 30 runs, and every run
accepted that as an environment problem — including v1.30.0, which fixed the *directory* the
message pointed at and left the message. The framework's own test of a claim is to execute it;
nobody executed `npm install`. A blocked gate is a claim that the check *could* run somewhere.
This entry is what it cost to test that claim once.

---

## RC-010 — A check that did not run was recorded as PASS, by every ratchet, in any app missing a baseline

**Date:** 10-Sep-2026  ·  **Severity:** S2 (no application defect shipped; the gate's verdict was false in exactly the direction its design exists to prevent)  ·  **Modules:** process — the ratchet engine, the concurrent runner, the gate runner, the close-out renderer, the conformance fixtures

**Symptom** — a scaffolded app with its service worker deleted and no PWA baseline: `npm run gate`
reports **G12 Installable as an application — PASS**. The audit's own stderr, in the same run:
*"this gate is INERT and is telling you so."*

**Root cause** — `RATCHET_SKIP = 0`. The engine told stderr that the check had not run, and
exited with the code that means it passed. The gate runner has three verdicts precisely so that
"did not run" is never mistaken for "passed", and it reads exit codes, not prose — so every
ratchet (G4 · G9 · G11 · G12) reported PASS in any app missing its baseline. Green by omission,
at the one layer built to prevent it, from the day the ratchet library was written. Binding
rule 3 said so in its own text — *"a missing baseline prints a loud SKIPPED and passes"* — and
binding rule 4 said the opposite one paragraph later: *"a step that did not run is BLOCKED."*
Two binding rules disagreed, and the code honoured the wrong one. The same engine's "parsed
nothing" branch *printed* BLOCKED and *exited* 2, which the gate rendered as FAIL: "your code is
broken" about a tree nothing had looked at.

Three further findings from the same pass, each recorded debt from RC-009 or v1.31.0:

1. **Nothing read the ledger.** `TEST_SUMMARY.md` is append-only and was read by no script, so
   RC-009's four steps sat in it for 24 consecutive runs with nobody noticing — a signal that
   never changes is indistinguishable from no signal.
2. **Two version identities.** `package.json` said `1.3.0`; `VERSION` said `1.31.0`. Every bump
   for twenty-eight releases was a hand edit to one and never to the other, because
   `close-out --apply` rendered the story into three places and the *number* into none.
3. **The fixture rung for v1.31.0's upgrade-clobber was vacuous.** `fixtures/diverged` gained a
   generated manifest and theme module — and the new check PASSED against the pre-fix ownership
   rule. Conformance ages lineage with `--init`, which marks a file that already differs from the
   seed `adopted-modified` (sticky, routed to review, never overwritten). A real scaffold records
   it `pristine` with the app's own hash — the path that clobbered. A fixture walking the wrong
   path proves the wrong thing with the same green.

**Fix** —
- `RATCHET_SKIP = 3`. A missing baseline is BLOCKED at the ratchet, and the phrase `no baseline
  at` is kept verbatim because `upgrade.mjs` greps for it to write the baseline on apply — which
  is what makes the change safe: an app that upgrades never meets this exit. The parsed-nothing
  branch exits 3 too, so its message and its code are finally the same word.
- `par.mjs` reads 3 as `BLKD`, lists blocked tasks separately, and exits 3 unless something
  genuinely FAILED, which outranks. CI therefore goes BLOCKED, not red, on an unbaselined app.
- `gate-runner.mjs` reads its own ledger before rendering: a step BLOCKED for a reason of its own
  (not a `--only`/`--skip` flag) for three or more consecutive runs is named as a streak on its
  own report line. Runs that did not select the step neither extend nor break the streak. On this
  repository's real ledger the first run reported **28 consecutive** for G5–G8.
- `close-out.mjs --apply` writes `VERSION` and `package.json`'s version from the record. The
  number is part of the story.
- `conformance.mjs` ages the fixture's generated artifacts the way `new-app` records them —
  `pristine`, with the app's own hash — and the new checks fail against the old rule.
- Binding rule 3 amended: tooling gaps fail open in the **commit guard**; a missing baseline in a
  **gate** is BLOCKED. Rule 4 unchanged; the two now agree.

**Files** — `scripts/lib/ratchet.mjs` · `scripts/par.mjs` · `scripts/gate-runner.mjs` ·
`scripts/close-out.mjs` · `scripts/conformance.mjs` · `fixtures/diverged/public/manifest.webmanifest`
(new) · `fixtures/diverged/src/theme/tokens.generated.ts` (new) · `scripts/ratchet.test.sh` (new)
· `scripts/gate-scope.test.sh` · `scripts/close-out.test.sh` · `CLAUDE.md` ·
`docs/17-ENFORCEMENT-RATCHETS.md` · `fixtures/README.md` · `package.json`

**How to verify** — `bash scripts/ratchet.test.sh` → 9/9. Delete any `.baselines/*-baseline.txt`
in an app and run `npm run gate`: that step reads **BLOCKED**, with a duration, naming the missing
baseline — never PASS. `npm run audit:all` in the same app ends `BLOCKED: <task>` and exits 3.
Run `npm run gate` twice more: the third report names the streak. `cat VERSION` and
`node -p "require('./package.json').version"` print the same number.

**Fail-first evidence** — `ratchet.test.sh`: 3 of 9 observed failing (exit 0 for no baseline;
`par` exit 1 and label `FAIL` for a blocked task). `gate-scope.test.sh` cases 13–15: 3 of 3
observed failing (G4 PASS at the gate; no baseline named; no streak). `close-out.test.sh`: 2
observed failing (`VERSION` left at 1.0.0; `package.json` untouched). Conformance `diverged`: both
new checks observed failing against `HEAD~1:scripts/lib/lineage.mjs` **once the fixture was aged
as a scaffold** — and observed *passing* against it before that, which is the vacuity finding
itself. Case 14's first draft failed for a reason of its own: the ledger was read *after* the
report was rendered, so the streak was computed and never printed; fixed by reading first.

**Recurrence risk** — **Reduced structurally.** The class is "the message and the verdict
disagree, and the consumer reads the verdict." The exit codes are now the same word as the
messages at every layer (`ratchet.test.sh` holds all three), and the drift between `VERSION` and
`package.json` cannot recur because neither is hand-edited any more. `grep -rn "RATCHET_SKIP\|exit 3\|code === 3" scripts/` → **9 matches**, all reviewed, all consistent. What remains: a
**workspace** app that never runs `framework:upgrade` still has no baseline for a gate added
after it was scaffolded — it now sees BLOCKED where it saw PASS, which is the true verdict
replacing a false one, and the fix is the one command `UPGRADES.md` names.

**Prevention** — `rung: scripts/ratchet.test.sh` · `rung: scripts/gate-scope.test.sh` (cases
13–15) · `rung: scripts/close-out.test.sh` (version identity) · `rung: fixtures/diverged/` via
`scripts/conformance.mjs`. Rule 3's text now matches rule 4's.

**Process check** — **Yes.** Every one of these was named as honest debt in v1.30.0 or v1.31.0's
own close-out. Debt that is written down and then left is the same as debt nobody wrote down,
one version later. This run is the framework-update loop doing the thing it says it does:
reading its own previous entry and paying it.

---

## RC-009 — Three checkers judged their own invocation instead of the tree, and one of them had been failing every run for 24 runs

**Date:** 10-Sep-2026  ·  **Severity:** S2 (no application defect shipped; the framework's own gate could not return an informative verdict, and every scaffolded app inherited two of the three)  ·  **Modules:** process — the theme build, the gate runner, the CI workflow

**Symptom** — three unrelated-looking complaints, found while auditing the framework for stability:

1. `npm run theme:build` from `starter/` and from the framework root produced **different bytes
   from identical tokens**, so `--check` reported `DRIFT … stale or hand-edited` on files
   nothing had edited. Gate **G1** and commit guard **G4** both blamed the tree.
2. `npm run gate` at the framework root recorded **`VERDICT: BLOCKED` in 24 of the 27 runs**
   in `TEST_SUMMARY.md`, always the same four steps (G5 Types · G6 Lint · G7 Unit · G8
   Functional), always with the remediation "run `npm install`".
3. A gate run on a tree no gate had ever seen announced *"This run was avoidable. The tree is
   byte-identical to the previous gate run."*

**Root cause** — one shape, three instances: **a checker described its own invocation and
called it a property of the subject.**

1. `theme-build.mjs` baked the token source into every generated file as a path relative to
   `process.cwd()`. `starter/src/theme` built from the root wrote `starter/design/tokens.json`;
   the same tokens to the same directory built from `starter/` wrote `design/tokens.json`. The
   builder was a function of where it was invoked, so its own byte-comparison checker could
   never agree with itself in two places. `starter/package.json` runs `theme:build` **and**
   `gate` from the application directory, so the starter's own scripts and the framework root's
   rejected each other's output with no fixed point.
2. `gate-runner.mjs` had already learned to separate the CHECKER's location from the SUBJECT's
   — that was an earlier fix, and its comment is still in the file. It never asked the second
   question: *within the subject, where is the application?* In this repository the application
   is `starter/`; in a scaffolded app it is the root. `scripts/lib/layout.mjs` exists to decide
   exactly that and **every audit imports it**; the gate runner was the sole consumer that did
   not. So G5–G8 ran `tsc`, `eslint` and the app's test scripts against the framework root — a
   directory that deliberately has no tsconfig, no eslint config and no test scripts, because
   none of those things are the framework's. The result was not a wrong answer, which someone
   would have chased. It was BLOCKED, permanently, pointing at a `package.json` that was never
   going to carry the application's toolchain.
3. The runner wrote its tree fingerprint after **any** run, including one narrowed by `--only`
   that examined two steps out of eleven. The test suites in this repository drive the real
   runner with `--only` against the framework root, so `npm run guard:test` silently stamped
   "this tree has been gated" on a tree that had not been.

The unifying defect is the one binding rule 5 already states in its narrow form — *never let a
detector read its own output as evidence.* Each of these three passed that reading and failed
its general form: **only a run that verified the thing may record that the thing was verified,
and a generated artifact may not encode the circumstances of its generation.**

A fourth instance, same family, was found in the same sweep: `ci/github-actions-ci.yml`
enumerated the audits by name, which made it a hand-maintained **copy** of `audit:all`. It had
drifted — `audit:fixtures` and `audit:deadweight` were in `audit:all` and not in CI — so two of
the ten audits could not fail a pull request, under a file header that reads *"If CI and local
run different checks, one of them is decoration."*

**Fix** — remove the variable rather than compensate for it, in all four:

- The generated header names the token source **relative to the generated file's own
  directory**. Both paths are already absolute, so cwd cannot enter. It is also the same string
  in both layouts (`../../design/tokens.json`), which means the artifact the framework ships and
  the one a scaffolded app rebuilds are byte-identical — see *Recurrence risk*. And unlike a
  cwd-relative path it is **followable** from the file that carries it.
- The gate runner resolves the application subtree through `appPath()`, the same helper every
  audit uses, marks G5–G8 `app: true`, runs them there, resolves their local binaries from
  there, and **states the directory in the report**. `--app` overrides it. A BLOCKED step now
  names the directory to install in, so a remediation that cannot work is no longer printed.
- Only a run with no `--only` and no `--skip` writes the fingerprint. A narrowed run may still
  *read* it; what it may not do is leave a record implying it produced a verdict it did not.
  `--logdir` was added alongside, so a harness driving the real runner keeps its step logs out
  of the subject's `.gate-logs/` — the same stale-artifact trap, one level down.
- CI **calls** `audit:all` instead of restating it. A new audit is now wired into CI by the same
  edit that adds it to the script, and there is no second list to forget. `par.mjs` labels every
  task and runs them all, so a CI failure still names each failing check individually.

**Files** — `scripts/theme-build.mjs` · `scripts/gate-runner.mjs` · `ci/github-actions-ci.yml` ·
`package.json` · `starter/src/theme/tokens.generated.css` · `starter/src/theme/tokens.generated.ts`
· `scripts/theme-build.test.sh` (new) · `scripts/gate-scope.test.sh` (new) ·
`scripts/gate-timing.test.sh` (isolated its logs) · `FRAMEWORK_MANIFEST.md` ·
`docs/00-OVERVIEW.md` · `tests/cases/FRAMEWORK_PROCESS_CASES.md`

**How to verify** —
`bash scripts/theme-build.test.sh` → 5/5 · `bash scripts/gate-scope.test.sh` → 12/12.
Then `npm run gate` and read the new `Application steps ran in` line: it must name `starter`
here and `.` in a scaffolded app. With `typescript` installed under `starter/`, G5 reports a
**measured duration** instead of `-` — that is the difference between a step that ran and a
step that never spawned, and it is the whole claim of this fix.

**Fail-first evidence** — every case below was run against the pre-fix tree before its fix
landed:
- `theme-build.test.sh` — **3 of 5 observed failing** (cwd-identical build, `--check` from the
  application directory, header followability). Cases 3 and 5 are regression guards and
  correctly pass in both trees — 5 is the one that matters: the checker must still catch a
  genuinely hand-edited file, or crying-wolf has been traded for going blind.
- `gate-scope.test.sh` — **6 of 12 observed failing** against `HEAD:scripts/gate-runner.mjs`,
  restored for the run and put back afterwards.
- Instance 3 was additionally reproduced by hand, deterministically: gate a tree, edit a file,
  run `npm run guard:test`, gate again → the notice fired on a mandatory run.

**Recurrence risk** — **Reduced structurally, and the reach was wider than it looked.**
Instance 1 was not confined to this repository. `new-app.mjs` copies `starter/` into a new app
and then **rebuilds** the theme inside it, so every scaffolded app was born with two generated
files differing from its own recorded seed. `upgrade.mjs` reads that as `pristine` + "the
framework changed it" and auto-overwrites both on **every** upgrade — re-breaking the new app's
G1 — whether or not a single token had moved. Making the header identical in both layouts
removes the divergence at its source, so there is nothing left for the upgrade to report.

The conformance fixtures did not catch it and still would not: `fixtures/*/src/` carries no
`theme/` directory, so no fixture exercises a generated artifact across the scaffold-then-
rebuild path. That is **recorded debt, not coverage** — the two new suites test the builder and
the runner directly, which closes the defect but not the fixture gap. Named here so it is
findable rather than rediscovered.

`grep -rn "process.cwd()" scripts/ --include=*.mjs` → **11 matches**, all reviewed. Ten are
correct: they anchor CLI *messages* and *input resolution*, which are properly relative to the
person who typed the command. The eleventh was `theme-build.mjs`'s `rel()` used inside generated
*content*, and only that use is fixed — `rel()` itself is still right for the messages it also
serves. The distinction to keep is **message versus artifact**, not "avoid cwd".

**Prevention** — `rung: scripts/theme-build.test.sh` (instance 1) ·
`rung: scripts/gate-scope.test.sh` (instances 2 and 3) · instance 4 is prevented
**structurally**: with CI calling `audit:all` rather than restating it, the two lists it could
drift between no longer both exist. That is the cheapest enforcement level in the rule budget —
no new rule, no new check, one fewer thing to keep in step.

**Process check** — **Yes, and the gap is worth naming.** Every one of these was reachable from
artifacts the process already produces. Instance 2 in particular had been writing its own
evidence into an append-only ledger for 24 consecutive runs: same verdict, same four steps,
every time. Nothing reads that ledger for a *trend*, so a signal that never changed was
indistinguishable from no signal. The framework's own first idea — a rule that nothing executes
is not a rule — has a corollary this incident supplies: **an output nobody reads is not a
signal.** `TEST_SUMMARY.md` remains append-only and unread by any script; that is honest debt,
recorded here, and it is the reason this took an explicit audit to find rather than surfacing
on its own.

---

## RC-008 — The stage-timing rule was prose-only, so the slow stage was diagnosed by feeling

**Date:** 08-Sep-2026  ·  **Severity:** S3 (no defect shipped; the process could not see its own cost)  ·  **Modules:** process — the verification stage, the gate runner

**Symptom** — the owner reported that corrections complete quickly but verification "often
exceeds one hour", with no figure for which part of it. Measured on this repository the same
day: `audit:all` 17.7s · `guard:test` 60.2s · `npm run gate` 8.6s — **~87 seconds**, about 2.4%
of the reported stage. The remaining ~58 minutes were agent-side and entirely unattributed.

**Root cause** — two failures, and the first is this framework's own first idea failing on
itself:

1. **A rule with no rung.** v1.13.0 shipped "run reports carry stage timings (ground · plan ·
   build · verify · gate), minutes each" — case **FW-SPEED-003**, whose anti-pattern is
   verbatim *"a slow run with no timing data, diagnosed by feeling."* `CHANGELOG.md` and
   `UPGRADES.md` both promise it. Nothing executed it: the only party asked to honour the rule
   was the narrator, and a duration recalled at the end of a run is what `gate-runner.mjs`'s
   own header calls *"a verdict typed from memory — a guess with formatting."* Three versions
   later the rule had produced not one measured number, so the first real report of slowness
   arrived exactly as the anti-pattern describes. `grep -rniE "elapsed|duration|hrtime|
   performance\.now|Date\.now\(\)" scripts/` returned **3 matches, all CSS
   `animation-duration`** — zero instrumentation in the whole tree.
   *Why the rule-coverage audit did not catch it:* `check-rule-coverage.mjs` reads
   `CANONICAL_PATTERNS.md`, `ROOT_CAUSE_REGISTER.md` and `DESIGN_RULES.md` — IDs `CP|RC|DR|FP`.
   `FW-*` process cases are outside its population, so "backlog is zero — CLEAN GATE" was true
   of what it reads and silent about this. The audit did not lie; its scope simply never
   included the register this rule lives in.

2. **Proportionality was applied to half the run.** v1.19.0 gave the **build** side three lanes
   and v1.20.0 parallelised generation; the review matrix scaled *who reviews*. Nothing ever
   scaled *what verification executes*. `test-gate.md` opened "Runs after ANY code change" with
   nine T1 sub-steps each marked **(blocking)** and no scale column, so a two-file label fix
   enumerated the same constraint space, configuration space and four dimensions as a schema
   migration. T3 alone was risk-proportional. Verification was therefore the longest stage in
   every run **by default rather than by risk** — and being unmeasured, it stayed that way
   through three consecutive speed releases that all aimed at the build half.

**Fix** — the gate runner **measures**: per-step duration, the total, and the slowest step
named, prepended to the append-only `TEST_SUMMARY.md` so the trend accrues with no upkeep. A
step that never spawned prints `-`, never `0ms` — zero is a measurement, and a step that did
not run has none. `workflows/test-gate.md` gains **the verification lane**: which T-steps run
at micro · scoped · full-scale, keyed to the `SCALE:` declaration guard **G8** already verifies
against the diff, so the lane costs no new token and no new guard. What shrinks is the
enumeration of classes the change cannot reach; T1.5 fail-first, T1.6 the registry delta and
T2 the mechanical gate are marked **never scales**.

**Files** — `scripts/gate-runner.mjs` · `scripts/gate-timing.test.sh` (new) · `package.json`
(`guard:test`) · `workflows/test-gate.md` · `workflows/feature.md` · `docs/01-SDLC.md`

**Verification step** — `bash scripts/gate-timing.test.sh` → 8/8. Run `npm run gate` and read
the `Time:` line: total plus the slowest step. Four of the eight assertions were **observed
failing** against the pre-timing runner; the other four are regression guards on the verdict
contract and correctly pass in both trees.

**Recurrence risk** — **Medium, and named honestly.** Only the *gate* stage is now measured.
Ground · plan · build · verify remain narrator-reported, because no process in this framework
observes wall-clock across an agent's stages — there is nothing to hook. That is recorded debt,
not coverage: FW-SPEED-003's rung covers the gate stage only, and the case says so. The second
risk is the lane being claimed for a change that outgrew it; G8 checks the `micro` claim
against the diff, and mid-run promotion is stated out loud, but a *scoped* claim on a
full-scale change has no mechanical rung and is review-only.

---

## RC-007 — Seventeen defects reached a user through a passing SDLC run

**Date:** 06-Sep-2026  ·  **Severity:** S1 (two of the seventeen destroy data silently)  ·  **Modules:** process — the design, build and test stages

**Symptom** — an owner reported seventeen defects found *after* the workflow ran green: an
Edit screen opening blank and another opening the Add form; a member picker that broke on two
identical names; a save that reported success while writing nothing; "Message sent" for mail
that never left; report figures that never moved; PIN boxes two-per-row under the keypad;
sign-out landing on the wrong screen; a raw database error shown to a user; an unchanged save
destroying a stored schedule; audit rows attributed to "System".

**Root cause** — three distinct process failures, not one:

1. **Rules that existed but had no rung.** "A save is proved against the data, never the
   toast" is a Definition-of-Done item and a documented spec habit — and both false-success
   defects walked past it, because nothing *executed* it. This is the framework's own first
   idea failing on the framework's own rule: a rule nothing runs is not a rule.
2. **Rules that did not exist at all.** Nothing in the framework said an edit surface must
   arrive populated, that an unchanged save must round-trip untouched fields, that selection
   is keyed by database id rather than a display label, or that placeholder data must not
   reach shipped source. Four defect classes, no rule to violate.
3. **Capabilities re-implemented instead of reused.** The library already ships a dialog whose
   backdrop uses the `overlay` token (verified: `rgba(11,15,25,0.45)` / `rgba(0,0,0,0.65)` —
   correctly translucent in both themes), an error taxonomy that forbids raw engine strings
   (CP-11), and a fixed-chrome clearance rule (CP-8). The black backdrop, the raw database
   error and the keypad overlap are each a re-encounter of a solved problem. **Rebuilding a
   registered component re-inherits every bug it had already fixed.**

**Fix** — one mechanical gate, one canonical pattern with an executable rung, one amended
pattern, and one review table placed where a fixer actually reads it:

- `scripts/audits/check-fixture-leak.mjs` (+ `npm run audit:fixtures`, in `audit:all`) —
  ratcheted detection of fixture imports, placeholder-named literals and hardcoded datasets in
  shipped source. Closes the Edit-Member-fixture and hardcoded-reports classes.
- **CP-25** — edit surfaces load before they render, are keyed by database id, and an
  unchanged save round-trips every field. Rung: three new journeys in
  `starter/tests/functional/reference.functional.spec.ts`.
- **CP-15 amended** — a date arriving by import, paste or API bypasses the picker, so it is
  unambiguous or rejected. `01/09/2026` is two different days.
- `workflows/bug.md` **C2b** — the five classes a green suite does not see, each with the
  assertion that catches it.

**Files** — `scripts/audits/check-fixture-leak.mjs`, `starter/.baselines/fixture-leak-baseline.txt`,
`starter/tests/functional/reference.functional.spec.ts`, `docs/registers/CANONICAL_PATTERNS.md`,
`workflows/bug.md`, `package.json`, `FRAMEWORK_MANIFEST.md`, `docs/00-OVERVIEW.md`.

**How to verify** — add `const MOCK_ROWS = [{a:1},{a:2}]` to any application source file and
run `npm run audit:fixtures`: it must report a new violation and exit non-zero. Then open an
existing record in the app, save without editing, and assert the write contains every stored
field — including fields the form never rendered.

**Recurrence risk** — high for the two classes that remain **review-enforced**. The
false-success class (bugs 10 and 17) has a rule, a Definition-of-Done item and a reference
assertion, but **no automated rung**: detecting "asserts a toast but never asserts the write"
requires knowing which assertion is the effect, which a scanner cannot decide. Stated as
honest debt rather than papered over with a fourth restatement of the same rule — the rule
budget forbids minting a second rule for a class that already has one. The re-implementation
class is now addressed at the process level by the v1.21.0 reuse-first decision, whose
enforcement is a recorded answer in the change log, not a script.

**Prevention** — `scripts/audits/check-fixture-leak.mjs` (mechanical, ratcheted) ·
CP-25 rung `starter/tests/functional/reference.functional.spec.ts` (mechanical) ·
CP-15 amendment (review) · `workflows/bug.md` C2b (review) ·
`workflows/framework-update.md` Route B step 0/4 reuse decision (review, recorded).

**Process check** — **Yes.** A correctly functioning process would have caught at least eleven
of the seventeen: the four with existing rules that nothing executed, the three re-implemented
capabilities, and the four now covered by CP-25 and the fixture ratchet. The framework-update
workflow ran; this entry and the changes above are its output. The remaining six were
application-domain defects (routing after sign-out, existence checks before the PIN screen,
actor propagation) whose classes are now named in `bug.md` C2b but whose fixes belong in the
application's own `/bug` runs.

---

## RC-006 — writeBaseline glued the first entry onto the header
**Date:** 28-Aug-2026 · **Severity:** S2 · **Modules:** ratchet engine (all baselined gates)

**Symptom** — `fixtures/with-debt` failed conformance: an audit re-run immediately after
`--write-baseline` reported the just-baselined violation as NEW.

**Root cause** — `writeBaseline`'s header array ends with `''` to produce the final newline, but
`.filter(Boolean)` treats `''` as false and stripped it — gluing the first entry onto the last
comment line, where `readBaseline` discarded it as a comment. Every 0-entry (clean) baseline
masked the bug; the first 1-entry baseline exposed it.

**Fix** — `.filter((x) => x !== null)`. All framework baselines regenerated with the fixed writer.

**Files** — `scripts/lib/ratchet.mjs`

**How to verify** — write a 1-entry baseline with any audit's `--write-baseline`, re-run the
audit: exit 0, "none new". `fixtures/with-debt` pins this permanently.

**Recurrence risk** — every consumer of `writeBaseline` shared the defect; one fix covers all.
Sweep evidence: `grep -rn "filter(Boolean)" scripts/` → 0 remaining matches.

**Prevention** — rung: `scripts/conformance.mjs` (with-debt checks) + `scripts/audits/check-backward-compat.mjs`.

**Process check** — **Yes.** No gate ever exercised a NON-EMPTY baseline round-trip; all the
framework's own baselines were clean, so the writer's output was never read back with content.
The fixture suite now does exactly that on every change — that is the process fix, shipped in
the same release.

---

## RC-005 — the first upgrade after adoption clobbered pre-existing app edits
**Date:** 28-Aug-2026 · **Severity:** S1 · **Modules:** lineage, upgrade

**Symptom** — `fixtures/diverged` failed conformance: its deliberate seed-file modification did
not survive an upgrade — the divergence marker was overwritten.

**Root cause** — `lineage --init` recorded already-modified files as `pristine` ("today's hash is
your baseline"). `upgrade` then read *pristine + seed differs* as "the framework changed this"
and auto-applied — but the difference was the APP's edit, made before lineage existed. Two
different histories collapsed into one status.

**Fix** — `--init` compares each file against the current seed and records differing files as
`adopted-modified`; `statusOf` treats that status as sticky `modified`, so such files always
route to review, never to auto-apply.

**Files** — `scripts/lib/lineage.mjs`, `scripts/lineage.mjs`

**How to verify** — adopt an app whose seed file carries an edit, upgrade with a changed seed:
the edit must survive and an incoming copy must appear. `fixtures/diverged` pins this; the
injected-defect run in TEST_SUMMARY.md shows the audit going red without the fix.

**Recurrence risk** — any status collapse where two histories share one label. The scaffolder
writes seed-identical files, so it cannot exhibit this; stated, not assumed.

**Prevention** — rung: `scripts/conformance.mjs` (diverged checks) + `scripts/upgrade.test.sh`.

**Process check** — **Yes and no.** The upgrade test suite existed and passed — but only
exercised scaffolder-born apps, never adopted ones. The fixture existed precisely to cover the
adoption path, and it fired on first run. The process worked as designed; the lesson (a test
suite covers the paths it was written from) is already FP'd under "a passing check proves only
what it looked at".

---

## RC-004 — The gate runner reported a missing tool as FAIL
**Date:** 28-Aug-2026 · **Severity:** S3 · **Modules:** gate runner

**Symptom** — On a machine where the type-checker could not be installed, the gate reported
`VERDICT: FAIL` with an npm registry error pasted into the report, as though the code were broken.

**Root cause** — `run()` classified any non-zero exit as FAIL, and only a literal `ENOENT`
launch failure as BLOCKED. A tool that launches successfully and then fails to *fetch itself*
exits non-zero like any other failure, so "this machine cannot check your code" was
indistinguishable from "your code is wrong".

**Fix** — An `UNAVAILABLE` signature list (registry errors, missing modules, unresolvable
executables, missing scripts) classifies those outputs as **BLOCKED** with the tool named.

**Files** — `scripts/gate-runner.mjs`

**How to verify** — Run the gate with a dependency uninstalled. The step must read
`BLOCKED - tooling unavailable`, the verdict must be `BLOCKED`, and the exit code must be 3.

**Recurrence risk** — Any step shelling out to an installed tool. All nine steps share `run()`,
so the fix is at the shared boundary and covers every one.

**Prevention** — The three-valued contract now has a written rule in both directions: a missing
tool is never FAIL *and* never PASS. `rung: scripts/gate-runner.mjs` (the `unavailable()`
classifier); prose in [docs/16](../16-TESTING-AND-VALIDATION.md) §2.

**Process check** — **Yes.** The framework's own principle — "fail open on tooling, block only
on evidence" — was documented for the ratchets and not applied to the runner. Corrected in
[docs/17](../17-ENFORCEMENT-RATCHETS.md) §4, which now states the rule applies to every gate.

---

## RC-003 — The rule-coverage audit was blind to `.tsx` references
**Date:** 28-Aug-2026 · **Severity:** S2 · **Modules:** rule-coverage audit

**Symptom** — Ten canonical-pattern rows were reported as `PROSE-ONLY` — declared, accepted debt
— when in fact each named a component file that **did not exist**. The audit under-reported the
exact defect class it exists to find.

**Root cause** — The rung pattern matched `.spec.ts|.test.ts|.mjs|.py|.sh|.ts` only. A rule
pointing at `src/components/Dialog.tsx` therefore matched nothing, and "no rung found" was
reported as the benign outcome rather than the unverified claim it was.

**Fix** — Extended the pattern to `.tsx|.jsx|.json|.css`. Eight rows immediately reclassified as
`DEAD-RUNG`; all eight were then repaired by creating the referenced files.

**Files** — `scripts/audits/check-rule-coverage.mjs`, `docs/registers/CANONICAL_PATTERNS.md`,
eight new files under `starter/src/`.

**How to verify** — `node scripts/audits/check-rule-coverage.mjs --report` reports
`dead/dupe: 0` and `prose only: 0`. Add a row citing a non-existent `.tsx` file; it must appear
as `DEAD-RUNG`.

**Recurrence risk** — Any file type a future rule might cite. The pattern is now one list in one
place.

**Prevention** — `rung: scripts/audits/check-rule-coverage.mjs`, ratcheted.

**Process check** — **Yes.** A detector's own coverage is a coverage question, and nothing was
asking it. This is the general form of *"a passing check proves only what it looked at"*
([docs/09](../09-CODE-QUALITY.md) D-3) applied to the detector itself.

---

## RC-002 — The documentation guard was live but vacuous
**Date:** 28-Aug-2026 · **Severity:** S2 · **Modules:** commit guards

**Symptom** — The guard reachability test expected guard G5 to block a commit that touched
application code with no documentation. It passed the commit instead.

**Root cause** — G5 accepted **any** `.md` file as documentation, and `TEST_SUMMARY.md` is a
`.md` file written by the gate runner. Since G2 already requires a gate run, every compliant
commit staged `TEST_SUMMARY.md` — and satisfied the documentation guard for free. The guard was
reachable, executing, and could never fire.

**Fix** — G5 now excludes `TEST_SUMMARY.md`. It is a gate **artifact**, not a description of
behaviour.

**Files** — `scripts/hooks/pre-commit-guard.sh`

**How to verify** — `bash scripts/hooks/guard-reachability.test.sh` — the case
*"the LAST guard still fires"* must return exit 2, and *"a real doc satisfies it"* exit 0.

**Recurrence risk** — Any guard whose condition can be satisfied by an artifact another guard
already requires. Guards are ordered, so a later guard must never accept an earlier guard's output.

**Prevention** — `rung: scripts/hooks/guard-reachability.test.sh`, which executes each guard
against a scratch repository.

**Process check** — **Yes.** A guard that cannot fire is worse than an absent one: it reports
coverage. Only executing it revealed this — a source scan would have shown a correct-looking
guard. Recorded in [docs/17](../17-ENFORCEMENT-RATCHETS.md) §5.

---

## RC-001 — A reachability test asserted on the wrong guard
**Date:** 28-Aug-2026 · **Severity:** S3 · **Modules:** guard tests

**Symptom** — The case *"G1's escape token releases it"* failed: the commit was still blocked.

**Root cause** — The scratch repository satisfied G1's escape token but not G2's precondition, so
the blocking exit came from **G2**. The test's assertion could not distinguish which guard
produced the exit code, so a green result would have proven nothing about G1.

**Fix** — The scratch repository now satisfies every downstream guard's precondition, so a pass
can only come from the token under test.

**Files** — `scripts/hooks/guard-reachability.test.sh`

**How to verify** — Remove the `CASES-NA:` token from that case; it must fail. Restore it; it
must pass.

**Recurrence risk** — Every test of one item in an ordered chain. The pattern: isolate the item
under test by satisfying everything else.

**Prevention** — Prose: *"assert on the RESULT, not the precondition"*
([docs/09](../09-CODE-QUALITY.md) D-8), plus a comment at the case itself.

**Process check** — **No.** The test found the defect on its first run, which is the outcome the
test was written for. The process worked.
