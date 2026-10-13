/**
 * One check for an Edit or Delete opener drawn as an icon (13-Oct-2026, JP-24), shared by the render
 * specs that mount the screens carrying one: no word on it, a visible icon in the colour token it is
 * meant to wear, the word kept as its accessible name and tooltip, and a 44px target.
 *
 * The colour is compared with the token RESOLVED in the page's current theme (a probe element given
 * `color: var(<token>)`), never with "not transparent" - `currentColor` is never transparent, so that
 * assertion could not fail.
 */
import { expect, type Page } from '@playwright/test';

export async function resolvedColour(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${t})`;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, token);
}

export async function expectIconAction(page: Page, testId: string, name: string, colourToken: string): Promise<void> {
  const button = page.getByTestId(testId);
  await expect(button, testId).toBeVisible();
  await expect(button, testId).toHaveText('');
  const icon = button.locator('svg');
  await expect(icon, testId).toBeVisible();
  await expect(icon, testId).toHaveAttribute('stroke-width', '2.75');
  const want = await resolvedColour(page, colourToken);
  expect(want, `${colourToken} resolves`).toMatch(/^rgb/);
  expect(await icon.evaluate((el) => getComputedStyle(el).color), `${testId} wears ${colourToken}`).toBe(want);
  await expect(button, testId).toHaveAccessibleName(name);
  await expect(button, testId).toHaveAttribute('title', name);
  const box = await button.boundingBox();
  expect(box!.width, testId).toBeGreaterThanOrEqual(44);
  expect(box!.height, testId).toBeGreaterThanOrEqual(44);
  // On the screen, not pushed past its right edge (a wrapped footer, a cell too narrow).
  const width = page.viewportSize()!.width;
  expect(box!.x, testId).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, testId).toBeLessThanOrEqual(width + 1);
}
