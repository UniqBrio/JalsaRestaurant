/**
 * pwa — the installability and update decisions, as pure functions.
 *
 * WHY A LIB AND NOT JUST A COMPONENT
 *   Every interesting case here is one a browser will not reproduce on demand: the app already
 *   installed, the browser that never fires `beforeinstallprompt`, the update that arrives
 *   mid-session, the second dismissal a week after the first. Tested through a component,
 *   those become "click around in Chrome and hope"; as pure state transitions they are eleven
 *   assertions that run in every environment. The component owns the browser APIs and the
 *   clock; this file owns the decisions.
 *
 * THE RULE THE INSTALL PROMPT FOLLOWS
 *   Ask once, remember the answer, and never ask an installed app. An install prompt that
 *   reappears on every visit is the pattern users learn to dismiss without reading — and they
 *   dismiss the important dialogs the same way afterwards. So a dismissal is durable, and
 *   `canPrompt` is false unless there is genuinely something to offer.
 *
 * THE RULE THE UPDATE FOLLOWS
 *   Never swap the code under a running session. A waiting worker is reported, not activated;
 *   the user decides when to take it. That is the whole reason `sw.js` does not call
 *   `skipWaiting()` on install.
 */

/** How the app is being viewed. `standalone` means it was launched from the home screen. */
export type DisplayMode = 'browser' | 'standalone';

export type InstallState =
  | 'unsupported'   // this browser offers no install path we can drive
  | 'installed'     // already installed, or running as one
  | 'dismissed'     // offered, and the user said no
  | 'available';    // we hold a deferred prompt and may offer it

export interface InstallInputs {
  /** True once `beforeinstallprompt` has fired and its event was captured. */
  readonly promptAvailable: boolean;
  /** The app is running in a standalone window, or the platform reports it installed. */
  readonly alreadyInstalled: boolean;
  /** A previous offer was declined, and that answer was stored. */
  readonly previouslyDismissed: boolean;
}

/**
 * `installed` outranks `dismissed` outranks `available`, and the order matters: an installed
 * app that once dismissed the banner must read as installed, not as "asked and refused".
 * Getting that backwards is how an installed app keeps being told it could be installed.
 */
export function installState(i: InstallInputs): InstallState {
  if (i.alreadyInstalled) return 'installed';
  if (!i.promptAvailable) return 'unsupported';
  if (i.previouslyDismissed) return 'dismissed';
  return 'available';
}

export const canPrompt = (i: InstallInputs): boolean => installState(i) === 'available';

/**
 * Read the display mode without assuming a browser. Returning 'browser' when there is no
 * `matchMedia` is deliberate: a server render must not claim standalone, or the first paint
 * hides an install affordance that the client then has to put back.
 */
export function readDisplayMode(win?: {
  matchMedia?: (q: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
}): DisplayMode {
  if (!win) return 'browser';
  // iOS Safari predates the media query and reports it here instead.
  if (win.navigator?.standalone === true) return 'standalone';
  const mm = win.matchMedia?.('(display-mode: standalone)');
  return mm?.matches ? 'standalone' : 'browser';
}

export type UpdateState = 'none' | 'downloading' | 'ready';

export interface UpdateInputs {
  /** A worker is installed and waiting to take over. */
  readonly waiting: boolean;
  /** A worker is currently installing. */
  readonly installing: boolean;
  /** Some worker already controls this page. */
  readonly controlled: boolean;
}

/**
 * A waiting worker on a page nobody controls is the FIRST install, not an update — there is no
 * running version for it to replace. Reporting "an update is ready" to someone who has just
 * opened the app for the first time is a lie, and it trains them to ignore the real one.
 */
export function updateState(u: UpdateInputs): UpdateState {
  if (u.waiting && u.controlled) return 'ready';
  if (u.installing && u.controlled) return 'downloading';
  return 'none';
}

/**
 * Registration is a decision, not a reflex. Registering over `file://`, in a test runner, or
 * on a browser without the API produces console noise and, worse, a worker in environments
 * where nobody expected one to exist.
 */
export interface RegistrationInputs {
  readonly serviceWorkerSupported: boolean;
  readonly secureContext: boolean;
  readonly protocol: string;
}

export function shouldRegister(r: RegistrationInputs): boolean {
  if (!r.serviceWorkerSupported) return false;
  // http: on localhost is a secure context by definition, so this covers local development
  // without special-casing hostnames.
  if (!r.secureContext) return false;
  return r.protocol === 'http:' || r.protocol === 'https:';
}

/** The storage key for a dismissal. Exported so the component and the tests cannot disagree. */
export const INSTALL_DISMISSED_KEY = 'pwa.install.dismissed';
