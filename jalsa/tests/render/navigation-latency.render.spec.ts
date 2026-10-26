/**
 * The first poll after a screen is served asks "changed?" — it does not rebuild what the server just
 * rendered (26-Oct-2026, requests/2026-10-26-navigation-latency.md, N-02).
 *
 * WHAT WENT WRONG: the owner and staff pages rendered their first screen with no change stamp, so the
 * client's first tick after every page load, sign-in and reload re-read the whole screen — on the owner
 * console 29–33 database calls queued in front of everyone else's (≈650 ms of database time on the rig,
 * three full reads in 18 s in a production trace on 26-Oct 05:33 UTC).
 *
 * The REAL `useLiveData` is bundled (tests/render/mounts/live-data.entry.tsx); the spec answers its
 * requests and records what each poll asked for. Executed, not pinned.
 */
import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { bundleForBrowser } from '../support/mount';

const ENTRY = fileURLToPath(new URL('./mounts/live-data.entry.tsx', import.meta.url));

let bundle = '';
test.beforeAll(async () => {
  bundle = await bundleForBrowser(ENTRY);
});

/** Mounts the probe with the stamp the "server" rendered, and records every poll's URL. */
async function mount(page: Page, stamp: string | null): Promise<string[]> {
  const asked: string[] = [];
  await page.route('**/api/probe/state**', async (route) => {
    const url = new URL(route.request().url());
    asked.push(url.pathname + url.search);
    const since = url.searchParams.get('since');
    await route.fulfill(
      since === 'f1'
        ? { json: { unchanged: true } }
        : { json: { n: asked.length }, headers: { 'x-change-stamp': 'f1' } }
    );
  });
  await page.route('**/api/probe/write', (route) => route.fulfill({ json: { done: true, state: { n: 99 } } }));
  await page.goto('/');
  await page.evaluate((s) => {
    (window as unknown as { __stamp: string | null }).__stamp = s;
  }, stamp);
  await page.addScriptTag({ content: bundle });
  await expect(page.getByTestId('probe')).toBeVisible();
  return asked;
}

test('a screen served with its stamp: the first poll only asks whether anything changed', async ({ page }) => {
  const asked = await mount(page, 'f1');
  await expect.poll(() => asked.length).toBeGreaterThanOrEqual(3);
  expect(asked[0], 'the first tick, right after the page load').toBe('/api/probe/state?since=f1');
  expect(
    asked.every((u) => u.includes('since=f1')),
    'no tick rebuilt the screen'
  ).toBe(true);
  // Nothing changed, so the screen the server rendered is still the one shown.
  await expect(page.getByTestId('probe')).toHaveAttribute('data-n', '0');
});

test('a screen served without a stamp still reads in full first (guest page, older server)', async ({ page }) => {
  const asked = await mount(page, null);
  await expect.poll(() => asked.length).toBeGreaterThanOrEqual(2);
  expect(asked[0]).toBe('/api/probe/state');
  // …and from then on asks with the stamp that full read carried.
  expect(asked[1]).toBe('/api/probe/state?since=f1');
});

test('after a write answers with its own screen, the next poll still reads in full (unchanged rule)', async ({
  page,
}) => {
  const asked = await mount(page, 'f1');
  await expect.poll(() => asked.length).toBeGreaterThanOrEqual(1);
  await page.getByTestId('probe-write').click();
  await expect(page.getByTestId('probe')).toHaveAttribute('data-n', '99');
  const at = asked.length;
  await expect.poll(() => asked.length).toBeGreaterThan(at);
  expect(asked[at], 'the stamp of an echoed screen is unknown, so it is not trusted').toBe('/api/probe/state');
});
