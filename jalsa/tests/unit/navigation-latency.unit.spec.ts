/**
 * Navigation latency, round 2 (26-Oct-2026, requests/2026-10-26-navigation-latency.md;
 * docs/audit/NAVIGATION_PERFORMANCE_AUDIT.md).
 *
 * N-01  A server-rendered keypad is VISIBLE before it WORKS: on the India 4G model 0.85-1.0 s at p50,
 *       and a tap in that gap was thrown away silently. One lost digit and the sign-in was never sent
 *       (20 of 40 slow-phone sign-ins on the rig). Both keypads are marked unavailable (aria-disabled, dimmed, still focusable) until React is attached.
 * N-02  The owner and staff pages rendered their first screen with no change stamp, so the first poll
 *       after every page load, sign-in and reload rebuilt it: 29–33 database calls on the owner console.
 *       The pages now read the floor counter BESIDE the identity check (both precede the build, as a
 *       stamp must, and the pair costs no extra round) and hand it to `useLiveData`.
 * N-03  The stale-print sweep ran an UPDATE that nearly always matched nothing - and the change counters
 *       are bumped by statement-level triggers, which fire anyway. Once a minute every owner console and
 *       captain phone rebuilt its screen for a change that did not happen (52 in production, 24-Oct). It
 *       now looks first and writes only when something is stale. Executed on the round rig.
 * N-04  The sign-in record was a whole database round between a correct PIN and the screen opening.
 *       It is written after the answer (`after`), and still written.
 *
 * The hook's behaviour is executed in tests/render/navigation-latency.render.spec.ts. Server paths that
 * need Postgres are pinned on the lines that carry the rule - the house idiom.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { newCheck, pollTarget } from '../../src/hooks/change-check';
import { useInteractive } from '../../src/hooks/useInteractive';

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('N-02: a check started from the served stamp asks first, and reads in full on the clock from then', () => {
  const c = newCheck(60_000, { stamp: 'f7.abc', at: 10_000 });
  expect(pollTarget('/api/owner/state', c, 18_000, false)).toEqual({
    href: '/api/owner/state?since=f7.abc',
    full: false,
  });
  // The clock runs from when the screen was served, not from zero.
  expect(pollTarget('/api/owner/state', c, 69_999, false).full).toBe(false);
  expect(pollTarget('/api/owner/state', c, 70_000, false).full).toBe(true);
  // A person-caused read is still always in full.
  expect(pollTarget('/api/owner/state', c, 18_000, true).full).toBe(true);
  // No served stamp: exactly as before.
  expect(pollTarget('/api/owner/state', newCheck(60_000), 1, false).full).toBe(true);
});

for (const [surface, component] of [
  ['owner', 'OwnerConsole'],
  ['staff', 'StaffApp'],
] as const) {
  test(`N-02: /${surface} reads the stamp beside the identity check and serves it with the screen`, () => {
    const page = code(`src/app/${surface}/page.tsx`);
    // One round: identity and floor counter together, both BEFORE the screen is built.
    /* SUPERSEDED 27-Oct-2026: asserted `floorStamp()` and `staffStamp(floor, staff)`. The page now reads
       `readVersions()` — the same single read, returning the catalog counter too, for the catalog cache
       (requests/2026-10-27-performance-security-delivery.md, JP-27) — and stamps from `versions.floor`. */
    const read = page.indexOf(`Promise.all([currentStaff('${surface}'), readVersions()])`);
    expect(read, 'identity and stamp read together').toBeGreaterThan(-1);
    expect(read).toBeLessThan(
      page.indexOf(surface === 'owner' ? 'buildOwnerPayload(staff' : 'buildStaffPayload(staff')
    );
    // The same person-bound stamp the route compares against.
    expect(page).toContain(
      `<${component} initial={loaded.value} initialStamp={staffStamp(versions.floor, staff)} />`
    );
  });
}

test('N-02: both apps hand the served stamp to the one polling hook', () => {
  for (const file of ['src/features/owner/OwnerConsole.tsx', 'src/features/staff/StaffApp.tsx']) {
    const src = code(file);
    expect(src, file).toMatch(/fullEveryMs: 60_000,\s*initialStamp,\s*\}\)/);
  }
  const hook = code('src/hooks/useLiveData.ts');
  // The stamp is forgotten on a CHANGE of URL, never on the first render.
  expect(hook).toMatch(/if \(shownUrl\.current === url\) return;/);
});

test('N-04: the sign-in record is written after the answer, and still written', () => {
  const route = code('src/app/api/staff/session/route.ts');
  const after = route.indexOf('after(async () => {');
  expect(after, 'the record is scheduled with after()').toBeGreaterThan(-1);
  expect(route.slice(after)).toMatch(/after\(async \(\) => \{\s*try \{\s*await audit\(\{\s*action: 'Signed in'/);
  // Nothing between the session and the answer awaits the record any more.
  const post = route.slice(route.indexOf('export const POST'), route.indexOf('export const DELETE'));
  expect(post.replace(/after\(async \(\) => \{[\s\S]*?\n {2}\}\);/, '')).not.toContain('await audit(');
});

interface Sweep {
  name: string;
  result: { expired: number };
  sent: Array<{ table: string; op: string; filters: string[] }>;
}
const SWEEP = fileURLToPath(new URL('../support/rounds/sweep.scenarios.ts', import.meta.url));

test('N-03: a sweep that finds nothing stale writes nothing - so it moves no counter', async () => {
  const [quiet, stale] = await runScenario<Sweep[]>(SWEEP);
  expect(quiet!.result).toEqual({ expired: 0 });
  expect(
    quiet!.sent.filter((s) => s.op !== 'select'),
    'no UPDATE when nothing is stale'
  ).toEqual([]);
  // The look-up asks exactly what the update would have matched.
  expect(quiet!.sent[0]).toMatchObject({ table: 'print_job', op: 'select' });
  expect(quiet!.sent[0]!.filters).toEqual(['eq:restaurant_id', 'eq:status', 'lt:claimed_at']);

  // Something stale: it still expires, to failed, with the update's own conditions.
  expect(stale!.result).toEqual({ expired: 1 });
  const update = stale!.sent.find((s) => s.op === 'update');
  expect(update?.filters).toEqual(['eq:restaurant_id', 'eq:status', 'lt:claimed_at']);
});

test('N-01: a control is not interactive in the server-rendered page - so it arrives marked unavailable, not dead', () => {
  function Key() {
    return createElement('button', { 'aria-disabled': useInteractive() ? undefined : true }, '1');
  }
  // What the phone paints before the JavaScript has run: a disabled key, in its designed look.
  expect(renderToString(createElement(Key))).toContain('aria-disabled="true"');
});

test('N-01: both PIN keypads are marked unavailable until a tap can be answered', () => {
  for (const file of ['src/features/staff/PinSignIn.tsx', 'src/features/staff/ChoosePin.tsx']) {
    const src = code(file);
    expect(src, file).toContain('const interactive = useInteractive();');
    // aria-disabled, not disabled: still focusable, so a key focused before the page is ready keeps
    // its focus (the keyboard-parity functional spec caught `disabled` on 26-Oct-2026).
    expect(src, file).toMatch(
      /disabled=\{busy\}\s*aria-disabled=\{interactive \? undefined : true\}\s*onClick=\{\(\) => press\(k\)\}/
    );
    expect(src, file).toContain('aria-disabled:opacity-45');
  }
  // The hook answers false on the server and true in the browser, from React itself.
  expect(code('src/hooks/useInteractive.ts')).toMatch(
    /useSyncExternalStore\(\s*never,\s*\(\) => true,\s*\(\) => false\s*\)/
  );
});
