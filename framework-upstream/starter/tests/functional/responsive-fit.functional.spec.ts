/**
 * responsive-fit — DR-8's executable half: does the layout ADAPT, or does it merely fit?
 *
 * WHY THIS EXISTS ALONGSIDE narrow-width.functional.spec.ts, AND DOES NOT REPEAT IT
 *   That spec asks one question: does the page scroll sideways? This one asks the question that
 *   survives a "no". A form can fit its viewport perfectly and still be unusable — two fields
 *   sharing a 360px row are 150px each, nothing overflows, every accessibility assertion passes,
 *   and the screen is a mess. Overflow is necessary and nowhere near sufficient, and defining
 *   "responsive" as "does not overflow" is precisely the misunderstanding that lets a desktop
 *   arrangement ship to a phone. Horizontal overflow is therefore NOT asserted here; it has an
 *   owner already.
 *
 * THE RULE IT PINS, GENERALISED
 *   A value-entry control gets at least the declared practical minimum width — and when the form
 *   itself is narrower than that minimum, ONE control takes essentially all of it. What is
 *   forbidden is splitting a row below the minimum: that is the decision "keep the columns"
 *   being taken by default, at a width where it costs the user something.
 *
 *   Note what this does NOT say. It does not name a device, a breakpoint, or a field. "Phone
 *   fields are full width" would be an application rule that protects one screen; this protects
 *   any arrangement, at any width, in any application, including inside a narrow dialog on a
 *   wide monitor — which is a case no device breakpoint has ever caught.
 *
 * THE MINIMUM IS READ, NOT TYPED
 *   `layout.minFieldWidth` comes from design/tokens.json, the same file the `.form-grid` rule
 *   is generated from. If the number is ever changed, the CSS and this check move together. A
 *   threshold restated in a spec is a threshold that silently drifts from the layout it polices,
 *   and then passes because both sides moved.
 *
 * FAIL-FIRST EVIDENCE: see TEST_SUMMARY.md for the run against the pre-change tree.
 *
 * WHAT IS NOT COVERED, HONESTLY
 *   Helper and validation text expanding without clipping is part of DR-8 and is NOT asserted
 *   here: the reference form has no helper or error text to measure, and an assertion over an
 *   empty set is a green light for nothing. It is carried as review until a worked example
 *   exists. Grouping *comprehension* — whether the stacked order still reads as a group — is
 *   design review by nature and declared as such in DR-8.
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';

/**
 * The declared practical minimum, from the one file that owns it. Resolved from `import.meta.url`
 * rather than `__dirname`, which does not exist in an ES module — and rather than a path relative
 * to the working directory, which would make the spec pass or fail depending on where it was
 * invoked from (CP-31's neighbouring trap).
 */
const tokens = JSON.parse(
  fs.readFileSync(new URL('../../design/tokens.json', import.meta.url), 'utf8'),
);
const rem = (v: string) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));
const MIN_FIELD = rem(tokens.layout.minFieldWidth);
const MIN_TOUCH = rem(tokens.layout.minTouchTarget);
const MIN_SUPPORTED = rem(tokens.layout.minSupportedWidth);

/**
 * The materially relevant range — the narrowest width the product SUPPORTS (from the token, not
 * a guess), a common phone, a large phone, a tablet and a laptop. The point is the RANGE and the
 * transitions inside it: a layout that is correct at 360 and at 1280 can still be wrong at 414,
 * which is where a two-column rule usually switches at the wrong moment.
 */
const WIDTHS = [MIN_SUPPORTED, 360, 414, 768, 1280];

const SESSION = { user: { id: 'u-1', email: 't@t.t' }, roles: ['admin'] };
const record = { id: 'r-1', name: 'Existing item', status: 'active' };

async function boot(page: Page) {
  await page.addInitScript((s) => localStorage.setItem('session', JSON.stringify(s)), SESSION);
  await page.route('**/api/**', (route: Route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { data: [record] } });
    return route.fulfill({ json: { data: { id: 'r-new' } } });
  });
  await page.goto('/');
}

/** Value-entry controls: the things a person types or chooses INTO. Buttons are not these. */
const ENTRY = [
  'input:not([type=checkbox]):not([type=radio]):not([type=hidden])',
  'textarea',
  'select',
  '[role=combobox]',
  '[aria-haspopup=listbox]',
].join(',');

async function measureForm(page: Page, entrySelector: string) {
  return page.evaluate((sel) => {
    const form = document.querySelector('form');
    if (!form) return null;
    const fs_ = getComputedStyle(form);
    const formWidth = form.clientWidth - parseFloat(fs_.paddingLeft) - parseFloat(fs_.paddingRight);
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const controls = [...form.querySelectorAll(sel)].filter(visible).map((e) => ({
      id: e.getAttribute('data-testid') ?? e.tagName.toLowerCase(),
      width: e.getBoundingClientRect().width,
    }));
    const labels = [...form.querySelectorAll('label,legend,.field__label')].filter(visible).map((e) => ({
      id: (e.textContent ?? '').trim().slice(0, 24),
      scrollWidth: e.scrollWidth,
      clientWidth: e.clientWidth,
    }));
    const pressable = [...form.querySelectorAll('button')].filter(visible).map((e) => ({
      id: e.getAttribute('data-testid') ?? 'button',
      height: e.getBoundingClientRect().height,
    }));
    return { formWidth, controls, labels, pressable };
  }, entrySelector);
}

test.describe('DR-8 — the arrangement follows the available space, not the device', () => {
  test('no value-entry control is cramped at any width in the supported range', async ({ page }) => {
    await boot(page);
    await page.getByTestId('item-edit-r-1').click();
    await expect(page.getByTestId('item-form-mode')).toBeVisible();

    let measured = 0;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      const m = await measureForm(page, ENTRY);
      expect(m, `no <form> found at ${width}px`).not.toBeNull();

      /* When the form is narrower than the declared minimum there is nothing to share, so the
         requirement becomes "one control takes the room there is". Above it, the minimum bites. */
      const floor = Math.min(MIN_FIELD, m!.formWidth * 0.9);
      for (const c of m!.controls) {
        measured++;
        expect(
          c.width,
          `${c.id} is ${Math.round(c.width)}px inside a ${Math.round(m!.formWidth)}px form at `
          + `${width}px — below the ${Math.round(floor)}px floor, so the arrangement did not adapt`,
        ).toBeGreaterThanOrEqual(floor - 1);
      }
    }

    /* The companion assertion. A selector that matched nothing would have passed every loop
       above in silence, which is indistinguishable from a form with no cramped controls. */
    expect(measured, 'no value-entry controls were measured — this run proved nothing').toBeGreaterThan(0);
  });

  test('a label is never clipped by its own container', async ({ page }) => {
    await boot(page);
    await page.getByTestId('item-edit-r-1').click();
    await expect(page.getByTestId('item-form-mode')).toBeVisible();

    let measured = 0;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      const m = await measureForm(page, ENTRY);
      for (const l of m!.labels) {
        measured++;
        // A clipped label is worse than a wrapped one: the user cannot tell what the field is,
        // and an ellipsis at least admits it. This catches neither-wrapping-nor-admitting.
        expect(
          l.scrollWidth,
          `label "${l.id}" needs ${l.scrollWidth}px in ${l.clientWidth}px at ${width}px`,
        ).toBeLessThanOrEqual(l.clientWidth + 1);
      }
    }
    expect(measured, 'no labels were measured — this run proved nothing').toBeGreaterThan(0);
  });

  test('every button in the form stays operable at every width', async ({ page }) => {
    await boot(page);
    await page.getByTestId('item-edit-r-1').click();
    await expect(page.getByTestId('item-form-mode')).toBeVisible();

    let measured = 0;
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      const m = await measureForm(page, ENTRY);
      for (const b of m!.pressable) {
        measured++;
        expect(
          b.height,
          `${b.id} is ${Math.round(b.height)}px tall at ${width}px, under the declared `
          + `${MIN_TOUCH}px target`,
        ).toBeGreaterThanOrEqual(MIN_TOUCH - 1);
      }
    }
    expect(measured, 'no buttons were measured — this run proved nothing').toBeGreaterThan(0);
  });
});
