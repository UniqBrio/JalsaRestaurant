/**
 * Colour maths shared by every theme script. WCAG 2.2 relative luminance + contrast ratio.
 * Deliberately dependency-free: a quality gate you cannot run in a bare CI container is a gate
 * that gets skipped.
 */

/** Parse #rgb, #rrggbb, #rrggbbaa, rgb(), rgba() -> {r,g,b,a} with 0-255 channels. */
export function parseColor(input) {
  if (typeof input !== 'string') throw new Error(`Not a colour: ${JSON.stringify(input)}`);
  const s = input.trim().toLowerCase();

  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error(`Bad hex colour: ${input}`);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const fn = s.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) throw new Error(`Bad rgb colour: ${input}`);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  throw new Error(`Unsupported colour format: ${input}. Use #hex or rgb()/rgba().`);
}

/**
 * Flatten a translucent colour onto an opaque backdrop.
 * Contrast is undefined for a transparent colour - what the eye sees is the composite.
 * Refusing to composite is how a "passing" scrim ships unreadable.
 */
export function composite(fg, bg) {
  if (fg.a >= 1) return fg;
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function luminance(color) {
  const c = typeof color === 'string' ? parseColor(color) : color;
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/**
 * WCAG contrast ratio, 1..21. Translucent inputs are composited before measuring.
 */
export function contrastRatio(fgInput, bgInput) {
  let fg = typeof fgInput === 'string' ? parseColor(fgInput) : fgInput;
  let bg = typeof bgInput === 'string' ? parseColor(bgInput) : bgInput;
  if (bg.a < 1) bg = composite(bg, { r: 255, g: 255, b: 255, a: 1 });
  if (fg.a < 1) fg = composite(fg, bg);
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Round the way a report should: never round 4.49 up into a pass. */
export const floorTo = (n, dp = 2) => Math.floor(n * 10 ** dp) / 10 ** dp;

/** Suggest the nearest passing variant by walking lightness - used only in failure messages. */
export function suggest(fgHex, bgHex, target) {
  const bg = parseColor(bgHex);
  const goDarker = luminance(bg) > 0.5;
  let c = parseColor(fgHex);
  for (let i = 0; i < 120; i++) {
    if (contrastRatio(c, bg) >= target) break;
    const step = goDarker ? -3 : 3;
    c = {
      r: Math.min(255, Math.max(0, c.r + step)),
      g: Math.min(255, Math.max(0, c.g + step)),
      b: Math.min(255, Math.max(0, c.b + step)),
      a: 1,
    };
  }
  const hex = '#' + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  return contrastRatio(c, bg) >= target ? hex.toUpperCase() : null;
}
