/**
 * action-bar — the layout contract for the fixed bar at the bottom of a guest screen.
 *
 * WHY A CONSTANT AND NOT A CLASS STRING TYPED INTO THE COMPONENT
 *   Same reason as `chip-nav.ts`, and the same defect one surface over. A render spec carrying
 *   its own copy of the container class measures the copy: `ActionBar` could drift to a row
 *   tomorrow and the suite would stay green, having proved only that the string in the test
 *   still stacks. One exported value, imported by the component and by the spec, makes that
 *   drift impossible to hide.
 *
 * WHAT `flex-col` BUYS, STATED PLAINLY
 *   A column cannot overflow sideways. Its children stretch to the bar's width by default, so
 *   every button in it is full width at every viewport without one measurement, one breakpoint
 *   or one media query. That is why the bar has always been a column — what it did NOT stop was
 *   a screen nesting a `flex` ROW inside it, which is exactly how the upsell bar came to hold
 *   "＋ Continue Ordering" beside "No thanks, continue to payment": a row whose width was the
 *   sum of its contents, with no wrap rule and nothing to wrap to.
 *
 *   So the rule this constant carries is about the CHILDREN as much as the container: a bar
 *   holds buttons, one per line. `tests/unit/upsell-action-bar.unit.spec.ts` is what enforces
 *   the second half, because no class string can.
 */
export const ACTION_BAR_STACK =
  'fixed inset-x-0 bottom-0 z-30 mx-auto flex flex-col gap-2 border-t border-[var(--border)] ' +
  'bg-[var(--surface)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3';
