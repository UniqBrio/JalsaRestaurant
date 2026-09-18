/**
 * chip-nav — the layout contract for a row of Chips that is a NAVIGATION, not a filter strip.
 *
 * WHY A CONSTANT AND NOT A CLASS STRING TYPED INTO THE COMPONENT
 *   The render spec for this has to measure what SHIPS. A test carrying its own copy of the
 *   class string measures the copy: the component could drift to `flex-nowrap` tomorrow and the
 *   suite would stay green, having proved only that the string in the test still wraps. One
 *   exported value, imported by both, makes that drift impossible to hide.
 *
 *   It is deliberately NOT a component. `Chip` already carries everything a chip needs
 *   (`shrink-0`, `whitespace-nowrap`, `min-h-11`); what was missing was one property on its
 *   CONTAINER, and wrapping a one-line container in a React component would be a new visual
 *   primitive where a layout decision belongs.
 *
 * THE DISTINCTION THIS ENCODES
 *   A FILTER strip may scroll sideways: every option is the same kind of thing, the row is
 *   read left-to-right, and missing the tail costs a narrower view of a list that is still on
 *   the screen. `ChipRow` in `components/ui/atoms.tsx` is that, and it carries the design set's
 *   right-edge fade so the cut is legible.
 *
 *   A NAVIGATION may not. Each chip is a different destination, and a destination nobody can
 *   see is a destination nobody can reach. That is what happened to `Printers & machines`: it
 *   was the tenth item in a `flex` row with no `flex-wrap`, inside `overflow-x: auto`, with the
 *   scrollbar hidden on both engines — present in the DOM, reachable only by a scroll gesture
 *   with no affordance whatsoever suggesting there was anything to scroll to.
 */

/**
 * A chip navigation that shows every destination at every width.
 *
 * `flex-wrap` is the whole fix. `gap-2` applies to BOTH axes once a flex row wraps, so the rows
 * it creates are spaced like the columns without a second token. Nothing here constrains width,
 * hides overflow, shrinks a chip or truncates a label — the row simply gets taller on a narrow
 * screen, which is the correct trade against hiding navigation.
 */
export const CHIP_NAV_WRAP = 'flex flex-wrap gap-2';

/**
 * Pins a chip NAVIGATION beneath the Owner header, from `md` up (Standard 1.2).
 *
 * THE OFFSET, AND WHY IT IS WRITTEN LIKE THAT
 *   `calc(7rem + 1px)` is the Owner header, exactly. The 7rem is its two rows — `py-3` plus
 *   `min-h-11`, then `min-h-11` — so the offset tracks the header under text zoom rather than
 *   drifting away from it. The `+ 1px` is the header's own `border-b`, which does not scale and
 *   which a first attempt forgot, leaving the row tucked a pixel under the border.
 *
 * WHY ONLY FROM `md`
 *   The header is 7rem + 1px at every width from 768px UP, because its identity row only begins
 *   to wrap below that. Below `md` no single offset is correct, and pinning a ten-chip row there
 *   is the wrong trade anyway: measured, it leaves a 320x568 phone 28px of content. So below
 *   `md` the row keeps the behaviour it shipped with.
 *
 * WHY IT LIVES HERE AND NOT IN A CLASS ATTRIBUTE
 *   `settings-sticky-subnav.render.spec.ts` measures the real header and asserts it equals this
 *   offset. A spec carrying its own copy of the string would measure the copy, and the offset
 *   could drift from the header with the suite still green — which is the whole reason
 *   `CHIP_NAV_WRAP` above is a constant too.
 *
 * `-my-2` hands the padding back to the flow, so at rest the row sits exactly where it always
 * did and only its scrolled behaviour changes. `z-20` is below the header's `z-30`, and far
 * below sheets (`z-50`) and toasts (`z-60`).
 */
export const CHIP_NAV_STICKY_MD =
  'md:sticky md:top-[calc(7rem+1px)] md:z-20 md:-my-2 md:bg-[var(--background)] md:py-2';
