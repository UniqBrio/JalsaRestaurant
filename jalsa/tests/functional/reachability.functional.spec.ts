/**
 * Reachability — the application's own server can reach its database, and the database is the
 * one this application was seeded into.
 *
 * WHY THIS FILE EXISTS
 *   KL-1 in docs/registers/KNOWN_LIMITATIONS.md recorded that the build container could not reach
 *   the Supabase host, so no journey had ever been run against real data. The first CI run
 *   (actions/runs/34575687627) went green — and proved NOTHING about that: every spec on the
 *   configured instance stayed on database-free pages, and the degraded instance targets
 *   127.0.0.1:1 by design. `grep supabase.co` on that run's log matches zero lines. Closing KL-1
 *   on it would have been exactly the defect RC-009 describes: a verdict cited as coverage of
 *   something it never opened. This is the rung that makes the claim true.
 *
 * WHAT THIS FILE DOES NOT COVER, LEARNED THE HARD WAY (12-Sep-2026)
 *   Returning before the insert also returns before the COOKIE WRITE - and that write was the
 *   defect. `resolveGuest` called `cookies().set()`, which Next.js forbids during a server
 *   render, so the first scan of a REAL table threw and showed "We cannot reach the till just
 *   now": a message about the database, for a failure that had nothing to do with it. This spec
 *   passed throughout, honestly, because the branch it takes never reaches that line.
 *   The lesson is not that this file is wrong - it is that a read-only probe proves the database
 *   answers, and nothing whatsoever about the path that writes. `guest-journey.functional.spec.ts`
 *   is the file that covers it; it had never run.
 *
 * WHY AN UNKNOWN TABLE, NOT A REAL ONE
 *   Visiting a real table INSERTS a guest_session row (src/lib/db/guest.ts). The functional suite
 *   writes nothing to any database — ENVIRONMENTS.md, binding rule 4 — and the only project that
 *   exists today is the seeded one. An unknown name runs the same two reads
 *   (`restaurant` by slug, then `dining_table` by name) and returns before the insert. Two real
 *   queries, zero rows written, on every run, forever.
 *
 * WHAT THE RENDERED SCREEN PROVES
 *   `guest-unknown-table` can only render after `findTableByName` returned null, which can only
 *   happen after `currentRestaurantId()` found the `jalsa-hosur` row. A database that is
 *   unreachable renders `unreachable-guest`; one that is reachable but unseeded throws inside
 *   `currentRestaurantId()` and ALSO renders `unreachable-guest`; missing secrets render
 *   `not-configured`. So the one screen this file asserts is the one only a reachable, seeded
 *   database can produce.
 *
 * FAIL-FIRST EVIDENCE (11-Sep-2026):
 *   OBSERVED FAILING — on the build container, where egress to *.supabase.co is refused by
 *   policy. First run, desktop project: `expect(locator).toBeVisible() failed — Locator:
 *   getByTestId('guest-unknown-table') — element(s) not found`, after the 8s wait; the page had
 *   rendered `unreachable-guest` instead. That IS the pre-fix state of KL-1, observed by the
 *   assertion written to close it.
 *   The same file is expected green only where the database is reachable — CI — and it must go
 *   red, never skip, anywhere it is not.
 */
import { test, expect } from '@playwright/test';

/** No seeded table is named this; `ilike` treats it literally (no % or _). */
const NOT_A_TABLE = 'ZZZ-NOT-A-TABLE-ZZZ';

test('the server reaches the seeded database and answers from it — without writing a row', async ({ page }) => {
  const response = await page.goto(`/t/${NOT_A_TABLE}`);
  expect(response?.status(), 'a designed screen, not an error page').toBe(200);

  // The only screen a reachable, seeded database can produce for this name.
  const unknown = page.getByTestId('guest-unknown-table');
  await expect(unknown).toBeVisible();
  // The copy names the table typed — it is the real branch, not a generic fallback.
  await expect(unknown).toContainText(NOT_A_TABLE);

  // And the two screens that would mean the database was NOT consulted.
  await expect(page.getByTestId('unreachable-guest'), 'the database was not reachable').toHaveCount(0);
  await expect(page.getByTestId('not-configured'), 'the configuration was not present').toHaveCount(0);
});
