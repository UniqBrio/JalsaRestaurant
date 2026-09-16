# `.framework/incoming` — framework v1.35.0, staged for review

**Nothing here is live.** Every file below is a *copy* of the framework's own version, taken
from `<framework>/starter/` at framework **v1.35.0**. Jalsa was scaffolded from **v1.29.0**.
No file under `jalsa/` outside this directory was created, changed or deleted to produce it.

## Why copies and not an upgrade

`node ../scripts/upgrade.mjs --apply` is the designed route, and for `review` files it does
exactly the right thing — writes the incoming copy, never touches yours. For **new** files it
does not, and cannot be told otherwise: its only flags are `--apply` and `--framework`.

Jalsa has no lineage record for a file the v1.29.0 starter did not contain, so the tool reads
it as new and auto-applies it. Five such files already exist here with Jalsa's own content,
and two more would collide by convention:

| Path | What applying it would do |
|---|---|
| `src/app/page.tsx` | replace the Jalsa landing page — badge logo, VF-1, `type-h1` |
| `src/app/layout.tsx` | replace Jalsa's root layout |
| `public/sw.js` | replace Jalsa's service worker |
| `next.config.mjs` | land beside `next.config.ts` — **two Next configs** |
| `eslint.config.js` | land beside `eslint.config.mjs` — **two ESLint configs** |

`upgrade.mjs`'s own header predicts this for *adopted* apps. Jalsa is *scaffolded*, so it takes
the other branch, where "a genuinely new file is a gift, not a collision". That assumption does
not hold here.

Two generated artifacts were deliberately not copied: `next-env.d.ts` and `tsconfig.tsbuildinfo`.

## How to merge one

```bash
diff -u jalsa/<path> jalsa/.framework/incoming/<path>
# merge by hand into jalsa/<path>, then re-record it:
node scripts/lineage.mjs --refresh <path>      # from the jalsa/ root
```

Discarding an incoming file is a real answer. Delete it and nothing changes.

## The 41 staged files

- **pristine** — Jalsa never touched it; the framework changed it. Safe to take wholesale.
- **review** — Jalsa modified it *and* the framework changed it. Merge by hand.
- **new-in-framework** — added after v1.29.0. Check the collision column first.

| File | Category | Already exists in Jalsa? |
|---|---|---|
| `src/lib/module-access.ts` | pristine | **yes — would be overwritten** |
| `tests/unit/module-access.unit.spec.ts` | pristine | **yes — would be overwritten** |
| `eslint.config.js` | new-in-framework | no |
| `next.config.mjs` | new-in-framework | no |
| `public/sw.js` | new-in-framework | **yes — would be overwritten** |
| `src/app/layout.tsx` | new-in-framework | **yes — would be overwritten** |
| `src/app/page.tsx` | new-in-framework | **yes — would be overwritten** |
| `src/components/PwaProvider.tsx` | new-in-framework | no |
| `src/features/items/ItemForm.tsx` | new-in-framework | no |
| `src/features/items/ItemsScreen.tsx` | new-in-framework | no |
| `src/features/items/items.api.ts` | new-in-framework | no |
| `src/features/items/types.ts` | new-in-framework | no |
| `src/lib/pwa.ts` | new-in-framework | no |
| `tests/unit/pwa.unit.spec.ts` | new-in-framework | no |
| `playwright.config.ts` | review | **yes — would be overwritten** |
| `src/components/ConfirmDialog.tsx` | review | **yes — would be overwritten** |
| `src/components/Dialog.tsx` | review | **yes — would be overwritten** |
| `src/components/ModuleAccessPanel.tsx` | review | **yes — would be overwritten** |
| `src/components/TabRow.tsx` | review | **yes — would be overwritten** |
| `src/components/analytics/AnalyticsTable.tsx` | review | **yes — would be overwritten** |
| `src/components/analytics/InsightCard.tsx` | review | **yes — would be overwritten** |
| `src/components/analytics/MetricCard.tsx` | review | **yes — would be overwritten** |
| `src/components/components.css` | review | **yes — would be overwritten** |
| `src/hooks/useAsync.ts` | review | **yes — would be overwritten** |
| `src/hooks/useListControls.ts` | review | **yes — would be overwritten** |
| `src/lib/analytics/metrics.ts` | review | **yes — would be overwritten** |
| `src/lib/api-client.ts` | review | **yes — would be overwritten** |
| `src/lib/audit.ts` | review | **yes — would be overwritten** |
| `src/lib/config.ts` | review | **yes — would be overwritten** |
| `src/lib/list-controls.ts` | review | **yes — would be overwritten** |
| `src/lib/loading.ts` | review | **yes — would be overwritten** |
| `src/lib/logger.ts` | review | **yes — would be overwritten** |
| `src/lib/module-customizer.ts` | review | **yes — would be overwritten** |
| `src/lib/pricing.ts` | review | **yes — would be overwritten** |
| `src/lib/selection.ts` | review | **yes — would be overwritten** |
| `tests/unit/analytics.unit.spec.ts` | review | **yes — would be overwritten** |
| `tests/unit/audit.unit.spec.ts` | review | **yes — would be overwritten** |
| `tests/unit/module-customizer.unit.spec.ts` | review | **yes — would be overwritten** |
| `tests/unit/pricing.unit.spec.ts` | review | **yes — would be overwritten** |
| `tests/unit/undo.unit.spec.ts` | review | **yes — would be overwritten** |
| `tsconfig.json` | review | **yes — would be overwritten** |
## Not staged

Three files Jalsa deleted on purpose are respected and were **not** re-added:
`tests/functional/keyboard.functional.spec.ts` · `tests/functional/reference.functional.spec.ts` ·
`tests/render/contrast.render.spec.ts`.

23 paths are divergent by design and 46 are unchanged; neither needs anything.

Full plan: run `npm run framework:upgrade` from `jalsa/` — it is a dry run by default.
