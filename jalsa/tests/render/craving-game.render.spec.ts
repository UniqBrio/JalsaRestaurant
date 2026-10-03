/**
 * The order-placed game, mounted for real (03-Oct-2026).
 *
 * The REAL CravingGame (tests/render/mounts/craving.entry.tsx) is bundled and mounted on a page
 * carrying the application's stylesheet, for an order of three dishes. The spec plays it: what
 * falls, what a dish and a germ do to the score, what the level changes, and the plate.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';
import { CATCH_POINTS, ENEMY_PENALTY, LEVELS } from '../../src/lib/craving';

const ENTRY = fileURLToPath(new URL('./mounts/craving.entry.tsx', import.meta.url));
const ORDER = [
  { id: 'k1', name: 'Chicken Biryani', foodType: 'non_veg' },
  { id: 'k2', name: 'Butter Naan', foodType: 'veg' },
  { id: 'k3', name: 'Mango Lassi', foodType: 'other' },
];
const NAMES = ORDER.map((o) => o.name);

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, width = 390) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((order) => {
    (window as unknown as { __order: unknown }).__order = order;
  }, ORDER);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('craving-offer')).toBeVisible();
}

test('the offer names the order\'s own dishes, the germ, and three levels', async ({ page }) => {
  await mount(page);
  const offer = page.getByTestId('craving-offer');
  await expect(offer).toContainText('Catch your ordered food. Avoid the bad item!');
  await expect(page.getByTestId('craving-offer-items')).toContainText('🍛 Chicken Biryani');
  await expect(page.getByTestId('craving-offer-items')).toContainText('🫓 Butter Naan');
  await expect(page.getByTestId('craving-offer-items')).toContainText('🥛 Mango Lassi');
  await expect(page.getByTestId('craving-offer-items')).toContainText('🦠');
  for (const l of ['easy', 'moderate', 'hard']) await expect(page.getByTestId(`craving-start-${l}`)).toBeVisible();
});

test('only the order\'s dishes and the germ fall, at the level\'s speed, onto a plate', async ({ page }) => {
  await mount(page);
  await page.getByTestId('craving-start-hard').click();
  await expect(page.getByTestId('craving-playing')).toHaveAttribute('data-level', 'hard');
  // Collect what falls for a few seconds.
  const seen = new Set<string>();
  const durations = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    for (const d of await page.locator('[data-testid="craving-food"], [data-testid="craving-enemy"]').evaluateAll((els) =>
      els.map((e) => ({ kind: e.getAttribute('data-testid'), text: e.textContent ?? '', dur: (e as HTMLElement).style.animationDuration }))
    )) {
      seen.add(d.kind === 'craving-enemy' ? 'ENEMY' : d.text);
      durations.add(d.dur);
    }
  }
  expect(seen.size).toBeGreaterThan(0);
  for (const s of seen) {
    if (s === 'ENEMY') continue;
    expect(NAMES.some((n) => s.endsWith(n)), `"${s}" is one of the order's dishes`).toBe(true);
  }
  expect([...durations]).toEqual([`${LEVELS.hard.fallMs}ms`]);

  // The plate: a white oval, inside the area, as wide as the level says.
  const plate = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="craving-plate"]') as HTMLElement;
    const a = document.querySelector('[data-testid="craving-area"]') as HTMLElement;
    const cs = getComputedStyle(p);
    const pb = p.getBoundingClientRect();
    const ab = a.getBoundingClientRect();
    return { width: p.style.width, radius: cs.borderTopLeftRadius, inside: pb.left >= ab.left - 1 && pb.right <= ab.right + 1 && pb.bottom <= ab.bottom + 1, bg: cs.backgroundColor, rim: cs.borderTopWidth };
  });
  expect(plate.width).toBe(`${LEVELS.hard.plateWidthPct}%`);
  expect(plate.radius).toBe('50%');
  expect(plate.rim).toBe('2px');
  expect(plate.inside).toBe(true);
});

test('Easy and Hard are different games: plate width and fall time', async ({ page }) => {
  await mount(page);
  await page.getByTestId('craving-start-easy').click();
  await expect(page.getByTestId('craving-plate')).toHaveAttribute('style', new RegExp(`width: ${LEVELS.easy.plateWidthPct}%`));
  await expect(page.locator('[data-testid="craving-food"], [data-testid="craving-enemy"]').first()).toHaveAttribute(
    'style',
    new RegExp(`animation-duration: ${LEVELS.easy.fallMs}ms`)
  );
});

test.describe('reduced motion: the same rules, tapped', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a dish scores, the germ costs points and a life, three germs end the game with a final score', async ({ page }) => {
    await mount(page);
    await page.getByTestId('craving-start-easy').click();
    await expect(page.getByTestId('craving-reduced')).toBeVisible();
    const score = page.getByTestId('craving-live-score');
    const lives = page.getByTestId('craving-lives');
    await expect(score).toHaveText('0 points');
    await expect(lives).toHaveText('Lives 3');

    await page.getByTestId('craving-tap-k1').click();
    await page.getByTestId('craving-tap-k2').click();
    await expect(score).toHaveText(`${2 * CATCH_POINTS} points`);
    await expect(page.getByTestId('craving-event')).toHaveText(`+${CATCH_POINTS} Butter Naan`);

    await page.getByTestId('craving-tap-enemy').click();
    await expect(score).toHaveText(`${Math.max(0, 2 * CATCH_POINTS - ENEMY_PENALTY)} points`);
    await expect(lives).toHaveText('Lives 2');
    await expect(page.getByTestId('craving-event')).toHaveText(`Germ! −${ENEMY_PENALTY}`);

    await page.getByTestId('craving-tap-enemy').click();
    await page.getByTestId('craving-tap-enemy').click();
    await expect(page.getByTestId('craving-done')).toBeVisible();
    await expect(page.getByTestId('craving-out')).toHaveText('Three germs on the plate — that round is over.');
    await expect(page.getByTestId('craving-final-score')).toHaveText('0 points · Easy');
    await expect(page.getByTestId('craving-score')).toHaveText('You caught 2 dishes and 3 germs.');
    // And only the order's dishes were offered to tap.
    expect(await page.evaluate(() => (window as unknown as { __phases: string[] }).__phases)).toEqual(['playing', 'done']);

    // "Play again" starts a second game rather than removing the card (review, 03-Oct-2026).
    await page.getByTestId('craving-again-hard').click();
    await expect(page.getByTestId('craving-playing')).toHaveAttribute('data-level', 'hard');
    await expect(page.getByTestId('craving-live-score')).toHaveText('0 points');
  });
});

test('the game never widens the page at 320px', async ({ page }) => {
  await mount(page, 320);
  await page.getByTestId('craving-start-moderate').click();
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  expect(m.s).toBeLessThanOrEqual(m.c + 1);
});
