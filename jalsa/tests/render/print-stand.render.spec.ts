/**
 * "Print both faces" - what reaches PAPER (12-Oct-2026).
 *
 * The REAL TableStandSheet is mounted on a page carrying the app's stylesheet (so the print rules
 * in globals.css are the ones shipped, after the CSS build), then laid out for print and printed
 * to PDF by Chromium - the engine behind the owner's browser.
 *
 * ROOT CAUSE it pins: the modal is centred with Tailwind v4's `translate` property; the print
 * stylesheet reset only `transform`, so on paper the dialog stayed shifted up and left by half its
 * size - the title and the front face fell off the page and the back face printed where the front
 * should be. A first fix that added `translate: none` beside `transform: none` did nothing: the
 * CSS build folds the two into `transform: translate3d(0,0,0)`. Then the two faces, side by side
 * in a grid, both moved to page 2 behind the page break; and a dark console printed light text.
 *
 * FAIL-FIRST (observed 12-Oct-2026, `src/` stashed to the previous tree): 4 of 5 fail - both paper
 * cases at `translate` (Expected "none", Received "-50% -50%"; probed: the front face at left=-680
 * top=-297, the PDF's first page holding only the back face), the dark-theme print (printed in
 * dark), and the printOnPaper pin. NOT OBSERVED FAILING, by design: printing from the light theme.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/print-stand.entry.tsx', import.meta.url));
let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

const SQUARE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

async function mount(page: Page, width: number, theme: 'light' | 'dark') {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/owner/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: SQUARE }));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('owner-stand-front')).toBeVisible();
}

for (const width of [1400, 390]) {
  test(`on paper both faces sit on the page, one per sheet (console ${width}px wide)`, async ({ page }) => {
    await mount(page, width, 'light');
    await page.emulateMedia({ media: 'print' });
    const box = await page.evaluate(() => {
      const r = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
      const front = r('owner-stand-front');
      const back = r('owner-stand-back');
      const dialog = document.querySelector('[role="dialog"]')!;
      return {
        front: { left: front.left, top: front.top, right: front.right },
        back: { left: back.left, top: back.top },
        width: document.documentElement.clientWidth,
        translate: getComputedStyle(dialog).translate,
        title: getComputedStyle(dialog.querySelector('header')!).display,
      };
    });
    // Nothing shifted off the paper.
    expect(box.translate).toBe('none');
    expect(box.front.left).toBeGreaterThanOrEqual(0);
    expect(box.front.top).toBeGreaterThanOrEqual(0);
    expect(box.front.right).toBeLessThanOrEqual(box.width + 1);
    // One column: the back is under the front, so the page break gives it its own sheet.
    expect(box.back.top).toBeGreaterThan(box.front.top);
    expect(Math.abs(box.back.left - box.front.left)).toBeLessThan(2);
    // The dialog's own title is the console's, not the card's.
    expect(box.title).toBe('none');

    // Chromium's own print: two pages, the front first.
    const pdf = (await page.pdf({ format: 'A4' })).toString('latin1');
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(2);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`Print both faces prints in the light theme and gives back the ${theme} one`, async ({ page }) => {
    await mount(page, 1400, theme);
    await page.getByTestId('owner-stand-print').click();
    expect(await page.evaluate(() => window.__printedIn)).toEqual(['light']);
    // The browser says the print is over: the person's own theme comes back.
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(theme);
  });
}

test('no screen prints with a bare window.print() - every Print button goes through printOnPaper', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['src/features/owner/TableStandSheet.tsx', 'src/features/owner/BillDetailSheet.tsx', 'src/features/owner/sections/StaffPaperwork.tsx']) {
    const s = readFileSync(f, 'utf8');
    expect(s, f).toContain('onClick={() => printOnPaper()}');
    expect(s, f).not.toContain('onClick={() => window.print()}');
  }
});
