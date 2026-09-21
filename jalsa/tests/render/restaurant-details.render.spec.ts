/**
 * The Restaurant details field grid, measured at every width the request names.
 *
 * WHAT THIS PROVES THAT THE SOURCE SPEC CANNOT
 *   `restaurant-details.unit.spec.ts` proves the panel carries `grid-cols-1` and the `md:` pair.
 *   Whether a 60-character address actually fits beside a phone number at 768px is a question
 *   only a layout engine answers — and the old layout's defect was exactly that shape: a
 *   `flex-wrap` row with a `min-w-[14rem]` floor, which inside a padded card at 320px asks for
 *   more room than the card has.
 *
 * WHY THE CLASSES ARE PINNED AND THEN CHECKED
 *   This builds its own DOM, so without the check below it would measure its own copy and stay
 *   green while the panel drifted. `pair` is a template literal in a component, so there is no
 *   value to import; it is pinned here and asserted against the source instead.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026, with `PAIR` set to the shipped
 * `flex flex-wrap gap-3` + `min-w-[14rem] flex-1`): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const PAIR = 'grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]';
/** The Card's own box, from `components/ui/atoms.tsx`, so the fields are measured inside it. */
const CARD = 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4';

/** Tailwind's `md`, where the second column is allowed to appear. */
const MD = 768;
const WIDTHS = [1440, 1280, 1024, 834, 768, 430, 390, 360, 320] as const;

/* A real value from the screenshot, unbroken enough to test the track floor. */
const LONG = 'hr@jalsahosur.in';
const LONGER = '142 Bagalur Main Road, Hosur, Krishnagiri District, Tamil Nadu 635109';

test('the pinned classes are the ones the panel actually ships', () => {
  const source = readFileSync('src/features/owner/sections/SettingsSection.tsx', 'utf8');
  expect(source, 'the grid measured here must be the grid that ships').toContain(`const pair = '${PAIR}';`);
});

interface Box { name: string; x: number; right: number; y: number; width: number }

async function measureAt(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');

  return page.evaluate(
    ({ pair, card, a, b }) => {
      document.querySelector('#identity-probe')?.remove();
      const host = document.createElement('div');
      host.id = 'identity-probe';
      // The owner console's own page gutter, so the card is measured in the room it really gets.
      host.style.cssText = 'padding:0 16px;width:100%;box-sizing:border-box';

      const cardEl = document.createElement('div');
      cardEl.className = card;

      const grid = document.createElement('div');
      grid.className = pair;
      for (const [name, value] of [
        ['first', a],
        ['second', b],
      ] as const) {
        const field = document.createElement('div');
        field.setAttribute('data-name', name);
        field.innerHTML =
          `<label style="display:block">${name}</label>` +
          `<input style="width:100%;min-height:44px;box-sizing:border-box" value="${value}">`;
        grid.appendChild(field);
      }
      cardEl.appendChild(grid);
      host.appendChild(cardEl);
      document.body.appendChild(host);

      const cardRect = cardEl.getBoundingClientRect();
      const cs = getComputedStyle(cardEl);
      const boxes = [...grid.children].map((el) => {
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
        card: {
          left: Math.round(cardRect.left + parseFloat(cs.paddingLeft)),
          right: Math.round(cardRect.right - parseFloat(cs.paddingRight)),
        },
        gridScroll: grid.scrollWidth,
        gridClient: grid.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
      };
    },
    { pair: PAIR, card: CARD, a: LONG, b: LONGER }
  );
}

for (const width of WIDTHS) {
  test(`fields stay inside their card and nothing scrolls sideways at ${width}px`, async ({ page }) => {
    const { boxes, card, gridScroll, gridClient, docScroll, docClient } = await measureAt(page, width);

    expect(boxes, 'both fields must exist').toHaveLength(2);

    const outside = (boxes as Box[]).filter((b) => b.right > card.right + 1 || b.x < card.left - 1);
    expect(
      outside.map((b) => `${b.name} (x ${b.x} → ${b.right}, card ${card.left} → ${card.right})`),
      'no field may spill out of its card'
    ).toEqual([]);

    expect(gridScroll, `the grid must not scroll sideways (${gridScroll} > ${gridClient})`)
      .toBeLessThanOrEqual(gridClient + 1);
    expect(docScroll, `the page must not scroll sideways (${docScroll} > ${docClient})`)
      .toBeLessThanOrEqual(docClient + 1);
  });

  test(`the pair is ${width >= MD ? 'two columns' : 'one column'} at ${width}px`, async ({ page }) => {
    const { boxes } = await measureAt(page, width);
    const [first, second] = boxes as [Box, Box];

    if (width >= MD) {
      expect(first.y, `side by side (y ${first.y} vs ${second.y})`).toBe(second.y);
      expect(first.right, 'and they do not overlap').toBeLessThanOrEqual(second.x);
    } else {
      // A phone gets one field per line. Two 14rem boxes inside a padded card at 320px was the
      // shape this replaced.
      expect(second.y, 'stacked').toBeGreaterThan(first.y);
      expect(first.x, 'both at the same edge').toBe(second.x);
      expect(first.width, 'both the full width of the card').toBe(second.width);
    }
  });
}
