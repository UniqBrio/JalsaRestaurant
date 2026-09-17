/**
 * The Record payment dialog's two panes, measured inside the real modal width.
 *
 * WHY A MEASUREMENT AND NOT ONLY THE CLASS ASSERTION
 *   `tests/unit/close-bill-order-pane.unit.spec.ts` proves the component carries
 *   `md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`. What it cannot prove is that a long dish name
 *   inside that grid does not push the form off the side — which is exactly what a bare
 *   `1fr 1fr` would do, because a grid track's default `min-width` is `auto` and refuses to
 *   shrink below its longest unbroken word. That is a layout-engine question, so the real
 *   classes go on a page that has loaded the real stylesheet, inside a box the width the modal
 *   actually is, and both panes are measured.
 *
 * WHY THE MODAL WIDTH IS COMPUTED, NOT TYPED
 *   `sheet.tsx` gives `posture="modal"` `w-[min(46rem,calc(100vw-2rem))]`. The probe applies
 *   that same expression rather than a per-width table of numbers, so a change to the Sheet's
 *   cap changes what this suite measures instead of silently invalidating it.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026, run against the pre-change shape — the single
 * `flex flex-col gap-4` column the dialog shipped as): OBSERVED FAILING, recorded in
 * TEST_SUMMARY.md. With one column there is no second pane to find at any width.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** The dialog body's own classes, as `CloseBillSheet.tsx` writes them. */
const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start';
const PANE = 'flex flex-col gap-4';

/**
 * The pin, kept honest.
 *
 * This spec builds its own DOM, so without this it would measure its COPY of the class string:
 * the component could drift to a single column tomorrow and every assertion below would still
 * pass, having proved only that the string in this file lays out correctly. It is the same trap
 * `chip-nav.ts` and `action-bar.ts` avoid by exporting the value - a className written inline in
 * JSX has nothing to export, so it is pinned here and checked against the file instead.
 *
 * It has already caught one drift: `grid-cols-1` was added to the component after the probe
 * found the panes spilling at every phone width, and this suite stayed red until the pin was
 * updated to match.
 */
test('the pinned classes are the ones the component actually ships', () => {
  const source = readFileSync('src/features/owner/CloseBillSheet.tsx', 'utf8');
  expect(source.length, 'the component must be readable').toBeGreaterThan(2000);
  expect(source, 'the grid class measured here must be the grid class that ships').toContain(
    `className="${GRID}"`
  );
  const panes = source.match(new RegExp(`className="${PANE}"`, 'g')) ?? [];
  expect(panes, 'both panes carry the pinned pane class').toHaveLength(2);
});

/** The Sheet's modal box, from `components/ui/sheet.tsx`. */
const MODAL_WIDTH = 'min(46rem, calc(100vw - 2rem))';

/** Tailwind's `md` breakpoint — where the dialog is first at its 736px cap. */
const MD = 768;

const WIDTHS = [1920, 1536, 1440, 1366, 1280, 1024, 834, 768, 430, 390, 375, 360, 320] as const;

/* A dish name with no space in it. The point of `minmax(0,...)` is that an unbreakable word
   must not set the column's floor, and only an unbreakable word tests that. */
const LONG_DISH = 'Hyderabadi-Dum-Mutton-Biryani-Family-Pack';

interface Box { name: string; x: number; right: number; y: number; width: number }

async function measureAt(page: import('@playwright/test').Page, width: number): Promise<{
  boxes: Box[];
  modal: { left: number; right: number; width: number };
  gridScroll: number;
  gridClient: number;
  docScroll: number;
  docClient: number;
}> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');

  return page.evaluate(
    ({ grid, pane, modalWidth, longDish }) => {
      document.querySelector('#close-panes-probe')?.remove();
      const modal = document.createElement('div');
      modal.id = 'close-panes-probe';
      modal.style.cssText = `width:${modalWidth};margin:0 auto;box-sizing:border-box;padding:0 1.25rem`;

      const body = document.createElement('div');
      body.className = grid;

      const left = document.createElement('div');
      left.className = pane;
      left.setAttribute('data-name', 'order');
      // The row shape the pane draws: a truncating name between a mark and two numbers.
      left.innerHTML =
        '<div style="display:flex;gap:.625rem;align-items:center">' +
        '<span style="width:12px;height:12px;flex:none"></span>' +
        `<span style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${longDish}</span>` +
        '<span>×2</span><span style="width:4rem;text-align:right">₹1,240</span></div>';

      const right = document.createElement('div');
      right.className = pane;
      right.setAttribute('data-name', 'money');
      right.innerHTML = '<div style="height:120px">To pay ₹865</div>';

      body.appendChild(left);
      body.appendChild(right);
      modal.appendChild(body);
      document.body.appendChild(modal);

      const boxes = [...body.children].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: el.getAttribute('data-name') ?? '',
          x: Math.round(r.x),
          right: Math.round(r.right),
          y: Math.round(r.y),
          width: Math.round(r.width),
        };
      });

      return {
        boxes,
        modal: (() => {
          const r = modal.getBoundingClientRect();
          // The CONTENT box: the probe carries the dialog's own 1.25rem side padding, and a
          // pane is contained by the padding box, not by the border box. Comparing a pane's
          // viewport x against a bare WIDTH was this spec's first bug - the dialog is centred,
          // so its left edge is not 0 and the two numbers were never comparable.
          const cs = getComputedStyle(modal);
          return {
            left: Math.round(r.left + parseFloat(cs.paddingLeft)),
            right: Math.round(r.right - parseFloat(cs.paddingRight)),
            width: Math.round(r.width),
          };
        })(),
        gridScroll: body.scrollWidth,
        gridClient: body.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
      };
    },
    { grid: GRID, pane: PANE, modalWidth: MODAL_WIDTH, longDish: LONG_DISH }
  );
}

for (const width of WIDTHS) {
  test(`both panes are inside the dialog and nothing scrolls sideways at ${width}px`, async ({ page }) => {
    const { boxes, modal, gridScroll, gridClient, docScroll, docClient } = await measureAt(page, width);

    // A probe that built nothing would pass every containment check below by having nothing to
    // contain. BLOCKED, not green.
    expect(boxes, 'both panes must exist').toHaveLength(2);
    expect(boxes.map((b) => b.name), 'order details first in the DOM').toEqual(['order', 'money']);

    // THE ASSERTION THE `minmax(0,1fr)` IS FOR: an unbreakable 40-character dish name must not
    // widen its column past the dialog.
    const outside = boxes.filter((b) => b.right > modal.right + 1 || b.x < modal.left - 1);
    expect(
      outside.map((b) => `${b.name} (x ${b.x} → ${b.right}, dialog ${modal.left} → ${modal.right})`),
      'no pane may spill out of the dialog'
    ).toEqual([]);

    expect(gridScroll, `the dialog body must not scroll sideways (${gridScroll} > ${gridClient})`)
      .toBeLessThanOrEqual(gridClient + 1);
    expect(docScroll, `the page must not scroll sideways (${docScroll} > ${docClient})`)
      .toBeLessThanOrEqual(docClient + 1);
  });

  test(`the panes are ${width >= MD ? 'side by side' : 'stacked'} at ${width}px`, async ({ page }) => {
    const { boxes } = await measureAt(page, width);
    const [order, money] = boxes as [Box, Box];

    if (width >= MD) {
      // Two columns: same row, order on the LEFT — which is what was asked for.
      expect(order.y, `both panes start on the same line (y ${order.y} vs ${money.y})`).toBe(money.y);
      expect(order.x, 'the order details are the left pane').toBeLessThan(money.x);
      expect(order.right, 'the panes do not overlap').toBeLessThanOrEqual(money.x);
    } else {
      // One column: a phone has no left pane, and two 160px columns would be a squeeze rather
      // than a layout.
      expect(order.y, 'the money pane sits below the order details').toBeLessThan(money.y);
      expect(order.x, 'both panes start at the same edge').toBe(money.x);
      expect(order.width, 'both panes are the full width of the dialog').toBe(money.width);
    }
  });
}
