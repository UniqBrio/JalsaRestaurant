/**
 * The tabletop stand's two faces, measured inside the real modal width.
 *
 * WHY A MEASUREMENT AND NOT ONLY THE CLASS ASSERTION
 *   `tests/unit/qr-stand.unit.spec.ts` proves the sheet carries the grid and the print classes.
 *   What it cannot prove is that a 260px code plus an unbreakable address plus six lines of
 *   instructions fit inside one face at 320px without the face widening past the dialog — a
 *   grid track's default `min-width` is `auto`, and only `minmax(0,...)` plus a wrapping rule
 *   on the address stop that. That is a layout-engine question, so the real classes go on a
 *   page that has loaded the real stylesheet, inside a box the width the modal actually is.
 *
 * WHY THE MODAL WIDTH IS COMPUTED, NOT TYPED
 *   `sheet.tsx` gives `posture="modal"` `w-[min(46rem,calc(100vw-2rem))]`. The probe applies
 *   that same expression, so a change to the Sheet's cap changes what this suite measures.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/** The two class strings exactly as `TableStandSheet.tsx` declares them. */
const STAND_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start';
const STAND_FACE =
  'flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-center';

/**
 * The pin, kept honest. This spec builds its own DOM, so without this it would measure its COPY
 * of the class strings: the component could drop `grid-cols-1` tomorrow and every assertion
 * below would still pass, having proved only that the strings in this file lay out correctly.
 */
test('the pinned classes are the ones the stand actually ships', () => {
  const source = readFileSync('src/features/owner/TableStandSheet.tsx', 'utf8');
  expect(source.length, 'the component must be readable').toBeGreaterThan(2000);
  expect(source, 'the grid measured here must be the grid that ships').toContain(`const STAND_GRID = '${STAND_GRID}';`);
  expect(source, 'and the face').toContain(`'${STAND_FACE}';`);
  expect(source, 'the address wraps, or it sets the floor width').toContain('className="break-all type-caption');
});

const MODAL_WIDTH = 'min(46rem, calc(100vw - 2rem))';
const MD = 768;
const WIDTHS = [1440, 1280, 1024, 834, 768, 430, 390, 360, 320] as const;

/** The longest address a stand will carry: the production origin plus a two-letter table. */
const ADDRESS = 'https://jalsa-restaurant-phi.vercel.app/t/N12';

interface Box { name: string; x: number; right: number; y: number; width: number }

async function measureAt(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');

  return page.evaluate(
    ({ grid, face, modalWidth, address }) => {
      document.querySelector('#stand-probe')?.remove();
      const modal = document.createElement('div');
      modal.id = 'stand-probe';
      modal.style.cssText = `width:${modalWidth};margin:0 auto;box-sizing:border-box;padding:0 1.25rem`;

      const body = document.createElement('div');
      body.className = grid;

      const makeFace = (name: string): HTMLElement => {
        const el = document.createElement('section');
        el.className = face;
        el.setAttribute('data-name', name);
        el.innerHTML =
          '<p class="type-eyebrow">Scan to order</p>' +
          '<h2 class="type-h2">Jalsa Restaurant</h2>' +
          '<div style="width:260px;height:260px;max-width:100%"></div>' +
          '<ol class="type-caption" style="text-align:left;width:100%;padding-left:1.25rem">' +
          '<li>Point the camera at the QR code and wait for the link to appear.</li>' +
          '<li>Open Google Lens and scan the QR code.</li></ol>' +
          `<code class="type-caption" style="word-break:break-all">${address}</code>`;
        return el;
      };

      body.appendChild(makeFace('front'));
      body.appendChild(makeFace('back'));
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
      const r = modal.getBoundingClientRect();
      const cs = getComputedStyle(modal);
      return {
        boxes,
        modal: {
          left: Math.round(r.left + parseFloat(cs.paddingLeft)),
          right: Math.round(r.right - parseFloat(cs.paddingRight)),
        },
        bodyScroll: body.scrollWidth,
        bodyClient: body.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
      };
    },
    { grid: STAND_GRID, face: STAND_FACE, modalWidth: MODAL_WIDTH, address: ADDRESS }
  );
}

for (const width of WIDTHS) {
  test(`both faces are inside the dialog and nothing scrolls sideways at ${width}px`, async ({ page }) => {
    const { boxes, modal, bodyScroll, bodyClient, docScroll, docClient } = await measureAt(page, width);

    // A probe that built nothing would pass every containment check by having nothing to
    // contain. BLOCKED, not green.
    expect(boxes, 'both faces must exist').toHaveLength(2);
    expect(boxes.map((b) => b.name), 'front first in the DOM').toEqual(['front', 'back']);

    const outside = boxes.filter((b) => b.right > modal.right + 1 || b.x < modal.left - 1);
    expect(
      outside.map((b) => `${b.name} (x ${b.x} → ${b.right}, dialog ${modal.left} → ${modal.right})`),
      'no face may spill out of the dialog'
    ).toEqual([]);

    expect(bodyScroll, `the dialog body must not scroll sideways (${bodyScroll} > ${bodyClient})`).toBeLessThanOrEqual(
      bodyClient + 1
    );
    expect(docScroll, `the page must not scroll sideways (${docScroll} > ${docClient})`).toBeLessThanOrEqual(docClient + 1);
  });

  test(`the faces are ${width >= MD ? 'side by side' : 'stacked'} at ${width}px`, async ({ page }) => {
    const { boxes } = await measureAt(page, width);
    const [front, back] = boxes as [Box, Box];
    if (width >= MD) {
      expect(front.y, `both faces start on the same line (y ${front.y} vs ${back.y})`).toBe(back.y);
      expect(front.x, 'the front is the left face').toBeLessThan(back.x);
      expect(front.right, 'the faces do not overlap').toBeLessThanOrEqual(back.x);
    } else {
      expect(front.y, 'the back sits below the front').toBeLessThan(back.y);
    }
  });
}
