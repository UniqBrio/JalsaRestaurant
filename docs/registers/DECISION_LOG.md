# Decision Log

> Index of architecture decision records in `docs/decisions/`.
>
> Anything expensive to reverse gets a record. Template:
> [templates/docs/ADR.md](../../templates/docs/ADR.md).

| # | Decision | Status | Date | Supersedes |
|---|---|---|---|---|
| 001 | _e.g. Use row-level security for tenant isolation_ | Accepted | | |
| 002 | PWA support is a DEFAULT of every generated application, not a customizer option | Accepted (10-Sep-2026) | Owner direction: every application generated through the SDLC must be installable and launchable standalone with no additional manual configuration. The prior position — `COMPONENT_LIBRARY.md` Install row, "an option in the customizer, never a silent default" — is superseded. The caution behind it was about not imposing behaviour on a USER, and that is kept: the app is installable, but nothing installs itself, the install offer is made once and the answer remembered, and a waiting update is announced rather than applied. | **Options rejected.** (a) *Leave it a customizer flag* — a flag defaulting to off is a feature most apps never get, and the point of a baseline concern is that nobody rebuilds or forgets it. (b) *Ship a hand-written manifest* — `theme_color` and `background_color` are colour decisions, and a second home for colour is the drift the token file exists to prevent; generated, a rebrand reaches the installed window. (c) *Commit the launcher icons as binaries* — that makes the icon the one brand asset that does not follow the tokens. (d) *Add a rasteriser dependency* — a native-compiled package in the path of every scaffold, for two flat images; `scripts/lib/png.mjs` is 40 lines of built-in zlib instead. (e) *Cache-first HTML for speed* — it pins users to a version that no longer exists, and the worker that decides whether to fetch the fix is the broken one. |

| 003 | CI runs the framework's own self-tests on a SECOND path namespace, but does not mirror the full gate there | Accepted (11-Sep-2026) | RC-012: three guard suites reported twelve failing assertions about code that was entirely correct, because a path crossing from the shell into JavaScript source is data and nothing translates it. On Linux the shell's path namespace and the interpreter's agree, so the entire class is invisible to an ubuntu-only CI — which would have stayed green through all twelve, indefinitely. A second job, `self-tests-windows`, runs `audit:all` and `guard:test` on `windows-latest` with `shell: bash`. It installs no browsers and runs no application gate. | **Options rejected.** (a) *An OS matrix over the existing `gate` job* — the honest-looking choice, and it roughly doubles CI time and cost to re-prove on Windows what ubuntu already proved about the APP's toolchain, which is not where this class lives. A CI run people resent is a CI run people route around. (b) *Leave it to whoever runs `guard:test` locally* — that is precisely the arrangement that let RC-012 exist; it was found by hand, on the one machine that could see it. (c) *Fix the three suites and call the class closed* — the sweep added in v1.34.0 found a fourth site that was **not** failing, so "no red tests" was never evidence of absence. (d) *macOS as the second namespace* — it is POSIX, so it agrees with ubuntu on exactly the axis in question and would have caught nothing. |

Status: `Proposed` · `Accepted` · `Superseded by NNN` · `Deprecated`

---

**Superseded records are never deleted.** The reasoning that was correct in 2026 explains why
the system is shaped as it is, and a reader who cannot find it will assume the shape was an
accident.

**The most valuable section of any record is "options rejected".** Six months from now, someone
will propose one of them again — and the reason it lost is the sentence that saves the
conversation.
