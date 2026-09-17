/**
 * The "One last thing?" action bar, measured at every width the responsive audit fixed.
 *
 * WHAT THIS PROVES THAT A CLASS-NAME ASSERTION CANNOT
 *   Whether two buttons fit is a question only a layout engine can answer. So the real bar
 *   markup goes on a page that has loaded the real stylesheet, at the real guest max-width, and
 *   every button's box is measured.
 *
 * WHY THE CONTAINER CLASS COMES FROM `src/lib/action-bar.ts`
 *   A spec carrying its own copy of the container class measures the copy: `ActionBar` could
 *   drift back to a row tomorrow and this suite would stay green, having proved only that the
 *   string in the test still stacks. `ACTION_BAR_STACK` is imported by the component and by
 *   this file, so the drift has nowhere to hide. Same reason, same shape as `CHIP_NAV_WRAP`.
 *
 *   The two LABELS are pinned here rather than imported, because they are JSX text with no
 *   value to import. `tests/unit/upsell-action-bar.unit.spec.ts` is what closes that loop: it
 *   parses `GuestClosure.tsx` and fails if the shipped strings stop matching these.
 *
 * WHY THE PAGE IS `/` AND NOT `/t/<table>`
 *   A live table needs a database, and this tier has none. What is in question is the CSS
 *   composition of one container — the stylesheet is the same stylesheet on every route.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026, run against the pre-fix shape — `ACTION_BAR_STACK` holding
 * the row the bar's second line actually was, `flex items-center gap-2`, and the three shipped
 * buttons including "No thanks, continue to payment"):
 *   OBSERVED FAILING — **20 failed, 6 passed** of 26.
 *     · `the bar stacks...` went red at ALL 13 widths, every one reporting
 *       `each button gets its own line (y: 840, 842, 842)` — three buttons, one line, which is
 *       the defect stated as a measurement.
 *     · `both bar buttons are whole...` went red at 7 of the 13, beginning at 834px with
 *       `No thanks, continue to payment (x 554 → 841, viewport 834)` and at 768px with
 *       `(x 521 → 808, viewport 768)`. It is the ghost button that leaves the screen, every time.
 *
 *   THE 6 THAT PASSED ARE RECORDED RATHER THAN SMOOTHED OVER: they are the viewport half at
 *   1920, 1536, 1440, 1366, 1280 and 1024, where the row genuinely did fit. The old bar was not
 *   broken at desktop widths — it was broken from 834px down, which is every tablet and every
 *   phone, and a guest's phone is the only device this screen has ever been opened on.
 */
import { test, expect } from '@playwright/test';
import { ACTION_BAR_STACK } from '../../src/lib/action-bar';

/** The two controls the bar holds, in the order the requester fixed them. */
const BUTTONS = [
  { testId: 'guest-upsell-continue-ordering', label: 'Continue ordering', size: 'lg' },
  { testId: 'guest-upsell-tip', label: 'Add a tip', size: 'md' },
] as const;

/* Button's own classes, copied from `components/ui/button.tsx` deliberately: this spec is about
 * the BAR, and pinning the button classes here means a change to Button cannot silently alter
 * what is being measured. If `lg` loses `w-full`, the full-width assertion is what notices. */
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full transition-colors';
const BTN_SIZE: Record<string, string> = {
  lg: 'min-h-12 px-6 type-button w-full',
  md: 'min-h-11 px-5 type-button',
};

/** Every width the responsive audit covers, widest first. */
const WIDTHS = [1920, 1536, 1440, 1366, 1280, 1024, 834, 768, 430, 390, 375, 360, 320] as const;

interface Box {
  testId: string;
  label: string;
  x: number;
  right: number;
  y: number;
  width: number;
  scrollWidth: number;
  clientWidth: number;
}

async function measureAt(page: import('@playwright/test').Page, width: number): Promise<{
  boxes: Box[];
  barScroll: number;
  barClient: number;
  docScroll: number;
  docClient: number;
}> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');

  return page.evaluate(
    ({ barClass, base, sizes, buttons }) => {
      document.querySelector('#upsell-bar-probe')?.remove();
      const bar = document.createElement('div');
      bar.id = 'upsell-bar-probe';
      bar.className = barClass;
      // The inline cap `ActionBar` sets on itself. Without it the bar is viewport-wide and the
      // measurement would be of a bar no guest ever sees.
      bar.style.maxWidth = 'var(--layout-guest-max-width)';

      buttons.forEach((b) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.setAttribute('data-testid', b.testId);
        el.className = `${base} ${sizes[b.size] ?? ''}`;
        el.textContent = b.label;
        bar.appendChild(el);
      });
      document.body.appendChild(bar);

      const boxes = [...bar.children].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          testId: el.getAttribute('data-testid') ?? '',
          label: (el.textContent ?? '').trim(),
          x: Math.round(r.x),
          right: Math.round(r.right),
          y: Math.round(r.y),
          width: Math.round(r.width),
          scrollWidth: (el as HTMLElement).scrollWidth,
          clientWidth: (el as HTMLElement).clientWidth,
        };
      });

      return {
        boxes,
        barScroll: bar.scrollWidth,
        barClient: bar.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
      };
    },
    {
      barClass: ACTION_BAR_STACK,
      base: BTN_BASE,
      sizes: BTN_SIZE,
      buttons: BUTTONS.map((b) => ({ testId: b.testId, label: b.label, size: b.size as string })),
    }
  );
}

for (const width of WIDTHS) {
  test(`both bar buttons are whole and inside the viewport at ${width}px`, async ({ page }) => {
    const { boxes } = await measureAt(page, width);

    // A detector that parsed nothing reports nothing, not success.
    expect(boxes, 'both buttons must exist in the DOM').toHaveLength(BUTTONS.length);

    const outside = boxes.filter((b) => b.right > width || b.x < 0);
    expect(
      outside.map((b) => `${b.label} (x ${b.x} → ${b.right}, viewport ${width})`),
      'no button may sit outside the viewport'
    ).toEqual([]);

    // A button whose content is wider than its box is a label being cut — the outcome every
    // forbidden remedy (ellipsis, overflow:hidden, shrinking the type) would produce.
    const clipped = boxes.filter((b) => b.scrollWidth > b.clientWidth + 1);
    expect(clipped.map((b) => b.label), 'no label may be clipped inside its own button').toEqual([]);
  });

  test(`the bar stacks and never scrolls sideways at ${width}px`, async ({ page }) => {
    const { boxes, barScroll, barClient, docScroll, docClient } = await measureAt(page, width);

    // THE ASSERTION THE CHANGE WAS MADE FOR. Two buttons on one line is the shape that had no
    // width at which it was safe; one per line is the shape that has no width at which it is not.
    const ys = boxes.map((b) => b.y);
    expect(new Set(ys).size, `each button gets its own line (y: ${ys.join(', ')})`).toBe(boxes.length);

    // The order the requester fixed: Continue ordering above Add a tip.
    expect(boxes.map((b) => b.testId)).toEqual(BUTTONS.map((b) => b.testId));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);

    // Stretch is what makes a column responsive without a breakpoint: both buttons are the
    // bar's own content width, so neither can be the one that sets an overflow.
    const inner = boxes.map((b) => b.width);
    expect(new Set(inner).size, `both buttons are full width (${inner.join(', ')})`).toBe(1);

    expect(barScroll, `the bar must not scroll sideways (${barScroll} > ${barClient})`)
      .toBeLessThanOrEqual(barClient + 1);
    expect(docScroll, `the page must not scroll sideways (${docScroll} > ${docClient})`)
      .toBeLessThanOrEqual(docClient + 1);
  });
}
