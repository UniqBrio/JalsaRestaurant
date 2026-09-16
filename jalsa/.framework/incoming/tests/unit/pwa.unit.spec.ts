/**
 * pwa unit spec — installability and update decisions.
 *
 * FAIL-FIRST EVIDENCE: recorded in TEST_SUMMARY.md for this version. Three assertions were
 * OBSERVED FAILING against deliberately wrong first drafts of `src/lib/pwa.ts`, and each
 * encodes a bug a browser would only show months later:
 *   - `installState` checking `previouslyDismissed` before `alreadyInstalled` reported an
 *     INSTALLED app as 'dismissed', so the app told people who had already installed it that
 *     they could install it.
 *   - `updateState` returning 'ready' for a waiting worker on an UNCONTROLLED page announced
 *     "an update is ready" to someone opening the app for the first time.
 *   - `readDisplayMode` reading only the media query reported iOS home-screen launches as
 *     'browser', because Safari predates it and reports `navigator.standalone` instead.
 */
import { test, expect } from '@playwright/test';
import {
  INSTALL_DISMISSED_KEY, canPrompt, installState, readDisplayMode, shouldRegister, updateState,
} from '../../src/lib/pwa';

const inputs = (o: Partial<Parameters<typeof installState>[0]> = {}) => ({
  promptAvailable: false, alreadyInstalled: false, previouslyDismissed: false, ...o,
});

test('a browser offering no install path is unsupported, not "available"', () => {
  expect(installState(inputs())).toBe('unsupported');
  expect(canPrompt(inputs())).toBe(false);
});

test('a captured prompt with no prior answer is offerable', () => {
  expect(installState(inputs({ promptAvailable: true }))).toBe('available');
  expect(canPrompt(inputs({ promptAvailable: true }))).toBe(true);
});

test('INSTALLED outranks a previous dismissal', () => {
  // The ordering bug: an installed app that once dismissed the banner must read as installed.
  // Reversed, the app offers an install to people who already installed it.
  const s = installState(inputs({ promptAvailable: true, alreadyInstalled: true, previouslyDismissed: true }));
  expect(s).toBe('installed');
  expect(canPrompt(inputs({ alreadyInstalled: true, promptAvailable: true }))).toBe(false);
});

test('a dismissal is durable — the offer is not repeated', () => {
  expect(installState(inputs({ promptAvailable: true, previouslyDismissed: true }))).toBe('dismissed');
  expect(canPrompt(inputs({ promptAvailable: true, previouslyDismissed: true }))).toBe(false);
});

test('the dismissal key is a single exported constant', () => {
  // Two spellings of this key means a dismissal that never sticks, in exactly one browser.
  expect(INSTALL_DISMISSED_KEY).toBe('pwa.install.dismissed');
});

test('a waiting worker is an UPDATE only when a worker already controls the page', () => {
  expect(updateState({ waiting: true, installing: false, controlled: true })).toBe('ready');
  // First install: there is no running version for it to replace.
  expect(updateState({ waiting: true, installing: false, controlled: false })).toBe('none');
});

test('an installing worker on a controlled page is downloading, not ready', () => {
  expect(updateState({ waiting: false, installing: true, controlled: true })).toBe('downloading');
  expect(updateState({ waiting: false, installing: true, controlled: false })).toBe('none');
});

test('no worker activity is "none"', () => {
  expect(updateState({ waiting: false, installing: false, controlled: true })).toBe('none');
});

test('display mode reads iOS standalone as well as the media query', () => {
  expect(readDisplayMode({ matchMedia: () => ({ matches: true }) })).toBe('standalone');
  // iOS Safari predates (display-mode: standalone) and reports it here instead.
  expect(readDisplayMode({ navigator: { standalone: true }, matchMedia: () => ({ matches: false }) }))
    .toBe('standalone');
  expect(readDisplayMode({ matchMedia: () => ({ matches: false }) })).toBe('browser');
});

test('with no window at all the mode is "browser", never standalone', () => {
  // A server render claiming standalone hides the install affordance on first paint, and the
  // client then has to put it back — a flash that looks like a bug because it is one.
  expect(readDisplayMode(undefined)).toBe('browser');
  expect(readDisplayMode({})).toBe('browser');
});

test('registration is refused where a worker has no business existing', () => {
  const ok = { serviceWorkerSupported: true, secureContext: true, protocol: 'https:' };
  expect(shouldRegister(ok)).toBe(true);
  // localhost over http is a secure context, so development works without special-casing it.
  expect(shouldRegister({ ...ok, protocol: 'http:' })).toBe(true);
  expect(shouldRegister({ ...ok, serviceWorkerSupported: false })).toBe(false);
  expect(shouldRegister({ ...ok, secureContext: false })).toBe(false);
  expect(shouldRegister({ ...ok, protocol: 'file:' })).toBe(false);
});
