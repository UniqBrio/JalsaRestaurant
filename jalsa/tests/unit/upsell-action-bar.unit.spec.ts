/**
 * The shape of the "One last thing?" action bar, read out of the source that ships it.
 *
 * WHY A SOURCE PARSE AND NOT ONLY A RENDER MEASUREMENT
 *   `tests/render/guest-upsell-bar.render.spec.ts` proves that a column of two buttons fits at
 *   thirteen widths. What it cannot prove is that the bar in `GuestClosure.tsx` IS that column:
 *   it builds its own DOM from `ACTION_BAR_STACK` and two pinned labels, so a screen that
 *   nested a `flex` row back inside the bar would leave that suite green. The row is precisely
 *   what went wrong here — the container was already `flex-col`, and the overflow came from a
 *   CHILD that was a row. A container class cannot state a rule about its children. This file
 *   states it.
 *
 * WHY IT ALSO CHECKS THE ROUTE ON
 *   Both removed buttons ran the identical `go('tip')`, and with both gone the tip button is
 *   the only control on this screen that leads anywhere near payment. If it ever loses that
 *   handler, the screen becomes a dead end with a full bill on it — Standard 1.6, and the
 *   single most expensive way this change could be got wrong.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026, run against the pre-fix tree — `git checkout` of
 * `GuestClosure.tsx`, so the three-button bar exactly as it shipped):
 *   OBSERVED FAILING — **5 failed, 1 passed** of 6.
 *     · two buttons in order → `['guest-upsell-pay', 'guest-upsell-continue-ordering',
 *       'guest-upsell-skip']`
 *     · no horizontal row → `no nested flex row inside the bar`
 *     · the two labels → `expect(received).toContain('Continue ordering')`
 *     · the route on → `the tip button must exist · expected > -1`
 *     · removed means removed → `"No thanks, continue to payment" was removed`
 *
 *   THE ONE THAT PASSED IS NOT A GAP AND IS RECORDED AS SUCH: `the primary button still pauses
 *   the payment request` passed before the change and passes after it, because the
 *   `resume-ordering` write is the thing the request's MUST NOT CHANGE line protects. It is a
 *   regression guard, not a proof of the defect, and a rung that cannot fail on the pre-fix tree
 *   for that reason is the honest kind — NOT OBSERVED FAILING: it guards behaviour the change
 *   deliberately left alone.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SOURCE = 'src/features/guest/GuestClosure.tsx';
const source = readFileSync(SOURCE, 'utf8');

/**
 * The file with its commentary removed.
 *
 * WHY THIS EXISTS, AND IT IS NOT A LOOPHOLE
 *   The "removed means removed" test below went red on its first run against the FIXED tree,
 *   because the comment explaining why "No thanks, continue to payment" was removed quotes the
 *   string it is explaining. A detector that cannot tell a shipped label from a note about a
 *   shipped label would be satisfied by silently deleting the explanation, which is the wrong
 *   thing to make cheap. So the question is asked of the CODE: block comments (which is what a
 *   JSX `{/* ... *\/}` is) and whole-line `//` comments come out first.
 *
 *   It removes nothing else. A label that moved into a variable, a conditional or another
 *   component is still in this text and still fails the test.
 */
function codeOnly(): string {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
  // A strip that consumed the file would pass every `not.toContain` below by having nothing
  // left to find. BLOCKED, not green: the parse must have produced something.
  expect(stripped.length, 'stripping comments must leave the code behind').toBeGreaterThan(
    source.length / 3
  );
  expect(stripped, 'the stripped text is still the closure screens').toContain('export function UpsellScreen');
  return stripped;
}

/**
 * The bar's JSX, from its opening tag to its closing one.
 *
 * Deliberately NOT a regex over the whole file: a match that spans the wrong braces reads as a
 * pass, and the assertions below would then be about some other bar. The slice is taken by
 * index between two literal tags that appear once each, and its emptiness is itself asserted
 * against — a parse that found nothing must report that, never success.
 */
function upsellBar(): string {
  const open = source.indexOf('<ActionBar testId="guest-upsell-bar">');
  expect(open, `${SOURCE} must still contain the guest-upsell-bar ActionBar`).toBeGreaterThan(-1);
  const close = source.indexOf('</ActionBar>', open);
  expect(close, 'the guest-upsell-bar ActionBar must be closed').toBeGreaterThan(open);
  const slice = source.slice(open, close);
  expect(slice.length, 'the parsed bar must not be empty').toBeGreaterThan(50);
  return slice;
}

test('the bar holds exactly two buttons, in the order the requester fixed', () => {
  const bar = upsellBar();
  const ids = [...bar.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
  expect(ids).toEqual(['guest-upsell-continue-ordering', 'guest-upsell-tip']);
  expect((bar.match(/<Button\b/g) ?? []).length, 'two buttons, no more').toBe(2);
});

test('no element inside the bar is a horizontal row', () => {
  const bar = upsellBar();
  // The exact shapes that produced the overflow: a flex row, and a child told to take the
  // remaining width of one. Either one re-nested is the defect returning.
  expect(bar, 'no nested flex row inside the bar').not.toMatch(/className="[^"]*\bflex items-/);
  expect(bar, 'no flex-row child inside the bar').not.toMatch(/className="[^"]*\bflex-row\b/);
  expect(bar, 'no flex-1 child inside the bar').not.toMatch(/\bflex-1\b/);
});

test('the two labels are the ones the render spec measures', () => {
  // The render spec pins these strings because JSX text has no value to import. This is the
  // assertion that keeps the pin honest.
  const bar = upsellBar();
  expect(bar).toContain('Continue ordering');
  expect(bar).toContain('Add a tip');
});

test('the tip button still carries the route on to the tip step', () => {
  const bar = upsellBar();
  const tipAt = bar.indexOf('data-testid="guest-upsell-tip"');
  expect(tipAt, 'the tip button must exist').toBeGreaterThan(-1);
  // Its own props, not the button above it: the slice runs from its testid to the end of the bar.
  expect(bar.slice(tipAt), 'the tip button must still go to the tip step').toContain("go('tip')");
});

test('the two removed controls are gone from the whole file, not just hidden', () => {
  // A button left in the tree behind a condition is a string the copy gate still owns and a
  // control a runner can still find. Removed means removed.
  const code = codeOnly();
  expect(code, '"No thanks, continue to payment" was removed').not.toContain(
    'No thanks, continue to payment'
  );
  expect(code, 'the guest-upsell-pay button was removed').not.toContain('guest-upsell-pay');
  // The tip screen's OWN pay button is a different control on a different screen and stays.
  expect(code, "the tip screen's Pay button is untouched").toContain('data-testid="guest-pay"');
});

test('the primary button still pauses the payment request before returning to the menu', () => {
  // The label moved and the weight moved; the write did not. A "Continue ordering" that does
  // not post `resume-ordering` leaves the bill in payment_requested while the guest orders.
  const bar = upsellBar();
  expect(bar).toContain("action: 'resume-ordering'");
  expect(bar).toContain("go('menu')");
});
