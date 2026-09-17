/**
 * The computed-contrast measurement, shared by every render spec that needs it.
 *
 * WHY IT IS A MODULE AND NOT COPIED
 *   It was inline in `contrast.render.spec.ts` while that was the only spec measuring contrast.
 *   The moment a second one needed it (the searchable select's active row, DR-5) the choice was
 *   between importing this or pasting twenty lines of colour maths into another file - and two
 *   implementations of one formula drift, with the drifted one always the one someone reads
 *   first. That is the canonical-patterns rule applied to test code.
 */
import type { Page } from '@playwright/test';

function srgb(c: number) { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
function lum([r = 0, g = 0, b = 0]: number[]) { return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b); }

export function ratio(fg: number[], bg: number[]) {
  const [hi, lo] = lum(fg) > lum(bg) ? [lum(fg), lum(bg)] : [lum(bg), lum(fg)];
  return (hi + 0.05) / (lo + 0.05);
}

export const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

/** Walk ancestors until a non-transparent background is found - that is what the eye sees. */
export async function measure(page: Page, selector: string) {
  return page.$eval(selector, (el) => {
    const fg = getComputedStyle(el).color;
    let node: Element | null = el;
    let bg = 'rgba(0, 0, 0, 0)';
    while (node) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; }
      node = node.parentElement;
    }
    if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor;
    return { fg, bg, text: (el.textContent ?? '').trim() };
  });
}
