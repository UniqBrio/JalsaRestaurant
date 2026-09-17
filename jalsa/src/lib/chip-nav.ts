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
