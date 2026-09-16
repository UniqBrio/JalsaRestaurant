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

dotenv.config({ path: '.env.test' });

const BASE_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

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

  use: {
    baseURL: BASE_URL,
    // A sandbox that pre-installs a browser and forbids downloads names it here; CI, which
    // runs `npx playwright install`, leaves it unset and gets the bundled build. Absent means
    // absent (exactOptionalPropertyTypes), hence the spread rather than `executablePath: undefined`.
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },

  /* Starting the server is part of the run. A suite that requires a human to start something
   * first is a suite that does not run in CI, and therefore does not run. */
  // Spread rather than `webServer: undefined`: under exactOptionalPropertyTypes an explicit
  // undefined is not the same as absent, and it is absent that means "do not start one".
  //
  // AND NEVER FOR THE UNIT TIER. `webServer` is global - Playwright has no per-project form -
  // so a unit-only run used to boot the whole application and wait two minutes for it, which
  // contradicted the first sentence of this file and made gate G7 time out in every environment
  // that could not serve the app. The tier is recognised from the invocation (`tests/unit` on
  // the command line, as `npm run test:unit` passes it) because that is the only signal that
  // exists before the config is evaluated; there is no flag Playwright hands a config for this.
  ...(process.env.TEST_APP_URL || process.argv.some((a) => a.includes('tests/unit')) ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // The server the suite boots is configured HERE, not by a .env file that may or may not
      // exist on the machine running it. Every value is a test value: the API points back at
      // this origin, where the suite mocks it at the one boundary. A suite whose server needs
      // a hand-made file is a suite that does not run in CI, and therefore does not run.
      env: {
        APP_ENV: 'test',
        PUBLIC_APP_URL: 'http://localhost:3000',
        PUBLIC_API_URL: 'http://localhost:3000/api',
      },
    },
  }),

  projects: [
    { name: 'unit', testDir: './tests/unit' },
    { name: 'render', testDir: './tests/render', use: { ...devices['Desktop Chrome'] } },

    { name: 'desktop', testDir: './tests/functional', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-wide', testDir: './tests/functional', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    // The iOS descriptors default to WebKit. They run on CHROMIUM here, on purpose and with
    // the gap named: these projects exist for VIEWPORT variety (the occlusion class, see the
    // header), not engine coverage, and Chromium is the one engine the CI template installs -
    // so on WebKit these two projects never ran anywhere, and G8 could never be green. Real
    // WebKit coverage is a decision to install it in CI, recorded as debt, not implied here.
    { name: 'tablet', testDir: './tests/functional', use: { ...devices['iPad Pro 11'], browserName: 'chromium' } },
    { name: 'mobile', testDir: './tests/functional', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-ios', testDir: './tests/functional', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
    /* Deliberately short. See the note above: a tall viewport masks occlusion defects. */
    { name: 'mobile-short', testDir: './tests/functional', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, isMobile: false } },
  ],
});
