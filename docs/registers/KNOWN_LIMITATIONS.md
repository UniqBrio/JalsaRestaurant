# Known Limitations

> Things the **platform** prevents, distinguished from things that are broken.
>
> Consulted at **design time** (do not design a flow on an unavailable capability) and at **test
> time** (a matching case is skipped with its ID, never failed).

---

## Two rules that keep this register trustworthy

**1. An entry requires a reference proving the platform blocks it.**
No reference, no entry. Without this rule the register fills with bugs misfiled as limitations,
and then the real entries stop being believed — which is worse than having no register.

**2. Nothing is hard-deleted.**
A resolved limitation moves to the resolved section, dated, with what resolved it. Old
screenshots, old support answers and old test cases still refer to it.

---

## Active

| ID | Platform | Capability | Why it cannot work | Reference | What we tell the user | Fallback | Affected modules |
|---|---|---|---|---|---|---|---|
| _KL-001_ | _e.g. iOS Safari_ | _e.g. contact picker_ | _one sentence_ | _link to platform docs / MDN / caniuse_ | _the support answer, in plain language_ | _what the user does instead_ | _list_ |
| KL-002 | iOS / iPadOS Safari | Install prompt (`beforeinstallprompt`) | Safari implements no `beforeinstallprompt` event, so a web app cannot offer its own install button there. Installation is only ever user-initiated, through Share → Add to Home Screen. | [MDN: BeforeInstallPromptEvent — browser compatibility](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent#browser_compatibility) | "On iPhone and iPad, tap Share and then Add to Home Screen." | The app is fully installable on iOS by that route, and `apple-mobile-web-app-capable` in the layout gives it a standalone window once added. `installState` returns `unsupported`, so no button is drawn that could not work. | CP-30 · `src/lib/pwa.ts` · `src/components/PwaProvider.tsx` |
| KL-003 | iOS / iPadOS Safari | SVG launcher icon | Safari does not render an SVG from the manifest's `icons` for the home screen; it reads `apple-touch-icon` and wants a raster image. A vector-only icon set therefore produces a blank or default home-screen icon. | [MDN: Web app manifest — icons](https://developer.mozilla.org/en-US/docs/Web/Manifest/icons) | Nothing — the user sees a correct icon. | The framework generates maskable PNGs (`scripts/lib/png.mjs`) alongside the SVG and points `apple-touch-icon` at the 192px raster. Gate **G12** fails an icon set with no maskable PNG, so this cannot regress silently. | CP-30 · `scripts/theme-build.mjs` · `src/app/layout.tsx` |
| KL-004 | All browsers | Service worker over `file://` or plain HTTP | Service workers require a secure context. Opening the built app from the filesystem, or serving it over http from anything but localhost, registers no worker — so nothing is installable or offline-capable there. | [MDN: Using Service Workers — secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) | "Open the app at its https address rather than from a file." | `shouldRegister()` declines rather than registering and failing, so the app works normally with no worker and no console noise. Localhost over http IS a secure context, so local development is unaffected. | CP-30 · `src/lib/pwa.ts` |

## Resolved / expired

| ID | Resolved | Date | Notes |
|---|---|---|---|

---

## Maintenance triggers

1. **Discovered during build** → add the entry immediately, with its reference and the
   customer-facing answer. A limitation found and not recorded will be rediscovered, expensively.
2. **A workaround fully resolves it** → move to Resolved, dated, with what resolved it.
   A *partial* workaround edits the row and keeps it Active.
3. **A change removes or alters an affected module** → update the affected-modules column.
   An entry with zero remaining modules is retired to Resolved ("feature removed", dated).
4. **A matching test unexpectedly PASSES** → flag the entry "VERIFY — possibly expired".
   **Never retire it mid-run**; the periodic review owns retirement, with fresh research.
5. **Periodic review** — before each release, or monthly: re-verify every active entry. Platforms
   ship. A limitation from two years ago is often no longer true, and a stale entry silently
   removes a capability from your product.

---

## External dependency directory

The status pages checked **first** for any "it was working yesterday" failure, before any code
theory is entertained. An active incident matching the failure signature is not an application
bug.

| Dependency | Status page |
|---|---|
| _Database / backend host_ | |
| _Hosting platform_ | |
| _Identity provider_ | |
| _Messaging provider_ | |
| _Source control / CI_ | |
