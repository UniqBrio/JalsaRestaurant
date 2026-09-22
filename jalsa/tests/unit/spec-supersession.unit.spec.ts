/**
 * The supersession exception, executed.
 *
 * WHY THIS FILE EXISTS
 *   On 19-Sep-2026 a Phase 1 correction changed `resolvePrinter`'s contract, which invalidated
 *   four assertions in `print-routing.unit.spec.ts`. "Test files are append-only" had no
 *   provision for a contract change, so the only options were a red suite or a silent deletion.
 *   The rule was amended, narrowly, with human approval — and an amended rule that nothing
 *   executes is exactly the thing this repository's framework was built to refuse.
 *
 *   So the exception has a rung. It checks three things a person cannot be relied on to check:
 *   that the exception stayed narrow, that the file which used it left the record it promises,
 *   and that it did not leak into the framework template on one sighting.
 *
 * FAIL-FIRST EVIDENCE (20-Sep-2026): run against the tree with `jalsa/CLAUDE.md` reverted to its
 * pre-amendment wording — **2 failed, 4 passed**: "the exception exists and is narrowly scoped"
 * and "the exception names its pattern". Recorded verbatim in the run below.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (p: string): string => readFileSync(p, 'utf8');

const APP_RULES = read('CLAUDE.md');
const SUPERSEDED_SPEC = read('tests/unit/print-routing.unit.spec.ts');
const TEMPLATE = read('../templates/docs/AGENTS.md');
const CANDIDATES = read('../docs/registers/CANDIDATES.md');
const PATTERNS = read('docs/registers/CANONICAL_PATTERNS.md');

test('the files this rung reasons about were actually read', () => {
  // Binding rule 3: a detector that parsed nothing reports BLOCKED, never success.
  expect(APP_RULES.length, 'jalsa/CLAUDE.md').toBeGreaterThan(3000);
  expect(TEMPLATE.length, 'templates/docs/AGENTS.md').toBeGreaterThan(1000);
  expect(CANDIDATES.length, 'CANDIDATES.md').toBeGreaterThan(1000);
  expect(APP_RULES).toContain('Test files are append-only');
});

test('the exception exists and is narrowly scoped to a CONTRACT change', () => {
  expect(APP_RULES).toContain("except where a module's");
  expect(APP_RULES).toContain('contract changes');
  expect(APP_RULES).toContain('dated supersession note');
  // The scope limit is the whole of why this was acceptable. Without it the rule reads as
  // "rewrite a spec whenever it is inconvenient", which is not an exception, it is a repeal.
  expect(APP_RULES).toContain('registers stay append-only without exception');
});

test('the exception names the pattern that carries its precedent', () => {
  expect(APP_RULES).toContain('JP-23');
  expect(PATTERNS, 'JP-23 is registered').toContain('| JP-23 |');
  expect(PATTERNS, 'and says what qualified').toContain('Qualifying precedent');
});

test('THE FILE THAT USED THE EXCEPTION LEFT THE RECORD THE RULE PROMISES', () => {
  // The rule buys a rewrite in exchange for a note. This is the half that can be forgotten,
  // because the suite is green either way.
  expect(SUPERSEDED_SPEC).toContain('SUPERSEDED ASSERTIONS');
  expect(SUPERSEDED_SPEC, 'dated').toMatch(/SUPERSEDED ASSERTIONS[^\n]*\d{2}-\w{3}-\d{4}/);
  // And says what it used to assert, not merely that something changed.
  expect(SUPERSEDED_SPEC).toContain('What the four cases asserted');
  expect(SUPERSEDED_SPEC).toContain('an unreachable station fell back to the main kitchen');
});

test('ONE SIGHTING DOES NOT AMEND THE FRAMEWORK — the template still carries the plain rule', () => {
  // The rule exists in three places. Amending the app's copy is a decision about one app;
  // amending the template hands the exception to every application not yet written, on n=1,
  // which is the precise thing CANDIDATES.md exists to prevent.
  expect(TEMPLATE).toContain('**Test files are append-only.** Never overwrite an existing spec.');
  expect(TEMPLATE, 'the exception must NOT have leaked into the template').not.toContain('contract changes');
});

test('and the skew is parked where a second sighting will find it', () => {
  // A deliberate divergence nobody wrote down is indistinguishable from drift.
  expect(CANDIDATES).toContain('CAND-003');
  expect(CANDIDATES).toContain('PARKED (n=1)');
  expect(CANDIDATES).toContain('why it is parked and not applied to the template');
});
