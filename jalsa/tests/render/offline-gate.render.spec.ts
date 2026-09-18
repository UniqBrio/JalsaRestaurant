/**
 * The offline gate, measured at the six widths the requester named.
 *
 * WHAT ROUND 1 LEFT UNPROVEN
 *   It produced 23 unit cases and no render cases at all. "No horizontal scrolling, no clipped
 *   text, no oversized illustration" was a claim about a 64px circle, an h1, three paragraphs and
 *   two full-width actions in a `max-w-[26rem] px-6 min-h-dvh` column — and **320px was never
 *   measured**. A layout question belongs to a layout engine, so the real classes go on a real
 *   page with the real stylesheet and the boxes are measured.
 *
 * 320px IS THE ONE THAT MATTERS. It is the narrowest the requester named and the width where a
 * side-by-side pair of actions gives "Call captain" about 130px. The column the component uses is
 * not an accident, and this is what holds it to it.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026, round 2) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import {
  OFFLINE_BODY,
  OFFLINE_CALL,
  OFFLINE_CALL_NOTE,
  OFFLINE_HINT,
  OFFLINE_RETRY,
  OFFLINE_TITLE,
} from '../../src/lib/connectivity';

/** Every width the requester named. The heights are ordinary phones of each width. */
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
] as const;

/* ── The classes, copied from states.tsx `OfflineGate` ─────────────────────────────────────── */

const SHELL = 'mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-4 px-6 text-center';
const GLYPH =
  'mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-sunken)]';
const ACTIONS = 'mt-2 flex flex-col gap-2';
const RETRY =
  'inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-6 type-body font-semibold text-[var(--on-primary)]';
const CALL =
  'inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--border-strong)]/40 px-6 type-body font-semibold text-[var(--text-body)]';

/** A real Indian mobile number's shape — the longest thing the call button can be asked to hold. */
const NUMBER = '+91 94425 71830';

const html = (withNumber: boolean): string => `
  <div class="${SHELL}" data-probe="shell">
    <span aria-hidden class="${GLYPH}" data-probe="glyph"><img src="/brand/jalsa-badge.png" alt="" class="h-10 w-10 object-contain"></span>
    <h1 class="type-h2 font-semibold" data-probe="title">${OFFLINE_TITLE}</h1>
    <p class="m-0 type-body leading-relaxed text-[var(--text-muted)]" data-probe="body">${OFFLINE_BODY}</p>
    <p class="m-0 type-body leading-relaxed text-[var(--text-muted)]" data-probe="hint">${OFFLINE_HINT}</p>
    <div class="${ACTIONS}" data-probe="actions">
      <button type="button" class="${RETRY}" data-probe="retry">${OFFLINE_RETRY}</button>
      ${
        withNumber
          ? `<a class="${CALL}" data-probe="call" href="tel:${NUMBER.replace(/\s+/g, '')}">${OFFLINE_CALL}</a>`
          : ''
      }
    </div>
    <p class="m-0 type-caption leading-relaxed text-[var(--text-muted)]" data-probe="note">Your table and your bill are held on our side, not on your phone — nothing is lost. ${OFFLINE_CALL_NOTE}</p>
  </div>`;

interface Measured {
  docScroll: number;
  docClient: number;
  /** Any element whose box escapes its own container sideways. */
  escaping: string[];
  /** Any text node that is CUT OFF rather than wrapped. */
  clipped: string[];
  /** Any interactive box under the 44px thumb floor. */
  shortTargets: string[];
  /** The glyph's diameter against the viewport width, as a percentage. */
  glyphPctOfWidth: number;
  /** Whether the whole screen fits without the page scrolling vertically either. */
  verticalOverflowPx: number;
  actionWidths: number[];
}

async function measure(
  page: import('@playwright/test').Page,
  vp: { width: number; height: number },
  withNumber: boolean
): Promise<Measured> {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto('/');
  return page.evaluate(
    ({ markup }) => {
      document.querySelector('#og-probe')?.remove();
      const host = document.createElement('div');
      host.id = 'og-probe';
      host.style.cssText = 'width:100%;box-sizing:border-box';
      host.innerHTML = markup;
      document.body.appendChild(host);

      const rect = (n: Element): DOMRect => n.getBoundingClientRect();
      const label = (n: Element): string =>
        `${n.getAttribute('data-probe') ?? n.tagName.toLowerCase()}:${(n.textContent ?? '').trim().slice(0, 28)}`;

      const escaping: string[] = [];
      for (const node of [...host.querySelectorAll('*')]) {
        const parent = node.parentElement;
        if (!parent || parent === host) continue;
        if (getComputedStyle(parent).overflowX !== 'visible') continue;
        const a = rect(node);
        const b = rect(parent);
        if (a.right > b.right + 1 || a.left < b.left - 1) escaping.push(label(node));
      }

      /* CLIPPED, not merely long. Text that wraps is fine; text whose scroll width exceeds its
         client width is text the guest cannot read, which on this screen is the sentence telling
         them what to do about it. */
      const clipped = [...host.querySelectorAll('[data-probe]')]
        .filter((n) => n.scrollWidth > n.clientWidth + 1)
        .map(label);

      const shell = host.querySelector('[data-probe="shell"]') as HTMLElement;
      const glyph = host.querySelector('[data-probe="glyph"]') as HTMLElement;

      return {
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        escaping,
        clipped,
        shortTargets: [...host.querySelectorAll('button,a')]
          .filter((b) => rect(b).height < 44)
          .map(label),
        glyphPctOfWidth: Math.round((rect(glyph).width / window.innerWidth) * 100),
        verticalOverflowPx: (() => {
          /* `min-h-dvh` makes the shell's own box exactly the viewport whenever the content is
             shorter, so measuring the SHELL always reads 0 and proves nothing. What can overflow
             is the content: the sum of the children plus the gaps between them. */
          const kids = [...shell.children] as HTMLElement[];
          const gap = parseFloat(getComputedStyle(shell).rowGap) || 0;
          const content =
            kids.reduce((a, k) => a + rect(k).height, 0) + gap * Math.max(0, kids.length - 1);
          return Math.round(content - window.innerHeight);
        })(),
        actionWidths: [...host.querySelectorAll('[data-probe="actions"] > *')].map((b) =>
          Math.round(rect(b).width)
        ),
      };
    },
    { markup: html(withNumber) }
  );
}

for (const vp of VIEWPORTS) {
  const at = `${vp.width}x${vp.height}`;

  test(`the offline screen fits at ${at}, with the call action`, async ({ page }) => {
    const m = await measure(page, vp, true);
    expect(m.docScroll, 'no horizontal scrolling — binding').toBeLessThanOrEqual(m.docClient + 1);
    expect(m.escaping, 'nothing escapes its container').toEqual([]);
    expect(m.clipped, 'no clipped text').toEqual([]);
    expect(m.shortTargets, 'both actions are thumb targets').toEqual([]);
  });

  test(`the illustration is not oversized at ${at}`, async ({ page }) => {
    const m = await measure(page, vp, true);
    // 64px on a 320px phone is a fifth of the width. The requirement is "no oversized
    // illustration", and a fifth is the most this screen may spend on decoration when the
    // sentence underneath is the thing the customer has to act on.
    expect(m.glyphPctOfWidth, `${m.glyphPctOfWidth}% of the viewport`).toBeLessThanOrEqual(20);
  });

  test(`both actions are full width and equal at ${at}`, async ({ page }) => {
    const m = await measure(page, vp, true);
    expect(m.actionWidths).toHaveLength(2);
    /*
      WHAT ACTUALLY ENFORCES THIS, stated because the obvious answer is wrong.

      The two actions carry `w-full`, and removing it changes nothing: a `flex-col` container
      stretches its children by default, so the width comes from the COLUMN, not from the class.
      Injecting "drop w-full" therefore did not fail this case, and that is recorded as an honest
      negative in TEST_SUMMARY.md rather than dressed up.

      The defect this case really catches is the direction: `flex-row` instead of `flex-col`, at
      which point 320px gives each action about 130px and "Call captain" is clipped. So the
      direction is asserted too, beside the measurement it causes.
    */
    expect(ACTIONS, 'stacked, not side by side').toContain('flex-col');
    expect(m.actionWidths[0]).toBe(m.actionWidths[1]);
    expect(m.actionWidths[0] ?? 0).toBeGreaterThanOrEqual(Math.min(vp.width, 416) - 60);
  });

  test(`the whole screen is readable without scrolling at ${at}`, async ({ page }) => {
    const m = await measure(page, vp, true);
    /* `min-h-dvh` + `justify-center` centres the column in the viewport, so anything taller than
       the viewport is content pushed off BOTH ends — the title above the fold and the actions
       below it, with no scrollbar hint that either exists. 320x568 is the tightest case. */
    expect(m.verticalOverflowPx, `the column is ${m.verticalOverflowPx}px taller than the screen`).toBeLessThanOrEqual(
      0
    );
  });

  test(`it still fits at ${at} when no number is configured`, async ({ page }) => {
    const m = await measure(page, vp, false);
    expect(m.docScroll).toBeLessThanOrEqual(m.docClient + 1);
    expect(m.clipped).toEqual([]);
    expect(m.actionWidths, 'Try again alone').toHaveLength(1);
  });
}

/* ── Contrast, computed, both themes ───────────────────────────────────────────────────────── */

function srgb(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function lum(p: number[]): number {
  return 0.2126 * srgb(p[0] ?? 0) + 0.7152 * srgb(p[1] ?? 0) + 0.0722 * srgb(p[2] ?? 0);
}
function ratio(fg: number[], bg: number[]): number {
  const [hi, lo] = lum(fg) > lum(bg) ? [lum(fg), lum(bg)] : [lum(bg), lum(fg)];
  return (hi + 0.05) / (lo + 0.05);
}

for (const theme of ['light', 'dark'] as const) {
  for (const [probe, min, what] of [
    ['title', 4.5, 'the offline heading'],
    ['body', 4.5, 'the sentence telling them what to do'],
    ['retry', 4.5, 'Try again'],
    ['call', 4.5, 'Call captain'],
    ['note', 4.5, 'the reassurance note'],
  ] as const) {
    test(`contrast — ${what} meets ${min}:1 in the ${theme} theme`, async ({ page }) => {
      /* Set BEFORE navigation, through the key the no-flash script reads, so `data-theme` is on
         the root in the first paint — otherwise `transition-colors` is still running and
         getComputedStyle samples a blend of the two themes. */
      await page.addInitScript((t) => localStorage.setItem('app.theme', t), theme);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.evaluate(
        ({ markup }) => {
          document.querySelector('#og-probe')?.remove();
          const host = document.createElement('div');
          host.id = 'og-probe';
          host.innerHTML = markup;
          document.body.appendChild(host);
        },
        { markup: html(true) }
      );

      const found = await page.locator(`[data-probe="${probe}"]`).count();
      expect(found, 'a contrast assertion that matched nothing is not a passing one').toBeGreaterThan(0);

      const s = await page.$eval(`[data-probe="${probe}"]`, (el) => {
        const px = (v: string): number[] => (v.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
        const layers: number[][] = [];
        let node: Element | null = el;
        let base: number[] = [255, 255, 255];
        while (node) {
          const c = px(getComputedStyle(node).backgroundColor);
          const a = c[3] ?? 1;
          if (a > 0) {
            if (a >= 0.999) {
              base = c.slice(0, 3);
              break;
            }
            layers.push(c);
          }
          node = node.parentElement;
        }
        let bg = base;
        for (const l of layers.reverse()) {
          const a = l[3] ?? 1;
          bg = [0, 1, 2].map((i) => Math.round((l[i] ?? 0) * a + (bg[i] ?? 0) * (1 - a)));
        }
        return { fg: px(getComputedStyle(el).color).slice(0, 3), bg, text: (el.textContent ?? '').trim().slice(0, 36) };
      });

      const r = ratio(s.fg, s.bg);
      expect(r, `"${s.text}" — rgb(${s.fg.join(',')}) on rgb(${s.bg.join(',')}) = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        min
      );
    });
  }
}

/* ── ROUND 3: the Jalsa mark, measured rather than assumed ─────────────────────────────────── */

for (const vp of VIEWPORTS) {
  test(`the Jalsa mark loads and stays inside its circle at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    const box = await page.evaluate(
      ({ markup }) => {
        document.querySelector('#og-probe')?.remove();
        const host = document.createElement('div');
        host.id = 'og-probe';
        host.innerHTML = markup;
        document.body.appendChild(host);
        const circle = host.querySelector('[data-probe="glyph"]') as HTMLElement;
        const img = circle.querySelector('img') as HTMLImageElement;
        return new Promise<{ w: number; h: number; natural: number; fits: boolean }>((resolve) => {
          const done = (): void => {
            const c = circle.getBoundingClientRect();
            const i = img.getBoundingClientRect();
            resolve({
              w: Math.round(c.width),
              h: Math.round(c.height),
              natural: img.naturalWidth,
              fits: i.width <= c.width + 1 && i.height <= c.height + 1,
            });
          };
          if (img.complete) done();
          else {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }
        });
      },
      { markup: html(true) }
    );

    // The file is really there and really decodes — a mark that 404s is the broken image this
    // screen must not show, and `alt=""` means nothing would appear in its place to say so.
    expect(box.natural, '/brand/jalsa-badge.png must load').toBeGreaterThan(0);
    expect(box.fits, 'the mark stays inside its circle').toBe(true);
    // Still a fifth of a 320px screen at most — "no heavy images".
    expect(box.w).toBe(64);
  });
}

test('the mark is served from this origin, so it needs no network to appear', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.get('/brand/jalsa-badge.png');
  expect(res.status(), 'a 404 here is a broken image on the offline screen').toBe(200);
  expect(res.headers()['content-type'] ?? '').toContain('image');
});
