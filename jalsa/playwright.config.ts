/**
 * Playwright configuration - one runner, three tiers.
 *
 * THE TIERS, AND WHY THE SPLIT MATTERS
 *   tests/unit/       Pure logic and static audits. No browser page, no server, no credentials.
 *                     Because they need nothing, they run in EVERY environment - so they are
 *                     the tier that always actually executes. Put your enforcement rungs here.
 *   tests/render/     Real components mounted in a real browser. Catches what static analysis
 *                     cannot: computed colour, layout, focus, occlusion.
 *   tests/functional/ Journeys against the running application with the network mocked at one
 *                     boundary, so no test can reach a real datastore by accident.
 *
 * A GEOMETRY CASE IS AUTOMATED BY DEFINITION
 *   Overlap, clipping, occlusion, truncation and reachability are computable from a bounding
 *   box. Left "manual", they are the cases that sit unexecuted while the exact defect they
 *   guard against ships. Never mark them manual.
 *
 * THE VIEWPORT LIST IS NOT DECORATIVE
 *   `mobile-short` exists specifically because a tall mobile viewport HIDES bottom-chrome
 *   occlusion - content fits, so nothing overlaps, and the bug reaches production. Include at
 *   least one viewport short enough that content genuinely overflows.
 */
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { UNREACHABLE_DATABASE } from './tests/support/servers';

dotenv.config({ path: '.env.test' });

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

/**
 * A supplied browser, and the honest cost of using one.
 *
 * Playwright pins one build of each engine per release and refuses to start on any other. On a
 * managed runner that pre-installs its own Chromium, that pin turns "the suite is red" into "the
 * suite never ran" — the more expensive of the two failures, because it looks like nothing
 * happened. PLAYWRIGHT_CHROMIUM_PATH is the deliberate, per-environment override.
 *
 * What it CANNOT do is supply the other engines. The two iOS-flavoured projects are backed by
 * WebKit, and pointing WebKit at a Chromium binary does not produce a Safari run — it produces a
 * Chromium run wearing an iPhone's viewport, which is worse than no run because the report says
 * "mobile-ios passed". So they are dropped, LOUDLY, on stderr. Rule 3: fail open on tooling,
 * block only on evidence, and never go quietly dead.
 */
const BROWSER_OVERRIDE = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const WEBKIT_BACKED = ['tablet', 'mobile-ios'];

function available<T extends { name: string }>(projects: T[]): T[] {
  if (!BROWSER_OVERRIDE) return projects;
  process.stderr.write(
    `SKIPPED: ${WEBKIT_BACKED.join(', ')} — these projects are WebKit-backed and this run uses a ` +
      `supplied Chromium (PLAYWRIGHT_CHROMIUM_PATH). Safari-engine coverage did NOT run.\n`
  );
  return projects.filter((p) => !WEBKIT_BACKED.includes(p.name));
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: 'test-results/',

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  /**
   * An image that already ships a browser must be allowed to use it.
   *
   * Playwright pins one Chromium build per release and refuses to start on any other. On a
   * managed runner that pre-installs a browser, that pin turns "the suite is red" into "the
   * suite never ran", which is the more expensive of the two failures because it looks like
   * nothing happened. PLAYWRIGHT_CHROMIUM_PATH is the deliberate, per-environment override;
   * unset, nothing changes and the pinned download is used.
   */
  use: {
    ...(BROWSER_OVERRIDE
      ? { launchOptions: { executablePath: BROWSER_OVERRIDE, args: ['--no-sandbox'] } }
      : {}),
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },

  /* Starting the servers is part of the run. A suite that requires a human to start something
   * first is a suite that does not run in CI, and therefore does not run.
   *
   * The SECOND server is the point of interest: a real instance of this application pointed at
   * a database address that refuses instantly. It exists so the "we cannot reach the till"
   * screen is asserted the way a guest meets it — rendered by the real server component, on the
   * real route — rather than mocked in a browser that never sees that failure. It is started in
   * every environment, including one where the real database IS reachable, so the outage
   * journey never quietly stops running. */
  webServer: [
    ...(process.env.TEST_APP_URL
      ? []
      : [
          {
            command: 'npm run dev',
            url: 'http://localhost:3000',
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
          },
        ]),
    {
      command: 'next dev --port 3101',
      url: 'http://127.0.0.1:3101/staff',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        // Next never overwrites a variable already present in the environment, so these win
        // over .env.local without touching it.
        NEXT_PUBLIC_SUPABASE_URL: UNREACHABLE_DATABASE,
        SUPABASE_SECRET_KEY: 'sb_secret_this_instance_is_deliberately_unreachable',
        SESSION_SECRET: 'degraded-instance-session-secret-not-a-credential',
        NEXT_DIST_DIR: '.next-degraded',
      },
    },
  ],

  projects: available([
    { name: 'unit', testDir: './tests/unit' },
    { name: 'render', testDir: './tests/render', use: { ...devices['Desktop Chrome'] } },

    {
      name: 'desktop',
      testDir: './tests/functional',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'desktop-wide',
      testDir: './tests/functional',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    { name: 'tablet', testDir: './tests/functional', use: { ...devices['iPad Pro 11'] } },
    { name: 'mobile', testDir: './tests/functional', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-ios', testDir: './tests/functional', use: { ...devices['iPhone 14'] } },
    /* Deliberately short. See the note above: a tall viewport masks occlusion defects. */
    {
      name: 'mobile-short',
      testDir: './tests/functional',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, isMobile: false },
    },
  ]),
});
