# 11 — Theme and Colour System

> **The rule, in one line: there is exactly one file in the application that contains a colour,
> and it is `design/tokens.json`.**

---

## 1. Why colour needs a system at all

Colour looks like the least structural thing in an application, which is exactly why it decays
first. The decay has a predictable shape:

1. A component needs a grey. Someone types `#6B7280`.
2. Another component needs "the same" grey. Someone types `#6b7280` — or `#6C7280`.
3. A dark theme arrives. Both greys are now invisible on the new surface, and neither can be
   fixed centrally, because neither was ever central.
4. A rebrand arrives. It is now a find-and-replace across hundreds of files, and it is wrong.

The end state is a codebase where "change the primary colour" is a two-week project, and where
nobody can answer "is this text readable in dark mode?" without opening the app and looking.

**The system exists so that colour is a configuration value, not a code value.**

---

## 2. The pipeline

```
  design/tokens.json          ← the ONLY hand-edited file. One source of truth.
          │
          ├── scripts/theme-build.mjs
          │        ├──→ src/theme/tokens.generated.css   CSS custom properties
          │        └──→ src/theme/tokens.generated.ts    typed names + values
          │
          ├── scripts/check-contrast.mjs        every declared pair, every theme
          ├── scripts/check-theme-assets.mjs    a real file per theme, per asset
          └── scripts/audits/check-hardcoded-colors.mjs   nothing bypassed the system
```

Generated files are **never hand-edited**. `theme-build.mjs --check` fails the build when they
drift, and a commit guard blocks the commit — because a hand-edited generated file silently
means the token source is no longer the source of truth.

---

## 3. Token layers

### Layer 1 — brand
Two to four values. This is what changes when the company rebrands.

```json
"brand": {
  "primary":   { "light": "#4F46E5", "dark": "#818CF8" },
  "secondary": { "light": "#0F766E", "dark": "#5EEAD4" },
  "accent":    { "light": "#B45309", "dark": "#F59E0B" }
}
```

### Layer 2 — semantic
**The only layer application code may reference.** Every token names a ROLE and carries a value
per theme.

```json
"text.body": { "light": "#1F2430", "dark": "#E6EAF2", "role": "Default body copy" }
```

### The naming rule that makes the whole thing work

> **Name the role, never the appearance.**

| Wrong | Right | Why |
|---|---|---|
| `grey600` | `text.muted` | In dark mode `grey600` must become light, and its own name now lies. |
| `blue` | `info` | The brand changes to green; every "blue" is now a rename or a lie. |
| `darkBg` | `surface` | In light mode this is the *light* surface. |
| `orangeText` | `accent` | Ties a hundred call sites to one hue. |

A name that describes appearance is a name that becomes false the moment a theme changes — and
a false name is worse than no name, because people trust it.

### The `on*` convention
For every fillable surface there is a token for what goes **on** it: `primary` / `onPrimary`,
`error` / `onError`, `errorSurface` / `onErrorSurface`.

This is the mechanism that makes contrast checkable. Every `on*`/surface pair is a declared
contrast assertion, so "is white readable on the primary button?" becomes a build step instead
of a judgement call.

### Layer 3 — scales
Spacing, radius, typography, motion, elevation, layout. Same principle: a magic number typed
into a component is a value that cannot be changed, audited, or kept consistent.

---

## 4. How code consumes tokens

**In CSS — the default, and by far the best option:**

```css
.card {
  background: var(--surface);
  color: var(--text-body);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
}
```

A theme switch is then one attribute change on `<html>`. No re-render, no component that forgot
to subscribe, and no way to accidentally style one element off-theme.

**In TypeScript, when a real value is genuinely required** — canvas, chart libraries,
`<meta name="theme-color">`, native platforms:

```ts
import { v, themeValues } from '@/theme/tokens.generated';

const style = { color: v('text.body') };          // prefer this: a var() reference
const chart = themeValues[resolved]['text.body'];  // only when a literal is unavoidable
```

**Never:**

```ts
const style = { color: '#1F2430' };   // blocked by scripts/audits/check-hardcoded-colors.mjs
```

---

## 5. Adding a colour

Adding a *shade* is almost always the wrong instinct. Adding a **role** is the right one.

1. Ask what this colour MEANS. If you cannot name the meaning, you want an existing token.
2. Add the semantic entry to `design/tokens.json` with `light`, `dark` and a `role` sentence.
3. Add its contrast pairs to `contrastPolicy.pairs` — every surface it can render on.
4. `npm run theme:build && npm run theme:contrast`.
5. If contrast fails, the tool prints the nearest passing shade. If no shade of that hue passes,
   change the **role assignment**, not the shade — that is the design telling you the colour is
   doing a job it cannot do.

---

## 6. Rebranding an application

The whole point of the system:

```bash
# 1. edit brand.* and any semantic tokens that follow it  (usually 2-6 lines)
$EDITOR starter/design/tokens.json

# 2. regenerate
npm run theme:build

# 3. prove it is still readable, in both themes, everywhere
npm run theme:contrast

# 4. prove the logo still works on the new surfaces
npm run theme:assets
```

Four commands. No application code changes. Step 3 is the reason this is safe: a rebrand that
quietly breaks contrast on six screens is the normal outcome without it.

---

## 7. Rules

| # | Rule | Enforced by |
|---|---|---|
| T-1 | No colour literal outside `design/tokens.json`. | `scripts/audits/check-hardcoded-colors.mjs` |
| T-2 | Every semantic token has a light AND a dark value. | `scripts/theme-build.mjs` (a missing value is a build error) |
| T-3 | Tokens name roles, never appearance. | Review — `checklists/CODE_REVIEW_CHECKLIST.md` |
| T-4 | Generated files are never hand-edited. | `theme-build.mjs --check`, guard G4 |
| T-5 | Every reachable fg/bg combination is a declared pair. | `scripts/check-contrast.mjs` + review |
| T-6 | A new colour is a new ROLE, never a new shade of an existing one. | Review |
| T-7 | Status is never conveyed by colour alone. | [13](./13-CONTRAST-AND-ACCESSIBILITY.md) |
