/**
 * connectivity — telling "this phone cannot reach us" apart from "we answered badly".
 *
 * WHY THE DISTINCTION IS WORTH A MODULE
 *   `useLiveData` threw on `!res.ok` and caught a dead network in the same `catch`, so an HTTP
 *   500 from a broken query and a phone in a lift produced the same sentence. Both are failures;
 *   only one of them is the customer's to fix. Telling somebody to check their signal when the
 *   database is down wastes their time and hides an outage; telling somebody "something went
 *   wrong" when they are simply in a basement hides the one thing they could act on.
 *
 * WHAT CANNOT BE DETECTED, AND IS THEREFORE NEVER CLAIMED
 *   A browser cannot tell mobile data from Wi-Fi, a captive portal from a working network, or
 *   airplane mode from a dead router. `navigator.connection` exists on some Android browsers and
 *   nowhere else, and it reports a guess. So nothing here says "mobile data is off" — the copy
 *   below names both options and lets the person look at their own phone.
 *
 * THE TWO SIGNALS, IN ORDER
 *   1. `navigator.onLine === false` is decisive when it is false: the browser is telling us it
 *      has no interface at all.
 *   2. `navigator.onLine === true` proves nothing — it is true on a captive portal and true on a
 *      Wi-Fi network with no route out. So a request is still made, and the SHAPE of its failure
 *      is the second signal: `fetch` rejects with a TypeError when it never got an answer, and
 *      resolves with a status when it did.
 *
 *   That is the whole classifier. No probe, no extra endpoint, no delay for an online customer.
 */

/** What the guest is told, in the requester's own words. */
export const OFFLINE_TITLE = "You're offline";
export const OFFLINE_BODY = 'Please enable mobile data or connect to Wi-Fi to continue.';
export const OFFLINE_HINT = "Once you're connected, try again.";
export const OFFLINE_RETRY = 'Try again';

/**
 * The secondary action, and the one thing on this screen that still works.
 *
 * WHY IT IS A PHONE CALL AND NOT THE CAPTAIN-REQUEST MECHANISM
 *   `Call captain` in the "Ask for something" sheet POSTs to `/api/guest/ask`. On a screen that
 *   exists BECAUSE the server cannot be reached, that request cannot arrive — and a button that
 *   reports "your captain has been called" when nothing left the phone is worse than no button:
 *   it makes somebody sit and wait for a person who was never told.
 *
 *   A telephone call does not use the data network. So this reuses the `tel:` idiom the surface
 *   already has (TableInactive, and the help sheet's "Call the restaurant"), points at the number
 *   the owner already configured, and asks nothing of the server. It is not a second request
 *   mechanism; it is the one channel that is still open.
 *
 * WHERE THERE IS NO NUMBER the action is not rendered at all. A dead `tel:` link on a screen
 * about things not working is the same lie in a different shape.
 */
export const OFFLINE_CALL = 'Call captain';
export const OFFLINE_CALL_NOTE = 'A phone call still works with no internet.';
/** What the screen says instead, where the restaurant has configured no number. */
export const OFFLINE_NO_NUMBER = 'In a hurry, your captain is quicker than the wifi — just wave.';

/**
 * Whether the browser itself says there is no connection.
 *
 * `true` here is decisive. `false` means only "the browser has an interface", which is why every
 * caller still makes its request.
 */
export function browserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Whether THIS failure was the network rather than the server.
 *
 * `fetch` rejects — with a TypeError, whose message differs per engine — only when no response
 * was received: DNS failure, no route, connection reset, the request aborted by the platform. A
 * response that arrived and said 500 is a server error and is deliberately NOT matched here: it
 * reaches this function as an `Error` thrown by the caller after `!res.ok`, carrying a status,
 * and must keep its own handling.
 *
 * `browserOffline()` is checked first because a failure that happens while the browser reports no
 * interface is a network failure whatever shape it arrived in.
 */
export function isNetworkFailure(err: unknown): boolean {
  if (browserOffline()) return true;
  if (!(err instanceof Error)) return false;

  /* A TypeError from fetch is the signal. `AbortError` is deliberately excluded: an aborted
     request is usually the application's own doing — a navigation, a superseded poll — and
     telling somebody their signal is gone because a page changed would be a false alarm. */
  if (err.name === 'AbortError') return false;
  if (err.name === 'TypeError') return true;

  /* Some engines surface a dropped connection as a plain Error. These are the exact strings
     browsers and Node use, matched as a whole word so a dish called "Failed to fetch" in an
     error message cannot trip it. */
  return /\b(failed to fetch|network ?error|load failed|networkerror|err_internet_disconnected|econnrefused|econnreset|fetch failed)\b/i.test(
    err.message
  );
}

/**
 * The sentence for a failure, given what kind it turned out to be.
 *
 * ONE PLACE, so a screen cannot decide on its own that a 500 means "check your signal". The
 * server's own message is preferred when there is one, because a server that explained itself
 * knows more about the failure than this function does.
 */
export function failureMessage(err: unknown, fallback: string): string {
  if (isNetworkFailure(err)) return `${OFFLINE_TITLE}. ${OFFLINE_BODY}`;
  return err instanceof Error && err.message ? err.message : fallback;
}
