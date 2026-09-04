# 13 — Contrast and Accessibility

> Contrast is not a polish item. **An element the user cannot read does not exist**, and it
> fails silently — no error, no red test, no crash report. Only a measurement finds it.

---

## 1. The minima

| Content | Minimum | Notes |
|---|---|---|
| Body text | **4.5:1** | Anything under 18pt / 14pt bold |
| Large text | **3:1** | 18pt+ or 14pt+ bold |
| UI components | **3:1** | Input borders, checkboxes, toggles, chart series, meaningful icons |
| Focus indicator | **3:1** | Against **every** adjacent surface, not just the page background |
| Disabled controls | exempt | Formally exempt. Keep them above 3:1 anyway — "disabled" and "invisible" are different messages |
| Purely decorative | exempt | It must be genuinely decorative: remove it and nothing is lost |

These are WCAG 2.2 AA. They are the floor, not the target.

---

## 2. Three gates, because one is not enough

Each gate sees a class of defect the others structurally cannot.

### Gate 1 — token contrast (`scripts/check-contrast.mjs`)
Computes the ratio for every declared pair, in every theme, from the token values.

**Proves:** the palette is safe. Every combination you declared is readable.
**Cannot prove:** that any element actually used the palette.

Runs in milliseconds with no browser, so it runs on every commit.

### Gate 2 — no hard-coded colours (`scripts/audits/check-hardcoded-colors.mjs`)
Blocks any colour literal outside the token file.

**This is the gate that catches the worst class**, and it is the one people skip.

The defect: a component styled with a colour copied from another project — a light-theme grey
like `#111827` — rendered onto a dark surface. That text is not low contrast. It is
**invisible**, indistinguishable from an element that failed to render.

No amount of token tuning reaches it, because it never read a token. And Gate 3 cannot see it
either unless someone remembered to write a case for that exact element. Only this gate can
find it *by construction*.

> **Corollary:** grep is not a substitute for a contrast check. An element with **no** explicit
> colour has no literal to match, and inheriting the wrong colour is the same defect.

### Gate 3 — computed contrast at runtime (`tests/render/contrast.render.spec.ts`)
Reads the colour the **browser** computed, walks up the DOM to find the real painted
background, and measures.

**Proves:** what a user actually sees.
**Requires:** a case per element per state — so it is the most expensive gate, and the one that
must be scoped to what a change touches.

**Seed every state.** The classic escape is a state QA never had data for: the "fully paid"
badge, the zero-results summary, the error banner that only renders after a specific failure.
Contrast defects hide in the states nobody generated.

---

## 3. The eight failures this catches

Each of these has shipped, in real applications, past visual review:

1. **The imported palette.** A component brings light-theme greys onto a dark surface. Invisible.
2. **The brand colour as text.** A mid-tone brand colour is fine as a large fill and fails as
   14px text on the same surface. Purple on near-black is the canonical case.
3. **The unstyled element.** No explicit colour, so it inherits — correct on one surface,
   invisible on another.
4. **The nested surface.** Text passes on `background` and fails on `surfaceRaised` two levels
   in. Nobody declared that pair.
5. **The state nobody seeded.** Contrast is fine in the states with test data and broken in the
   one that only appears after a specific transition.
6. **The disabled-looking enabled control.** Contrast so low that a live control reads as
   disabled and nobody clicks it.
7. **The focus ring on the wrong surface.** 3:1 against the page, invisible against the modal
   it actually appears on.
8. **The logo.** Dark artwork on a dark header. Not a colour in any stylesheet, so no CSS gate
   can see it — see [14](./14-LOGO-AND-IMAGE-ASSETS.md).

---

## 4. Accessibility beyond contrast

### Never colour alone
A red dot means nothing to roughly 1 in 12 men. Every status carries a **second channel** — a
word, an icon, or a shape:

```html
<!-- wrong -->  <span class="dot dot--error"></span>
<!-- right -->  <span class="dot dot--error" aria-hidden="true"></span><span>Overdue</span>
```

### Focus is never removed, only restyled
`outline: none` without a replacement makes an application unusable by keyboard. The generated
CSS ships a `:focus-visible` rule using `--border-focus`; deleting it needs a written reason.

Focus order follows visual order. On opening a dialog, focus moves to its first field; on
closing, it returns to the control that opened it. Focus is a **computable** property, so it is
automated by definition — never an eyeball check.

### Keyboard parity
The whole application is operable with the keyboard alone — every core workflow completable
end to end, same outcomes as with a mouse. The contract:

- **Tab reaches every interactive element**, in visual and functional order; **Shift+Tab**
  walks backward as cleanly. No trap anywhere except an open dialog, which traps *by design*
  and releases on close.
- **Enter activates** the focused button or action; a valid form submits on Enter.
- **Space selects** a focused tab-style control or toggle.

The cheap way to get all of this right is to never build a control out of a `div`: a native
`button` is focusable, announces its role, and activates on both Enter and Space **for free**,
while every hand-rolled substitute must re-earn each of those separately and usually loses one
(CP-22). A keyboard gap is invisible on every mouse-driven happy-path run, which is why the
design dry run and the test suite each make one full pass keyboard-only rather than trusting
per-element checks.

### Touch targets
44 × 44 CSS pixels minimum, including padding. Available as `--layout-min-touch-target`.

### Names, roles, states
Every interactive element has an accessible **name** (what a user would call it), the right
**role** (a `div` with a click handler is not a button), and its **state** exposed
(`aria-checked`, `aria-expanded`, `aria-disabled`) — not implied by colour.

### Motion
Everything respects `prefers-reduced-motion`. **Reduced motion collapses to the END state** —
it never cancels a transition mid-flight, leaving a half-open panel. And motion never gates
interactivity: a control is usable the instant it is on screen, not when its animation finishes.

### Zoom and reflow
Usable at 200% zoom and at 320 CSS pixels wide, with **no horizontal scrolling of the page
body**. Wide content — tables, diagrams, code — scrolls inside its own container.

---

## 5. Rules

| # | Rule | Enforced by |
|---|---|---|
| A-1 | Every declared token pair meets its minimum, in both themes. | `check-contrast.mjs` (build-blocking) |
| A-2 | No colour literal outside the token file. | `check-hardcoded-colors.mjs` (ratcheted) |
| A-3 | Text a change touches is asserted by **computed** contrast, both themes, every state. | `contrast.render.spec.ts` |
| A-4 | Status is never colour alone. | `SCREEN_CHECKLIST.md`, review |
| A-5 | A visible focus indicator, ≥3:1 against every adjacent surface. | Generated CSS + review |
| A-6 | Touch targets ≥ 44px. | `SCREEN_CHECKLIST.md` |
| A-7 | Every interactive element has an accessible name, role and state. | Review; `check-testid-coverage.mjs` covers addressability only |
| A-8 | `prefers-reduced-motion` collapses to the end state. | Generated CSS + review |
| A-9 | No horizontal page scroll at 320px or 200% zoom. | Responsive test matrix (geometry cases are automated) |
| A-10 | Every core workflow is completable keyboard-only: Tab reaches in visual order, Enter activates, Space selects tab-style controls, no trap in either direction. | `starter/tests/functional/keyboard.functional.spec.ts` (the reference shape) + `ACCESSIBILITY_CHECKLIST.md` |

Items marked "review" are honest debt: they are not syntactically decidable today.
`scripts/audits/check-rule-coverage.mjs` counts them, and the count is ratcheted downward.
Saying which rules are *not* mechanically enforced is the difference between a process and a
poster.
