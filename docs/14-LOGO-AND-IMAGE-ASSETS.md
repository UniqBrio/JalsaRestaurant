# 14 — Logos, Icons and Image Assets

> **A logo is a colour decision that happens to live in a file.**
>
> That is the whole insight. A dark wordmark on a dark header is invisible in exactly the same
> way `#111827` text on `#111111` is invisible — but it appears in no stylesheet, so no colour
> gate can see it. It needs a gate of its own.

---

## 1. The failure

A brand delivers one logo: dark ink, transparent background. It looks correct everywhere
during development, because development happened in light mode.

The app ships dark mode. The header is now near-black. The logo is still dark ink. It renders
as an empty rectangle in the top-left corner of every screen — and it renders that way for
every user who prefers dark mode, which on mobile is most of them.

Nothing fails. No test is red. No error is logged. The application simply has no logo for half
its users, and it stays that way until somebody happens to look.

---

## 2. Assets are declared, not discovered

Every brand mark, icon set and text-bearing image is declared in `design/tokens.json`:

```json
{
  "id": "logo.primary",
  "description": "Full wordmark used in the app header",
  "light": "/brand/logo-light.svg",
  "dark":  "/brand/logo-dark.svg",
  "minContrastAgainst": ["background", "surface"]
}
```

`light` is the artwork drawn **for** the light theme (dark ink). `dark` is drawn **for** the
dark theme (light ink). The name says which theme it belongs to, not what colour it is —
consistent with the token naming rule in [11](./11-THEME-AND-COLOR-SYSTEM.md).

`scripts/check-theme-assets.mjs` then verifies:

1. Both variants are declared.
2. Both files **exist on disk**. A path typo is a missing logo in production.
3. If one file is reused for both themes, `themeIndependent: true` is set **with a reason**.
   "One logo works everywhere" must be a deliberate, measured claim — not an omission.
4. For SVGs, hard-coded fills are reported, so a mark that *cannot* adapt is visible as such.

---

## 3. Four strategies, and when each is right

### A. Two files, one per theme — **the default**
Two exports from the design tool. Zero cleverness, works everywhere, works with JavaScript
disabled, works on the first paint.

```tsx
<ThemedImage id="logo.primary" alt="Acme" width={140} height={32} />
```

Renders both and lets CSS hide one — so the correct mark is on screen on the **first** paint,
in a server-rendered page, before hydration. A JavaScript-swapped logo flashes the wrong mark on
every cold load, which is precisely the moment a brand is being judged.

Only one variant carries the alt text; the other is `aria-hidden`. Otherwise every screen
reader announces the logo twice.

### B. One adaptive SVG using `currentColor`
For simple single-colour marks, replace fills with `currentColor` and inline it:

```svg
<svg viewBox="0 0 120 32" fill="currentColor" role="img" aria-label="Acme">…</svg>
```

Then `color: var(--text-heading)` themes it automatically. Elegant, but only works for
monochrome marks — a multi-colour logo cannot use it.

### C. One mark plus a guaranteed backdrop
Place the logo on a fixed-colour plate (a brand-coloured header bar) that is the same in both
themes. The logo then only ever sits on one background, so one file is genuinely correct.
Legitimate — but say so via `themeIndependent: true`, with the plate colour named in the note.

### D. Theme-independent by nature
Open Graph cards, email headers, PDF letterheads, favicons for browsers with no theme signal.
These render on a canvas you do not control, so they must **not** follow the viewer's theme.
Fix them to one variant, deliberately, and record why.

---

## 4. Photographs, illustrations and images containing text

- **Illustrations** get theme variants like logos. An empty-state illustration with light line
  art disappears on a light surface.
- **Photographs** rarely need variants, but text placed *over* one does. Use a scrim
  (`--overlay`) between the image and the text, and measure the contrast **against the scrim**,
  not against an average of the photo.
- **Images containing text** — a screenshot, a diagram, a chart exported as PNG — are the worst
  case: the text is baked in and cannot adapt at all. Prefer live HTML or an adaptive SVG.
  Where a raster is unavoidable, export one per theme and treat it as a themed asset.
- **Every image has an `alt`.** Decorative images get `alt=""` **and** `aria-hidden="true"` —
  never a missing attribute, which makes a screen reader read the filename aloud.

---

## 5. Favicons and app icons

The browser tab is a surface you do not control, and it has its own theme:

```html
<link rel="icon" href="/brand/favicon-light.svg" media="(prefers-color-scheme: light)">
<link rel="icon" href="/brand/favicon-dark.svg"  media="(prefers-color-scheme: dark)">
<link rel="icon" href="/brand/favicon.ico">            <!-- fallback, must work on both -->
```

The `.ico` fallback is seen by browsers that ignore the media queries, so it must be legible on
both a light and a dark tab strip. That usually means a mark with its own background plate
rather than a transparent one.

Keep the favicon **stable**. Users find a tab by its icon; changing it reads as a different site.

---

## 6. This is a design-stage decision

The asset strategy is decided at **Gate 3**, not discovered during build.

The design specification states, for every brand asset: which strategy, which files are needed,
and which surfaces it must be legible on. That is what makes it a design task with a deliverable
rather than a build-time surprise that gets solved by shipping one file and hoping.

---

## 7. Rules

| # | Rule | Enforced by |
|---|---|---|
| L-1 | Every brand asset is declared in `design/tokens.json`. | `check-theme-assets.mjs` |
| L-2 | Every declared asset has a real file per theme. | `check-theme-assets.mjs` |
| L-3 | Reusing one file for both themes requires `themeIndependent: true` **and a reason**. | `check-theme-assets.mjs` |
| L-4 | Theme switching of assets is **CSS-driven**, never JavaScript-driven. | `ThemedImage`, review |
| L-5 | Only one variant carries the alt text; the other is `aria-hidden`. | `ThemedImage` |
| L-6 | Every image has `alt`; decorative ones get `alt=""` + `aria-hidden`. | Review |
| L-7 | Text over an image sits on a scrim, measured against the scrim. | Review |
| L-8 | The asset strategy is stated in the design, at Gate 3. | `workflows/feature.md` A3.4 |
