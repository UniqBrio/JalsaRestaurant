# 12 — Light and Dark Themes

> Both themes are built from day one. Retrofitting the second theme is not a styling task —
> it is an archaeology project across every file that ever hard-coded a colour.

---

## 1. Three states, not two

The user's preference has **three** values:

| Preference | `data-theme` on `<html>` | What decides the colours |
|---|---|---|
| `light` | `"light"` | The explicit choice |
| `dark` | `"dark"` | The explicit choice |
| `system` *(default)* | **removed** | `prefers-color-scheme` |

A two-state toggle silently destroys "follow my system". Users whose OS switches at sunset
experience that as the app ignoring them — and they are right.

`system` must survive a reload **as itself**, not collapsed into whichever value it resolved to
at the time. That is why the attribute is *removed* rather than set: removing it hands control
back to CSS, which is where the system preference is expressed.

---

## 2. The CSS structure, and why the order is a contract

`scripts/theme-build.mjs` emits exactly this shape:

```css
:root {
  /* LIGHT — always fully defined. */
  --background: #FFFFFF;
  --text-body: #1F2430;
  /* ...every token... */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    /* system preference wins when no explicit choice was made */
    --background: #0D1117;
    --text-body: #E6EAF2;
  }
}

:root[data-theme='dark']  { /* explicit choice beats the system */ }
:root[data-theme='light'] { /* explicit choice beats the system, the OTHER way */ }
```

Three properties this shape guarantees, each of which is a real bug when absent:

1. **Every token always has a value.** A token defined *only* inside a media query is undefined
   whenever that query is false — and an undefined custom property falls back to `inherit` or
   nothing, which renders as black-on-black or invisible.
2. **The system preference is honoured by default**, with no JavaScript and no flash.
3. **An explicit choice wins in both directions.** The `[data-theme='light']` block is not
   redundant: without it, a user who chose light on a dark-mode OS gets dark.

---

## 3. No flash of the wrong theme

A theme applied by React after hydration means every cold load paints the wrong theme first.
On a dark-mode device that is a white flash in a dark room — the most-complained-about
dark-mode defect there is.

The fix is a tiny blocking script in `<head>`, **before** any stylesheet-dependent paint:

```html
<script>
  (function () {
    try {
      var p = localStorage.getItem('app.theme');
      if (p === 'light' || p === 'dark') document.documentElement.setAttribute('data-theme', p);
    } catch (e) {}
  })();
</script>
```

Exported as `themeNoFlashScript` from `src/theme/ThemeProvider.tsx`.

Note what it does *not* do: it never sets the attribute for `system`. That case is already
handled by CSS, correctly, on the first paint.

---

## 4. Storage is best-effort, always

Every read and write of `localStorage` is wrapped in `try/catch`. It throws in private windows,
with site data blocked, in some embedded contexts, and during thumbnail capture. A theme
provider that throws on load is a blank page.

A failed read resolves to `system`, which is the correct default anyway.

---

## 5. Designing for both themes

Dark mode is not "light mode with inverted colours". Four things genuinely differ:

| | Light | Dark |
|---|---|---|
| **Elevation** | Shadows. Raised things get darker edges. | Shadows barely read on dark. Raised things get **lighter surfaces** — hence `surface` → `surfaceRaised`. |
| **Saturation** | Saturated colours read fine. | Highly saturated colours vibrate against dark and cause eye strain. Desaturate and lighten. |
| **Pure extremes** | Pure white background is fine. | Pure black plus pure white text causes halation — text appears to smear. Use near-black and slightly-off-white. |
| **Brand colours** | Often work as-is. | A mid-tone brand colour usually fails contrast on dark and needs a lighter variant. This is why brand tokens are per-theme. |

Note in the default palette: `primary` is `#4F46E5` in light and `#818CF8` in dark — the same
identity, two values, because one value cannot pass on both surfaces.

---

## 6. Testing both themes

Never rely on the test runner's OS preference. A suite that has only ever seen one theme has
only ever tested one theme, and it will report green while half the application is unreadable.

```ts
for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('app.theme', t), theme);
      await page.goto('/');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    });
    // ...
  });
}
```

Every screen checklist run states its result **per theme**. "Both themes checked" without a
per-theme result is a claim, not a check.

---

## 7. Rules

| # | Rule | Enforced by |
|---|---|---|
| D-1 | Three preference states. `system` is the default and persists as itself. | `ThemeProvider`, review |
| D-2 | The light palette is fully defined on bare `:root`. | `theme-build.mjs` output shape |
| D-3 | An explicit choice overrides the system **in both directions**. | `theme-build.mjs` output shape |
| D-4 | A no-flash script runs before first paint. | `checklists/SCREEN_CHECKLIST.md` |
| D-5 | Storage access is wrapped; a failure resolves to `system`. | `ThemeProvider` |
| D-6 | Every screen is verified in both themes before it is called done. | `SCREEN_CHECKLIST.md` item 10 |
| D-7 | Contrast is asserted in both themes and every data state. | `check-contrast.mjs` + `contrast.render.spec.ts` |
