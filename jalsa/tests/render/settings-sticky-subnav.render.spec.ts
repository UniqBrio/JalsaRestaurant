/**
 * The Settings sub-tab row stays on the screen while its panel scrolls (Standard 1.2).
 *
 * WHAT THIS FILE IS FOR, AND WHY IT IS NOT A CLASS-NAME ASSERTION
 *   The change is one offset: `md:top-28`. That number is only correct while the Owner header is
 *   exactly 7rem tall, and nothing in the header says so — it is `py-3` plus `min-h-11` on the
 *   identity row and `min-h-11` on the sections bar, three independent decisions in a file this
 *   one does not touch. A spec that asserted the class string would pass forever while the header
 *   grew a row and the two bars began to overlap, which `OwnerConsole` itself names as the
 *   failure mode of pinning bars separately.
 *
 *   So this measures the REAL header, at every width the requester named, and fails when its
 *   height stops matching the offset the sub-bar is pinned to. The constant is enforced, not
 *   asserted.
 *
 * WHY THE PROBE AND NOT `/owner`
 *   The owner console needs a PIN and a database and this tier has neither. The header's height
 *   is a question about CSS composition, and the stylesheet is the same on every route — so `/`
 *   serves it and the real markup is measured against it. `data-density="dense"` is set on the
 *   probe because the console sets it on its shell, and it changes the type steps that the
 *   header's height is built from: without it the measurements are of a screen that never ships.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { CHIP_NAV_WRAP, CHIP_NAV_STICKY_MD } from '../../src/lib/chip-nav';

/** Every width the requester named, widest first. */
const WIDTHS = [1440, 1280, 1024, 834, 768, 430, 390, 375, 360, 320] as const;

/** Tailwind's `md`. At and above it the sub-bar pins; below it the row stays in normal flow. */
const MD = 768;

/**
 * The offset the sub-bar is pinned to: `calc(7rem + 1px)`.
 *
 * The 7rem is the two header rows (`py-3` + `min-h-11`, then `min-h-11`), which is why the
 * offset is written in rem and tracks text zoom. The `+ 1px` is the header's own `border-b`,
 * which does NOT scale — and which a first attempt at `top-28` forgot, leaving the row a pixel
 * under the border. This spec measured 113px and rejected it.
 */
const OFFSET_REM = 7;
const OFFSET_BORDER_PX = 1;

/** The ten Settings panels, in the order the design fixes them. */
const PANELS = [
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

const SECTIONS = [
  'Dashboard', 'Day setup', 'Live orders', 'Waitlist', 'Payments', 'Menu', 'Staff',
  'Tips', 'Expenses', 'Reports', 'Uplift', 'Settings', 'Audit log',
] as const;

/* Copied from `components/ui/atoms.tsx` deliberately, as the sibling spec does: this file is
 * about the OFFSET, and pinning the chip's own classes means a change to Chip cannot silently
 * alter what is being measured. */
const CHIP =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap ' +
  'rounded-full px-4 type-caption font-semibold transition-colors';

interface Measured {
  headerH: number;
  rootFontPx: number;
  navTopWhenScrolled: number;
  navBottomWhenScrolled: number;
  offscreen: string[];
  clipped: string[];
  labels: string[];
  docScroll: number;
  docClient: number;
}

/**
 * Builds the real Owner header, the real sub-tab row and a page tall enough to scroll, then
 * scrolls a long way down and reports where everything ended up.
 */
async function measureAt(page: import('@playwright/test').Page, width: number): Promise<Measured> {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');

  return page.evaluate(
    ({ navClass, stickyClass, chipClass, panels, sections }) => {
      document.querySelector('#sticky-probe')?.remove();
      const host = document.createElement('div');
      host.id = 'sticky-probe';
      host.setAttribute('data-density', 'dense');
      host.innerHTML = `
        <header id="pb-header" class="sticky top-0 z-30 border-b"
                style="border-color:var(--border);background:var(--surface)">
          <div class="mx-auto flex flex-wrap items-center gap-3 px-4 py-3"
               style="max-width:var(--layout-content-max-width)">
            <span class="type-body font-semibold">Jalsa Restaurant</span>
            <span class="type-caption">1 open · 1 awaiting closure · 0 requests</span>
            <span class="ml-auto flex items-center gap-3">
              <span class="type-caption">Javeed Ahmed · Owner / Admin</span>
              <button class="min-h-11 px-3">Sign out</button>
            </span>
          </div>
          <nav class="j-scroll-x mx-auto flex gap-1 px-4" style="max-width:var(--layout-content-max-width)">
            ${sections.map((s) => `<button class="relative min-h-11 whitespace-nowrap px-3 type-body">${s}</button>`).join('')}
          </nav>
        </header>
        <main class="mx-auto flex flex-col gap-4 px-4 py-5" style="max-width:var(--layout-content-max-width)">
          <div class="flex flex-col gap-4">
            <nav id="pb-subnav" class="${navClass} ${stickyClass}">
              ${panels.map((p) => `<button class="${chipClass}">${p}</button>`).join('')}
            </nav>
            <div style="height:3000px"></div>
          </div>
        </main>`;
      document.body.prepend(host);

      const header = host.querySelector('#pb-header') as HTMLElement;
      const subnav = host.querySelector('#pb-subnav') as HTMLElement;
      const headerH = Math.round(header.getBoundingClientRect().height);

      // Scroll well past the row's resting place, which is where the old behaviour lost it.
      window.scrollTo(0, 1200);

      const nb = subnav.getBoundingClientRect();
      const chips = [...subnav.querySelectorAll('button')] as HTMLElement[];

      const out = {
        headerH,
        rootFontPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
        navTopWhenScrolled: Math.round(nb.top),
        navBottomWhenScrolled: Math.round(nb.bottom),
        offscreen: chips
          .filter((c) => {
            const b = c.getBoundingClientRect();
            return b.right > window.innerWidth + 1 || b.left < -1;
          })
          .map((c) => (c.textContent ?? '').trim()),
        clipped: chips
          .filter((c) => c.scrollWidth > c.clientWidth + 1)
          .map((c) => (c.textContent ?? '').trim()),
        labels: chips.map((c) => (c.textContent ?? '').trim()),
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
      };
      window.scrollTo(0, 0);
      return out;
    },
    { navClass: CHIP_NAV_WRAP, stickyClass: CHIP_NAV_STICKY_MD, chipClass: CHIP, panels: [...PANELS], sections: [...SECTIONS] }
  );
}

/* ── The invariant the offset rests on ─────────────────────────────────────────────────────── */

for (const width of WIDTHS.filter((w) => w >= MD)) {
  test(`the Owner header is exactly the offset the sub-bar is pinned to, at ${width}px`, async ({ page }) => {
    const { headerH, rootFontPx } = await measureAt(page, width);
    // THIS is the assertion that makes `md:top-28` safe. If the header ever grows or shrinks,
    // this fails here rather than as an overlap somebody notices on a phone.
    expect(
      headerH,
      `the header must be ${OFFSET_REM}rem + ${OFFSET_BORDER_PX}px so that the offset lands the sub-bar flush beneath it`
    ).toBe(Math.round(OFFSET_REM * rootFontPx) + OFFSET_BORDER_PX);
  });
}

test('the header only stops being 7rem BELOW md — which is why the pin is scoped there', async ({ page }) => {
  // The honest reason for the `md:` scope, measured rather than asserted. The identity row wraps
  // at narrow widths, so no single offset could be correct across every width.
  const narrow = await measureAt(page, 320);
  expect(narrow.headerH, 'at 320px the identity row wraps and the header grows').toBeGreaterThan(
    Math.round(OFFSET_REM * narrow.rootFontPx) + OFFSET_BORDER_PX
  );
});

/* ── The behaviour itself ──────────────────────────────────────────────────────────────────── */

for (const width of WIDTHS.filter((w) => w >= MD)) {
  test(`the sub-tab row is still on screen after scrolling at ${width}px`, async ({ page }) => {
    const m = await measureAt(page, width);
    // Pinned flush beneath the header, not under it and not over it.
    expect(m.navTopWhenScrolled, 'the row sits exactly below the header while scrolled').toBe(m.headerH);
    expect(m.navBottomWhenScrolled, 'and is wholly within the viewport').toBeLessThanOrEqual(800);
  });
}

for (const width of WIDTHS.filter((w) => w < MD)) {
  test(`below md the row keeps its shipped behaviour and scrolls away at ${width}px`, async ({ page }) => {
    const m = await measureAt(page, width);
    // Deliberately NOT pinned: pinning it here would leave almost no content on the screen.
    expect(m.navTopWhenScrolled, 'the row scrolls with the page, exactly as it shipped').toBeLessThan(0);
  });
}

/* ── Nothing was lost to the change ────────────────────────────────────────────────────────── */

for (const width of WIDTHS) {
  test(`all ten Settings tabs are whole and reachable at ${width}px`, async ({ page }) => {
    const m = await measureAt(page, width);
    expect(m.labels, 'every panel still renders, in the design\'s order').toEqual([...PANELS]);
    expect(m.offscreen, 'no tab may sit outside the viewport').toEqual([]);
    expect(m.clipped, 'no label may be truncated').toEqual([]);
    expect(m.docScroll, 'and the page must not scroll sideways').toBeLessThanOrEqual(m.docClient + 1);
  });
}

test('Printers & machines — the tenth and longest label — is reachable at the narrowest width', async ({ page }) => {
  // Named by the requester, and the label the pre-`flex-wrap` bug hid. Checked on its own so the
  // failure names it rather than reporting an array diff.
  const m = await measureAt(page, 320);
  expect(m.labels).toContain('Printers & machines');
  expect(m.offscreen).not.toContain('Printers & machines');
  expect(m.clipped).not.toContain('Printers & machines');
});
