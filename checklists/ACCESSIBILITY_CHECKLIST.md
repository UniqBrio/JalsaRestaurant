# Accessibility Checklist

> WCAG 2.2 AA is the floor, not the target.
> Full reasoning: [docs/13-CONTRAST-AND-ACCESSIBILITY.md](../docs/13-CONTRAST-AND-ACCESSIBILITY.md).

## Contrast
- [ ] Token gate passes: `npm run theme:contrast`.
- [ ] **Computed** contrast asserted for text this change touches — both themes, every data state.
- [ ] No colour literals anywhere: `npm run audit:colors`.
- [ ] Body text ≥ 4.5:1 · large text ≥ 3:1 · UI components and focus ring ≥ 3:1.
- [ ] The focus ring meets 3:1 against **every** surface it can appear on, not just the page.

## Colour is never the only channel
- [ ] Every status carries a word, an icon, or a shape besides its colour.
- [ ] Charts distinguish series by more than hue.
- [ ] Required fields are marked by more than a red border.
- [ ] Errors are announced in text, not implied by colour.

## Keyboard
- [ ] Every interactive element is reachable by Tab.
- [ ] Focus order follows visual order.
- [ ] A visible focus indicator on every focusable element. `outline: none` without a
      replacement makes the application unusable by keyboard.
- [ ] Dialogs trap focus, focus the first field on open, and **return focus** to the opener on
      close.
- [ ] Escape closes a dismissible dialog. No keyboard trap anywhere.

## Screen readers
- [ ] Every interactive element has an accessible **name** — what a user would call it.
- [ ] Correct **role**. A `div` with a click handler is not a button.
- [ ] **State** exposed: `aria-checked`, `aria-expanded`, `aria-disabled` — not implied by colour.
- [ ] Every image has `alt`. Decorative images: `alt=""` **and** `aria-hidden="true"`.
- [ ] A themed image announces once, not twice.
- [ ] Dynamic updates (toasts, results) reach a live region.
- [ ] Form errors are associated with their field.

## Motion and zoom
- [ ] `prefers-reduced-motion` honoured, collapsing to the **end state** — never cancelling
      mid-transition and leaving a half-open panel.
- [ ] Motion never gates interactivity.
- [ ] Usable at 200% zoom and 320px wide, with **no horizontal page scroll**.
- [ ] Wide content scrolls inside its own container.

## Targets
- [ ] Touch targets ≥ 44×44 CSS pixels, including padding.
- [ ] Adjacent targets have enough separation to avoid mistaps.
