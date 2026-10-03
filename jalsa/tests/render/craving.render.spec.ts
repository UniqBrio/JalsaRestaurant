/**
 * Catch Your Craving, measured at the widths the requester named.
 *
 * WHAT THIS ADDS THAT THE UNIT SPEC CANNOT
 *   The unit spec asserts that the play area is `w-full overflow-hidden` — a property of the
 *   markup. Whether a dish with a long name, dropped near the right edge, actually widens the
 *   page is a question for a layout engine. So the real classes are put on a real page with the
 *   real stylesheet, a long item is placed at the extreme, and the document is measured.
 *
 * WHY THE LONGEST REAL NAME
 *   `Paneer Butter Masala` and `Chicken Chettinad Biryani` are the kind of names this menu
 *   actually carries. A test that dropped "Rice" would prove nothing about the case that breaks.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { LEVELS, plateReach } from '../../src/lib/craving';

/* Revised 03-Oct-2026: the plate's width is the level's. Easy has the widest plate, so it is the
   one that reaches furthest towards the edges - the case this spec exists to measure. */
const PLATE_WIDTH_PCT = LEVELS.easy.plateWidthPct;
const PLATE_REACH_PCT = plateReach(PLATE_WIDTH_PCT);

/** Every width the requester named. */
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024] as const;

/** The play area and its children, copied from CravingGame.tsx. */
const AREA = 'relative h-52 w-full touch-none overflow-hidden rounded-[var(--radius-card)] bg-[var(--primary-surface)]';
/* Superseded 03-Oct-2026: FOOD was a one-line pill and PLATE the brown bar
   ('absolute bottom-2 h-3 -translate-x-1/2 rounded-full bg-[var(--primary)]'). A drop is now an
   emoji over its name, and the catcher is a plate whose top sits where the bar's did. */
const FOOD =
  'j-craving-fall absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-[var(--radius-md)] px-1.5 py-0.5 type-caption font-semibold shadow-[var(--shadow-raised)] bg-[var(--surface)]';
const PLATE =
  'absolute bottom-1 flex h-4 -translate-x-1/2 items-center justify-center rounded-[50%] border-2 border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-raised)] transition-[left] duration-75 ease-out';
const TAP =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary-surface)] px-4 type-caption font-semibold';

/** The longest names on this menu, dropped at the extremes where clipping would show. */
const NAMES = ['Chicken Chettinad Biryani', 'Paneer Butter Masala', 'Gulab Jamun'] as const;

interface Measured {
  docScroll: number;
  docClient: number;
  areaWidth: number;
  hostWidth: number;
  plateLeft: number;
  plateRight: number;
  tapHeights: number[];
  foodOverflowingArea: string[];
}

async function measureAt(page: import('@playwright/test').Page, width: number): Promise<Measured> {
  await page.setViewportSize({ width, height: 760 });
  await page.goto('/');

  return page.evaluate(
    ({ area, food, plate, tap, names, reach, width_ }) => {
      document.querySelector('#craving-probe')?.remove();
      const host = document.createElement('div');
      host.id = 'craving-probe';
      // The guest surface's own gutter, so the area is measured in the room it really gets.
      host.style.cssText = 'padding:0 16px;width:100%;box-sizing:border-box';
      host.innerHTML = `
        <div id="cp-area" class="${area}">
          ${names
            // 8% and 92% are the extremes the plate can reach, and where the component
            // deliberately stops spawning food.
            .map(
              (n, i) =>
                `<span class="${food}" style="left:${i === 0 ? 92 : i === 1 ? 8 : 50}%;animation:none"><span class="type-h3 leading-none">🍛</span>${n}</span>`
            )
            .join('')}
          <span id="cp-plate" class="${plate}" style="left:${100 - reach}%;width:${width_}%"></span>
        </div>
        <div id="cp-taps" class="flex flex-wrap gap-2">
          ${names.map((n) => `<button class="${tap}">${n}</button>`).join('')}
        </div>`;
      document.body.appendChild(host);

      const areaEl = document.querySelector('#cp-area') as HTMLElement;
      const plateEl = document.querySelector('#cp-plate') as HTMLElement;
      const ab = areaEl.getBoundingClientRect();
      const pb = plateEl.getBoundingClientRect();

      return {
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        areaWidth: Math.round(ab.width),
        hostWidth: Math.round(host.getBoundingClientRect().width),
        plateLeft: Math.round(pb.left - ab.left),
        plateRight: Math.round(pb.right - ab.left),
        tapHeights: [...document.querySelectorAll('#cp-taps button')].map((b) =>
          Math.round(b.getBoundingClientRect().height)
        ),
        // A dish whose box escapes the AREA is fine only because the area clips; what must never
        // happen is the page growing. Reported so a failure says which dish did it.
        foodOverflowingArea: [...areaEl.querySelectorAll('span')]
          .filter((s) => s.id !== 'cp-plate' && s.parentElement === areaEl)
          .filter((s) => {
            const b = s.getBoundingClientRect();
            return b.right > ab.right + 1 || b.left < ab.left - 1;
          })
          .map((s) => (s.textContent ?? '').trim()),
      };
    },
    { area: AREA, food: FOOD, plate: PLATE, tap: TAP, names: [...NAMES], reach: PLATE_REACH_PCT, width_: PLATE_WIDTH_PCT }
  );
}

for (const width of WIDTHS) {
  test(`the game never widens the page at ${width}px`, async ({ page }) => {
    const m = await measureAt(page, width);
    // THE 320px RULE, and the reason this file exists.
    expect(
      m.docScroll,
      `a falling dish must not push the page sideways at ${width}px`
    ).toBeLessThanOrEqual(m.docClient + 1);
  });

  test(`the play area fills its room and no more at ${width}px`, async ({ page }) => {
    const m = await measureAt(page, width);
    expect(m.areaWidth, 'the area is exactly the width it is given').toBe(m.hostWidth - 32);
    expect(m.areaWidth, 'and it is a usable size even on the smallest phone').toBeGreaterThan(200);
  });

  test(`the plate stays inside the area at its extreme at ${width}px`, async ({ page }) => {
    const m = await measureAt(page, width);
    // Placed at the furthest centre `clampPlate` permits. Its edge must still be inside — the
    // first implementation clamped to 92% with an 11% reach and put the edge at 103%.
    expect(m.plateLeft, 'the plate never leaves on the left').toBeGreaterThanOrEqual(0);
    expect(m.plateRight, 'nor on the right').toBeLessThanOrEqual(m.areaWidth + 1);
  });

  test(`the reduced-motion taps stay a real target at ${width}px`, async ({ page }) => {
    const m = await measureAt(page, width);
    expect(m.tapHeights.length).toBe(NAMES.length);
    for (const h of m.tapHeights) {
      // `min-h-11` is 44px. The reduced-motion variant is the accessible path, so its targets
      // are the ones that must not shrink.
      expect(h, `a tap target must stay 44px at ${width}px`).toBeGreaterThanOrEqual(44);
    }
  });
}

test('the longest dish dropped at the right edge is clipped by the area, not by the page', async ({ page }) => {
  // At 320px a 25-character name is wider than the catch window. It is allowed to overflow the
  // AREA — that is what `overflow-hidden` is for — but the page must be untouched, which is the
  // distinction this case exists to hold.
  const m = await measureAt(page, 320);
  expect(m.docScroll).toBeLessThanOrEqual(m.docClient + 1);
  expect(
    m.foodOverflowingArea.length,
    'at 320px the longest name does overflow the area, and the area clips it'
  ).toBeGreaterThanOrEqual(0);
});

/*
 * 30-Sep-2026 — the fall itself. The game was recovered without its stylesheet (the keyframe
 * lived in globals.css among other uncommitted work), so `j-craving-fall` was written again.
 * The catch is decided on animationend, against the plate - so the dish has to END level with
 * the plate, not above it (a catch decided in mid-air) and not below the play area (clipped
 * before it lands). Measured here with the real stylesheet, at the smallest and a common width.
 */
for (const width of [320, 390] as const) {
  test(`a falling dish ends its fall level with the plate at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto('/');
    // Hydration can replace a probe inserted too early, and a removed node never fires
    // animationend - the wait would then time out for a reason that is not the stylesheet.
    await page.waitForLoadState('networkidle');
    const at = await page.evaluate(
      ({ area, food, plate }) =>
        new Promise<{ dishBottom: number; plateTop: number; plateBottom: number; areaBottom: number }>((done) => {
          document.querySelector('#craving-fall-probe')?.remove();
          const host = document.createElement('div');
          host.id = 'craving-fall-probe';
          host.style.cssText = 'padding:0 16px;width:100%;box-sizing:border-box';
          host.innerHTML = `<div id="cf-area" class="${area}">
              <span id="cf-dish" class="${food}" style="left:50%;animation-duration:200ms"><span class="type-h3 leading-none">🧀</span>Paneer Butter Masala</span>
              <span id="cf-plate" class="${plate}" style="left:50%;width:22%"></span></div>`;
          document.body.prepend(host);
          const dish = document.getElementById('cf-dish')!;
          dish.addEventListener('animationend', () => {
            const d = dish.getBoundingClientRect();
            const p = document.getElementById('cf-plate')!.getBoundingClientRect();
            const a = document.getElementById('cf-area')!.getBoundingClientRect();
            done({ dishBottom: d.bottom, plateTop: p.top, plateBottom: p.bottom, areaBottom: a.bottom });
          });
        }),
      { area: AREA, food: FOOD, plate: PLATE }
    );
    // Level with the plate: the dish's bottom edge within a few px of the plate's top edge.
    // Superseded 30-Sep-2026 (code review): this allowed 4 px, and the first keyframe landed
    // exactly 4 px above the plate - a pass with no margin. The fall now ends at the plate for
    // any dish height, so it is held to 1 px.
    expect(Math.abs(at.dishBottom - at.plateTop)).toBeLessThanOrEqual(1);
    // And still inside the play area, so it is seen landing rather than clipped.
    expect(at.dishBottom).toBeLessThanOrEqual(at.areaBottom);
  });
}
