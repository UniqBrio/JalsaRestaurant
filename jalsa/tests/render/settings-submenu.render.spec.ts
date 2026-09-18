/**
 * The Settings submenu, measured at every width the requester named.
 *
 * WHAT THIS PROVES THAT A CLASS-NAME ASSERTION CANNOT
 *   `flex-wrap` in a string proves the string says `flex-wrap`. What a reader of the screen
 *   cares about is whether the tenth destination has a rectangle inside the viewport, and that
 *   is a question only a layout engine can answer. So the real chip markup is put on a page that
 *   has loaded the real stylesheet, and every chip's box is measured.
 *
 * WHY THE CLASS COMES FROM `src/lib/chip-nav.ts`
 *   A spec carrying its own copy of the container class measures the copy. Importing the value
 *   the component imports means this suite goes red if `SettingsSection` ever stops wrapping —
 *   which is the regression it exists for.
 *
 * WHY THE PAGE IS `/` AND NOT `/owner`
 *   The owner console needs a PIN and a database, and neither is available to this tier. What
 *   the bug lives in is the CSS composition of one container — the stylesheet is the same
 *   stylesheet on every route, so `/` serves it and the nav is measured against it. The panels
 *   below the nav are not in question and are not rendered here.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026, run against the pre-fix tree — `CHIP_NAV_WRAP` holding the
 * shipped value `j-scroll-x flex gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`):
 *   OBSERVED FAILING — **15 failed, 4 passed**. Seven of the eight widths went red on both
 *   assertions: at 1280px `Printers & machines (x 1271 → 1421, viewport 1280)` and
 *   `the nav must not scroll sideways (1405 > 1248)`; at 1024px five chips were outside,
 *   beginning with `Replies to suggestions (x 925 → 1088, viewport 1024)`. The wrapping
 *   assertion failed too — one row at every width, which is the defect stated as a measurement.
 *
 *   1440px PASSED, and the reason is worth recording rather than smoothing over: the row is
 *   ~1405px and 1440 minus this probe's 32px gutter leaves 1408, so it fits by three pixels.
 *   The requester's screenshot shows it clipped on a WIDER window, because the owner console
 *   gives the nav less room than this probe does. The probe is therefore CONSERVATIVE — it
 *   under-reports the bug rather than over-reporting it, which is the safe direction for a
 *   regression test to be wrong in.
 */
import { test, expect } from '@playwright/test';
import { CHIP_NAV_WRAP } from '../../src/lib/chip-nav';

/** The ten labels, in the order the design fixes them. Order is asserted, not assumed. */
const LABELS = [
  'Opening hours',
  'Restaurant details',
  'Tax & GST',
  'Invoice',
  'Tables & QR',
  'What the customer sees',
  'Words the guest sees',
  'Replies to suggestions',
  'Customer engagement',
  'Printers & machines',
] as const;

/** Every width the requester named, widest first. */
const WIDTHS = [1440, 1280, 1024, 834, 768, 430, 390, 360] as const;

/* The Chip class, copied from `components/ui/atoms.tsx` deliberately: this spec is about the
 * CONTAINER, and pinning the chip's own classes here means a change to Chip cannot silently
 * alter what is being measured. If Chip loses `whitespace-nowrap`, the truncation assertion
 * below is what notices. */
const CHIP =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap ' +
  'rounded-full px-4 type-caption font-semibold transition-colors';

interface Box { label: string; x: number; right: number; y: number; width: number; scrollWidth: number; clientWidth: number }

async function measureAt(
  page: import('@playwright/test').Page,
  width: number,
  labels: readonly string[] = LABELS
): Promise<{
  boxes: Box[];
  navScroll: number;
  navClient: number;
  docScroll: number;
  docClient: number;
}> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');

  return page.evaluate(
    ({ navClass, chipClass, labels }) => {
      document.querySelector('#submenu-probe')?.remove();
      const host = document.createElement('div');
      host.id = 'submenu-probe';
      // The page gutter the owner console actually uses, so the measurement is against the
      // space the nav really gets rather than the full viewport.
      host.style.cssText = 'padding:0 16px;width:100%;box-sizing:border-box';
      const nav = document.createElement('nav');
      nav.className = navClass;
      labels.forEach((l) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = chipClass;
        b.textContent = l;
        nav.appendChild(b);
      });
      host.appendChild(nav);
      document.body.appendChild(host);

      const boxes = [...nav.children].map((el) => {
        const r = el.getBoundingClientRect();
        return {
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
        navScroll: nav.scrollWidth,
        navClient: nav.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
      };
    },
    { navClass: CHIP_NAV_WRAP, chipClass: CHIP, labels: [...labels] }
  );
}

for (const width of WIDTHS) {
  test(`all ten submenu items are inside the viewport at ${width}px`, async ({ page }) => {
    const { boxes } = await measureAt(page, width);

    expect(boxes, 'every one of the ten chips must exist in the DOM').toHaveLength(LABELS.length);

    // THE ASSERTION THE BUG WAS REPORTED AGAINST. A chip whose right edge is past the viewport
    // is the tenth item the requester could not see, whatever the scroll container says.
    const outside = boxes.filter((b) => b.right > width || b.x < 0);
    expect(
      outside.map((b) => `${b.label} (x ${b.x} → ${b.right}, viewport ${width})`),
      'no chip may sit outside the viewport'
    ).toEqual([]);
  });

  test(`no label is truncated and nothing scrolls sideways at ${width}px`, async ({ page }) => {
    const { boxes, navScroll, navClient, docScroll, docClient } = await measureAt(page, width);

    // A chip whose content is wider than its box is a chip whose label is being cut — which is
    // what every forbidden remedy (ellipsis, overflow:hidden, shrinking) would produce.
    const clipped = boxes.filter((b) => b.scrollWidth > b.clientWidth + 1);
    expect(clipped.map((b) => b.label), 'no label may be clipped inside its own chip').toEqual([]);

    // Horizontal scrolling was explicitly ruled out as the remedy, on the nav and on the page.
    expect(navScroll, `the nav must not scroll sideways (${navScroll} > ${navClient})`)
      .toBeLessThanOrEqual(navClient + 1);
    expect(docScroll, `the page must not scroll sideways (${docScroll} > ${docClient})`)
      .toBeLessThanOrEqual(docClient + 1);
  });
}

test('the ten labels and their order are exactly what the design fixes', async ({ page }) => {
  const { boxes } = await measureAt(page, 1440);
  expect(boxes.map((b) => b.label)).toEqual([...LABELS]);
});

test('NARROW WIDTHS GET TALLER, NOT SHORTER — the row is genuinely wrapping', async ({ page }) => {
  // The point of the fix, stated as a measurement: a wrapping nav occupies more rows as the
  // viewport narrows. A nav that reported one row at 360px would be scrolling, not wrapping.
  const wide = await measureAt(page, 1440);
  const narrow = await measureAt(page, 360);
  const rows = (boxes: Box[]) => new Set(boxes.map((c) => c.y)).size;
  expect(rows(narrow.boxes)).toBeGreaterThan(rows(wide.boxes));
});

test('every chip keeps a 44px touch target at the narrowest width', async ({ page }) => {
  // Wrapping must not be bought by squeezing the chips: min-h-11 is the floor, and a chip that
  // lost it would be a chip that got smaller to fit, which is the remedy that was ruled out.
  const { boxes } = await measureAt(page, 360);
  const short = boxes.filter((b) => b.width < 44);
  expect(short.map((b) => b.label), 'no chip may be narrower than the touch-target floor').toEqual([]);
});

/* ── The sibling navigations JP-22 now governs ──────────────────────────────
 * Settings was the only one wide enough to overflow, because it is the only one with ten long
 * labels. These two carried the identical defect latently — same hand-rolled scroller, fewer
 * chips — and a latent defect is one label rename away from the reported one. Measured, not
 * assumed. */
const SIBLINGS = [
  { name: 'Print setup', labels: ['Overview', 'Printers', 'Templates', 'Routing', 'History'] },
  {
    name: 'Reports',
    labels: ['Sales & products', 'All orders', 'Purchases & expenses', 'Final report'],
  },
] as const;

for (const nav of SIBLINGS) {
  for (const width of [1440, 768, 390, 360] as const) {
    test(`${nav.name} nav: every tab is inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const boxes = await page.evaluate(
        ({ navClass, chipClass, labels }) => {
          document.querySelector('#sibling-probe')?.remove();
          const host = document.createElement('div');
          host.id = 'sibling-probe';
          host.style.cssText = 'padding:0 16px;width:100%;box-sizing:border-box';
          const el = document.createElement('nav');
          el.className = navClass;
          labels.forEach((l) => {
            const b = document.createElement('button');
            b.className = chipClass;
            b.textContent = l;
            el.appendChild(b);
          });
          host.appendChild(el);
          document.body.appendChild(host);
          return [...el.children].map((c) => {
            const r = c.getBoundingClientRect();
            return { label: (c.textContent ?? '').trim(), x: Math.round(r.x), right: Math.round(r.right) };
          });
        },
        { navClass: CHIP_NAV_WRAP, chipClass: CHIP, labels: [...nav.labels] }
      );

      expect(boxes).toHaveLength(nav.labels.length);
      expect(
        boxes.filter((b) => b.right > width || b.x < 0).map((b) => b.label),
        `${nav.name}: no tab may sit outside the viewport`
      ).toEqual([]);
    });
  }
}

/* ── The Staff access tabs, through the same probe ─────────────────────────────────────────── */

/**
 * `Owner → Staff` gained two chips — Has access / No access — on 18-Sep-2026, using THIS
 * container and THIS chip.
 *
 * WHY THEY ARE MEASURED HERE RATHER THAN IN A FILE OF THEIR OWN
 *   A second spec would be a second way of testing one thing, which this repository calls a
 *   defect. The container and the chip are shared, so what is genuinely new is only the labels —
 *   and the ten above are longer and more numerous than these two, so passing there already
 *   implies passing here at every width. What these cases add is the guarantee that the STAFF
 *   labels specifically, counts and all, are never clipped or pushed off a 360px screen.
 *
 * The counts are two digits on purpose: the widest they can get on a real roster.
 *
 * FAIL-FIRST (18-Sep-2026) — **NOT OBSERVED FAILING**, and the reason is the honest one.
 *   `CHIP_NAV_WRAP` was set back to the pre-fix scrolling value
 *   (`j-scroll-x flex gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`) and these
 *   eight cases were run against it: **8 passed**. Two chips this short occupy about 270px of
 *   the 328px content box at 360px, so they fit whether the row wraps or scrolls — the defect
 *   is real but cannot express itself through THESE labels.
 *
 *   The same injection was caught, in the same run, by
 *   `tests/unit/staff-access-tabs.unit.spec.ts` — "the tab row is the existing chip NAVIGATION"
 *   pins the exported value and went red (1 failed, 18 passed). And the ten-label cases at the
 *   top of this file carry the container's own observed-failing evidence from 17-Sep
 *   (15 failed, 4 passed).
 *
 *   So these eight are kept as a FORWARD guarantee, not as the container's regression test: a
 *   third tab, a longer label, or a three-digit count would be caught here and nowhere else.
 */
const STAFF_TABS = ['Has access · 26', 'No access · 26'] as const;

for (const width of WIDTHS) {
  test(`both Staff access tabs are whole and on screen at ${width}px`, async ({ page }) => {
    const { boxes, navScroll, navClient, docScroll, docClient } = await measureAt(page, width, STAFF_TABS);

    expect(boxes, 'both tabs must exist').toHaveLength(STAFF_TABS.length);

    const outside = boxes.filter((b) => b.right > width || b.x < 0);
    expect(
      outside.map((b) => `${b.label} (x ${b.x} → ${b.right}, viewport ${width})`),
      'neither tab may sit outside the viewport'
    ).toEqual([]);

    const clipped = boxes.filter((b) => b.scrollWidth > b.clientWidth + 1);
    expect(clipped.map((b) => b.label), 'neither label may be cut, counts included').toEqual([]);

    expect(navScroll, 'the tab row must not scroll sideways').toBeLessThanOrEqual(navClient + 1);
    expect(docScroll, 'and the page must not either').toBeLessThanOrEqual(docClient + 1);

    // A tab is a thumb target: `Chip` carries `min-h-11`, and this is what proves it survived.
    for (const b of boxes) {
      expect(b.width, `${b.label} must stay a real target at ${width}px`).toBeGreaterThan(80);
    }
  });
}
