/**
 * Catch Your Craving on the order-placed screen, mounted for real (03-Oct-2026; revised
 * 04-Oct-2026 - one Play, the menu of the table's kind falls, and - second round - no clock: five
 * lives, a dropped dish costs one, and every 100 points is a faster level).
 *
 * The REAL CravingGame (tests/render/mounts/craving.entry.tsx) is bundled and mounted on a page
 * carrying the application's stylesheet, for a NON-VEG table and a menu of every kind. The spec
 * plays it: what falls, how it climbs, what a dish and a germ do to the score, and the plate.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';
import { CATCH_POINTS, CRAVING_LIVES, ENEMY_PENALTY, levelRules } from '../../src/lib/craving';

const ENTRY = fileURLToPath(new URL('./mounts/craving.entry.tsx', import.meta.url));
const MENU = [
  { id: 'n1', name: 'Chicken Biryani', foodType: 'non_veg', available: true },
  { id: 'n2', name: 'Mutton Biryani', foodType: 'non_veg', available: true },
  { id: 'n3', name: 'Chicken 65', foodType: 'non_veg', available: true },
  { id: 'n4', name: 'Fish Fry', foodType: 'non_veg', available: false },
  { id: 'v1', name: 'Paneer Tikka', foodType: 'veg', available: true },
  { id: 'v2', name: 'Butter Naan', foodType: 'veg', available: true },
  { id: 'e1', name: 'Egg Curry', foodType: 'egg', available: true },
  { id: 'o1', name: 'Mango Lassi', foodType: 'other', available: true },
];
const NON_VEG_AVAILABLE = ['Chicken Biryani', 'Mutton Biryani', 'Chicken 65'];

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

async function mount(page: Page, width = 390) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate((menu) => {
    (window as unknown as { __route: string }).__route = 'nonVeg';
    (window as unknown as { __menu: unknown }).__menu = menu;
  }, MENU);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('craving-offer')).toBeVisible();
}

test('the offer is "Catch Your Craving", names the kind that falls, and has one small Play', async ({ page }) => {
  await mount(page);
  const offer = page.getByTestId('craving-offer');
  await expect(offer).toContainText('Catch Your Craving');
  await expect(offer).not.toContainText('Hungry while you wait?');
  await expect(offer).toContainText('Catch the food. Avoid the bad item!');
  await expect(page.getByTestId('craving-offer-items')).toContainText('Every Non-veg dish on tonight');
  await expect(page.getByTestId('craving-offer-items')).toContainText('5 lives; every 100 points it gets faster.');
  await expect(page.getByTestId('craving-offer-items')).toContainText('🦠');
  await expect(page.getByTestId('craving-start')).toHaveText('Play');
  // No level picker: the guest does not choose one.
  await expect(page.locator('[data-testid^="craving-start-"]')).toHaveCount(0);
  // Small: the app's small button - 44 px, the touch-target floor, and no larger.
  const h = await page.getByTestId('craving-start').evaluate((b) => b.getBoundingClientRect().height);
  expect(h).toBeLessThanOrEqual(44);
  expect(h).toBeGreaterThanOrEqual(44);
});

test('only available dishes of the table\'s kind and the germ fall, and a dish dropped past the plate costs a life', async ({ page }) => {
  test.setTimeout(45_000);
  await mount(page);
  await page.getByTestId('craving-start').click();
  await expect(page.getByTestId('craving-level')).toHaveText('Level 1');
  await expect(page.getByTestId('craving-lives')).toHaveText(`Lives ${CRAVING_LIVES}`);
  await expect(page.getByTestId('craving-plate')).toHaveAttribute('style', new RegExp(`width: ${levelRules(1).plateWidthPct}%`));
  // Park the plate at the far left, so most dishes fall past it.
  const box = (await page.getByTestId('craving-area').boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();

  const seen = new Set<string>();
  const durations = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(300);
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
    expect(NON_VEG_AVAILABLE.some((n) => s.endsWith(n)), `"${s}" is an available Non-veg dish`).toBe(true);
  }
  expect([...durations]).toEqual([`${levelRules(1).fallMs}ms`]);

  // A dish that hit the floor took a life - and the game is still running.
  await expect(page.getByTestId('craving-lives')).not.toHaveText(`Lives ${CRAVING_LIVES}`, { timeout: 10_000 });
  await expect(page.getByTestId('craving-playing')).toBeVisible();

  // The plate: maroon-rimmed, inside the area.
  const plate = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="craving-plate"]') as HTMLElement;
    const a = document.querySelector('[data-testid="craving-area"]') as HTMLElement;
    const cs = getComputedStyle(p);
    const pb = p.getBoundingClientRect();
    const ab = a.getBoundingClientRect();
    return { radius: cs.borderTopLeftRadius, rim: cs.borderTopWidth, inside: pb.left >= ab.left - 1 && pb.right <= ab.right + 1 && pb.bottom <= ab.bottom + 1 };
  });
  expect(plate).toEqual({ radius: '50%', rim: '2px', inside: true });
});

test.describe('reduced motion: the same rules, tapped', () => {
  test.use({ reducedMotion: 'reduce' });

  test('dishes score, every 100 points is a new level, germs cost lives, five end it - and Play again starts another', async ({ page }) => {
    await mount(page);
    await page.getByTestId('craving-start').click();
    await expect(page.getByTestId('craving-reduced')).toBeVisible();
    // Only the available Non-veg dishes are offered to tap, and the germ.
    await expect(page.locator('[data-testid^="craving-tap-"]')).toHaveCount(4);
    await expect(page.getByTestId('craving-tap-v1')).toHaveCount(0);
    await expect(page.getByTestId('craving-tap-n4')).toHaveCount(0);
    const score = page.getByTestId('craving-live-score');
    const lives = page.getByTestId('craving-lives');
    await expect(score).toHaveText('0 points');
    await expect(lives).toHaveText(`Lives ${CRAVING_LIVES}`);

    await page.getByTestId('craving-tap-n1').click();
    await page.getByTestId('craving-tap-n2').click();
    await expect(score).toHaveText(`${2 * CATCH_POINTS} points`);
    await expect(page.getByTestId('craving-event')).toHaveText(`+${CATCH_POINTS} Mutton Biryani`);

    // Eight more dishes: 100 points, and the game climbs to Level 2 by itself.
    for (let i = 0; i < 8; i++) await page.getByTestId('craving-tap-n3').click();
    await expect(score).toHaveText('100 points');
    await expect(page.getByTestId('craving-level')).toHaveText('Level 2');
    await expect(page.getByTestId('craving-event')).toHaveText('Level up! Level 2 — faster now');

    await page.getByTestId('craving-tap-enemy').click();
    await expect(score).toHaveText(`${100 - ENEMY_PENALTY} points`);
    await expect(lives).toHaveText(`Lives ${CRAVING_LIVES - 1}`);
    await expect(page.getByTestId('craving-event')).toHaveText(`Germ! −${ENEMY_PENALTY} and −1 life`);

    for (let i = 1; i < CRAVING_LIVES; i++) await page.getByTestId('craving-tap-enemy').click();
    await expect(page.getByTestId('craving-done')).toBeVisible();
    await expect(page.getByTestId('craving-out')).toHaveText('Out of lives — that round is over.');
    await expect(page.getByTestId('craving-final-score')).toHaveText('25 points · reached Level 1');
    await expect(page.getByTestId('craving-score')).toHaveText('You caught 10 dishes and 5 germs.');

    // Play again starts a fresh game, back on Level 1 with five lives.
    await expect(page.getByTestId('craving-again')).toHaveText('Play again');
    await page.getByTestId('craving-again').click();
    await expect(page.getByTestId('craving-playing')).toBeVisible();
    await expect(page.getByTestId('craving-level')).toHaveText('Level 1');
    await expect(page.getByTestId('craving-live-score')).toHaveText('0 points');
    await expect(page.getByTestId('craving-lives')).toHaveText(`Lives ${CRAVING_LIVES}`);
  });

});

test('the game never widens the page at 320px', async ({ page }) => {
  await mount(page, 320);
  await page.getByTestId('craving-start').click();
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  expect(m.s).toBeLessThanOrEqual(m.c + 1);
});
