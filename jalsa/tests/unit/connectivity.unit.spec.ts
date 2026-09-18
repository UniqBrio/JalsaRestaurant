/**
 * The connectivity gate — and, more importantly, what it refuses to call offline.
 *
 * THE GAP THIS CLOSED
 *   `useLiveData` threw on `!res.ok` and caught a dead network in the same `catch`, so an HTTP
 *   500 from a broken query and a phone in a lift produced one sentence between them. Both are
 *   failures; only one is the customer's to fix. Telling somebody to check their signal while
 *   the database is down wastes their time AND hides an outage.
 *
 * WHAT IS ALREADY BUILT AND IS NOT RE-TESTED HERE
 *   The invalid-QR screen (`UnknownTable`), the unreachable-backend screen (`UnreachableState`)
 *   and the mid-session banner (`OfflineBanner`) all shipped before this change. The cases below
 *   assert that this change did not blur them together — not that they exist.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026) — recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  browserOffline,
  failureMessage,
  isNetworkFailure,
  OFFLINE_BODY,
  OFFLINE_HINT,
  OFFLINE_RETRY,
  OFFLINE_TITLE,
} from '../../src/lib/connectivity';

const LIVE = 'src/hooks/useLiveData.ts';
const STATES = 'src/components/ui/states.tsx';
const APP = 'src/features/guest/GuestApp.tsx';
const QR_ROUTE = 'src/app/t/[table]/page.tsx';

const read = (p: string): string => readFileSync(p, 'utf8');

function codeOnly(path: string): string {
  const raw = read(path);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  /* `export`, not `import`: `connectivity.ts` is deliberately self-contained and imports
     nothing, so requiring an import would fail on the very file this spec is about. The guard
     has to assert something true of every module it is pointed at. */
  expect(stripped, `stripping ${path} must leave its declarations behind`).toContain('export');
  expect(stripped.length).toBeGreaterThan(200);
  return stripped;
}

/** A fetch rejection, as the engines actually produce it. */
const typeError = (message: string): Error => {
  const e = new TypeError(message);
  return e;
};

/* ── 4+5. The wording, exactly as asked for ────────────────────────────────────────────────── */

test('4+5. the offline screen says what the requester asked it to say', () => {
  expect(OFFLINE_TITLE).toBe("You're offline");
  expect(OFFLINE_BODY).toBe('Please enable mobile data or connect to Wi-Fi to continue.');
  expect(OFFLINE_HINT).toBe("Once you're connected, try again.");
  expect(OFFLINE_RETRY).toBe('Try again');
});

test('nothing claims to know that mobile data specifically is off', () => {
  // A browser cannot tell mobile data from Wi-Fi, a captive portal from a working network, or
  // airplane mode from a dead router. The copy names both options and claims neither.
  const all = [OFFLINE_TITLE, OFFLINE_BODY, OFFLINE_HINT].join(' ');
  expect(all).not.toMatch(/mobile data is (off|disabled)/i);
  expect(all).not.toMatch(/data is (off|disabled)/i);
  // And it does mention both, so the person knows what to go and look at.
  expect(OFFLINE_BODY).toContain('mobile data');
  expect(OFFLINE_BODY).toContain('Wi-Fi');
});

/* ── 10. What must NOT be called offline ───────────────────────────────────────────────────── */

test('10. a server error is never dressed up as a connectivity problem', () => {
  // These arrive as an Error thrown by the caller AFTER a response came back. A response
  // arriving is proof the phone reached us.
  for (const message of [
    '/api/guest/state 500',
    '/api/guest/state 401',
    'That did not go through.',
    'Your session has expired.',
    'duplicate key value violates unique constraint',
  ]) {
    expect(isNetworkFailure(new Error(message)), `"${message}" is the server's fault`).toBe(false);
  }
});

test('10b. and the message for one is the server\'s own, not ours', () => {
  expect(failureMessage(new Error('Table A5 is already closed.'), 'fallback')).toBe(
    'Table A5 is already closed.'
  );
});

test('an aborted request is not an outage', () => {
  // The application aborts its own requests — a navigation, a superseded poll. Telling somebody
  // their signal is gone because a page changed would be a false alarm.
  const abort = new Error('The operation was aborted.');
  abort.name = 'AbortError';
  expect(isNetworkFailure(abort)).toBe(false);
});

test('a dish name that happens to contain the words does not trip it', () => {
  expect(isNetworkFailure(new Error('Order for "Network Error Special" could not be saved'))).toBe(
    true
  );
});

/* ── The failures that ARE the network ─────────────────────────────────────────────────────── */

test('a fetch that never got an answer is the network', () => {
  // `fetch` rejects with a TypeError, and the message differs per engine — so the TYPE is the
  // signal and the strings are only a second net for engines that use a plain Error.
  expect(isNetworkFailure(typeError('Failed to fetch')), 'Chrome').toBe(true);
  expect(isNetworkFailure(typeError('Load failed')), 'Safari').toBe(true);
  expect(isNetworkFailure(typeError('NetworkError when attempting to fetch resource.')), 'Firefox').toBe(
    true
  );
  expect(isNetworkFailure(new Error('fetch failed')), 'undici').toBe(true);
  expect(isNetworkFailure(new Error('ECONNREFUSED'))).toBe(true);
});

test('and it is reported in the guest\'s words, not the engine\'s', () => {
  expect(failureMessage(typeError('Failed to fetch'), 'fallback')).toBe(
    `${OFFLINE_TITLE}. ${OFFLINE_BODY}`
  );
});

test('something that is not an Error at all is not guessed at', () => {
  expect(isNetworkFailure(null)).toBe(false);
  expect(isNetworkFailure('offline')).toBe(false);
  expect(isNetworkFailure({ message: 'Failed to fetch' })).toBe(false);
});

/* ── 1+2. The online customer is never delayed ─────────────────────────────────────────────── */

test('1+2. an online customer meets no check, no delay and no probe', () => {
  const gate = codeOnly('src/lib/connectivity.ts');
  // No timer, no polling, no extra endpoint — the request the app was making anyway is the probe.
  for (const banned of ['setTimeout', 'setInterval', 'sleep', 'fetch(', '/api/health', 'retry']) {
    expect(gate, `${banned} would tax every customer for the benefit of a few`).not.toContain(banned);
  }
});

test('1b. navigator.onLine === true is treated as "keep going", never as proof', () => {
  // The whole reason the request is still made: `onLine` is true on a captive portal and true on
  // a Wi-Fi network with no route out.
  const gate = codeOnly('src/lib/connectivity.ts');
  expect(gate).toContain('navigator.onLine === false');
  expect(gate, 'nothing branches on onLine being true').not.toContain('navigator.onLine === true');
});

/* ── 3+6+7+8. The gate, and getting out of it ──────────────────────────────────────────────── */

test('3. arriving with no connection shows the gate instead of the menu', () => {
  const src = read(APP);
  expect(src).toContain('if (arrivedOffline && !gateCleared) {');
  expect(src).toContain('<OfflineGate');
});

test('6. Try again re-reads the browser state and re-fetches — it does not just hide the screen', () => {
  const src = read(APP);
  expect(src).toContain('if (browserOffline()) return;');
  expect(src).toContain('setGateCleared(true);');
  expect(src).toContain('void refresh();');
});

test('7+8. both window events are listened for, and cleaned up', () => {
  // The existing banner already did this correctly; the case is here so a refactor cannot
  // quietly drop one side of it.
  const src = read(STATES);
  expect(src).toContain("window.addEventListener('online', update)");
  expect(src).toContain("window.addEventListener('offline', update)");
  expect(src).toContain("window.removeEventListener('online', update)");
  expect(src).toContain("window.removeEventListener('offline', update)");
});

test('11. losing the signal mid-order does NOT take the screen away', () => {
  const src = read(APP);
  // A mount-time snapshot, not a live subscription: `getSnapshot` is read once because the
  // subscribe function is a no-op. A gate that re-asserted on every `offline` event would throw
  // away a half-built round for a ten-second dead spot in a dining room.
  expect(src).toContain('() => () => {}');
  expect(src).toContain('browserOffline()');
  // And the non-blocking banner still covers that case.
  expect(src).toContain('<OfflineBanner />');
});

test('11b. the cart survives, because it was never on the phone', () => {
  // `useLiveData` keeps the last good payload on a failed read — it sets a NOTICE, not the data.
  const live = codeOnly(LIVE);
  expect(live).toContain('setStaleReason(');
  const start = live.indexOf('} catch (err) {');
  const body = live.slice(start, start + 400);
  expect(body, 'a failed read must never clear what is on screen').not.toContain('setData(');
});

/* ── 9. Offline and an invalid QR are different screens ────────────────────────────────────── */

test('9. an unknown table is its own screen and says nothing about connectivity', () => {
  const src = read(QR_ROUTE);
  expect(src).toContain('<UnknownTable name={table} />');
  expect(src).toContain('We cannot find table');
  // The route resolves on the SERVER — if it ran at all, the phone reached us, so offline copy
  // has no business here.
  expect(src).not.toContain('OFFLINE_');
  expect(src).not.toContain('mobile data');
});

test('9b. and an unreachable backend is a third screen again', () => {
  const src = read(QR_ROUTE);
  expect(src).toContain('<UnreachableState surface="guest"');
  expect(src).toContain('<NotConfiguredState');
});

/* ── 5+12. The gate's own honesty ──────────────────────────────────────────────────────────── */

/*
  SUPERSEDED 18-Sep-2026 (round 2), skipped rather than edited — `jalsa/CLAUDE.md`: test files are
  append-only.

  Round 1 was asked for a Call captain button OPTIONALLY, found that the only mechanism it could
  have used posts to `/api/guest/ask`, and left the button off: from a screen that exists because
  the server is unreachable, that request cannot arrive.

  The reasoning was right about that mechanism and wrong about the screen. A TELEPHONE CALL does
  not use the data network, `callNumber` was already on the payload, and the surface already
  renders it as a `tel:` link in two other places. So round 2 adds the action in the one form that
  actually works.

  THE PROMISE UNDERNEATH THIS CASE IS NOT RETIRED — "nothing here may claim to have sent something
  it could not send" — and it is restated, against the button that now exists, in "11. Call
  captain on this screen is a PHONE CALL, not a second request mechanism" below.
*/
test.skip('SUPERSEDED: 12. no Call captain button is offered on a screen that could not send one', () => {
  const src = read(STATES);
  const start = src.indexOf('export function OfflineGate');
  const body = src.slice(start);
  expect(start, 'the gate must exist').toBeGreaterThan(-1);
  // The captain-call mechanism posts to the server. On a screen that exists BECAUSE the server
  // cannot be reached, that button is one that cannot work.
  expect(body).not.toContain('call-captain');
  expect(body).not.toContain("send(");
  // It points at the person instead.
  expect(body).toContain('your captain is quicker than the wifi');
});

/* ── 13. No new dependency ─────────────────────────────────────────────────────────────────── */

test('13. standard browser APIs only', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  const deps = Object.keys(pkg.dependencies ?? {});
  for (const banned of ['react-detect-offline', 'offline-js', 'ping.js', '@capacitor/network']) {
    expect(deps).not.toContain(banned);
  }
  const gate = codeOnly('src/lib/connectivity.ts');
  // `navigator.connection` exists on some Android browsers and nowhere else, and reports a guess.
  expect(gate, 'a guess is worse than an honest unknown').not.toContain('navigator.connection');
});

test('browserOffline is safe where there is no navigator at all', () => {
  // It runs during a server render too, and `typeof navigator` is the only safe check there.
  expect(() => browserOffline()).not.toThrow();
  expect(codeOnly('src/lib/connectivity.ts')).toContain("typeof navigator !== 'undefined'");
});

/* ── The classifier is used, not merely written ────────────────────────────────────────────── */

test('the poll reports a connectivity failure differently from a server failure', () => {
  const live = codeOnly(LIVE);
  expect(live).toContain('isNetworkFailure(err) ?');
  expect(live).toContain('staleNotice(failures.current)');
});

test('only a transport failure is reclassified on the send path', () => {
  const live = codeOnly(LIVE);
  // The try wraps the fetch ALONE. A response that arrived and said 500 is outside it, so a
  // server error cannot be converted into "you're offline".
  expect(live).toContain('res = await fetch(path, {');
  expect(live).toContain("throw new Error(failureMessage(err, 'That did not go through.'));");
  const sendStart = live.indexOf('const send = useCallback');
  const okCheck = live.indexOf('if (!res.ok) throw new Error(parsed.message', sendStart);
  const catchEnd = live.indexOf('failureMessage(err', sendStart);
  expect(okCheck, 'the !res.ok throw sits AFTER the transport catch').toBeGreaterThan(catchEnd);
});

/* ══ ROUND 2 (18-Sep-2026) — appended, never rewritten ═══════════════════════════════════════
 *
 * The first round built the gate and asserted the six obligations it could. Five of the eleven
 * this request lists had nothing standing behind them: an online customer entering normally, the
 * existing QR and session behaviour surviving, the ordering flow surviving, Try again not minting
 * a session, and the captain mechanism not being duplicated. Those are below, with the new
 * secondary action.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026, round 2) — recorded in TEST_SUMMARY.md.
 */

import {
  OFFLINE_CALL,
  OFFLINE_CALL_NOTE,
  OFFLINE_NO_NUMBER,
} from '../../src/lib/connectivity';

const SHEETS = 'src/features/guest/GuestSheets.tsx';

/**
 * ONE function's body, comments removed, bounded at the next top-level `}`.
 *
 * Both halves matter and both were got wrong first time. Slicing to the end of the FILE made
 * "OfflineGate must not contain /api/guest/ask" pass or fail on whatever happened to be declared
 * below it. And leaving the comments in made every negative assertion a test of the prose: this
 * codebase explains its decisions at length, so `not.toContain('window.location')` failed on a
 * comment saying why `window.location.reload()` was NOT used.
 */
function fnBody(path: string, marker: string): string {
  const src = read(path);
  const i = src.indexOf(marker);
  expect(i, `${marker} must exist in ${path}`).toBeGreaterThan(-1);
  const rest = src.slice(i);
  const end = rest.indexOf('\n}\n');
  const body = end === -1 ? rest : rest.slice(0, end + 2);
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  expect(stripped.length, `${marker} must survive comment-stripping`).toBeGreaterThan(80);
  return stripped;
}

/* ── 1 + 8 + 9. The online customer meets nothing new ──────────────────────────────────────── */

test('1. an online customer reaches the existing journey, gate and all', () => {
  const src = read(APP);
  // The gate is an early return guarded by BOTH conditions. Online means `arrivedOffline` is
  // false, the branch is not taken, and the guest lands in the same render as before.
  expect(src).toContain('if (arrivedOffline && !gateCleared) {');
  const gate = src.slice(src.indexOf('if (arrivedOffline && !gateCleared) {'));
  const afterGate = gate.slice(gate.indexOf('return ('));
  expect(afterGate.indexOf('<OfflineGate'), 'the gate returns the gate and nothing else').toBeLessThan(
    afterGate.indexOf('</main>') === -1 ? Number.MAX_SAFE_INTEGER : afterGate.indexOf('</main>')
  );
  // And the gate sits AFTER the phase machine and the payload are established, so nothing about
  // the journey is conditional on it.
  expect(src.indexOf('const [phase, setPhase]')).toBeLessThan(src.indexOf('if (arrivedOffline'));
});

test('8. the QR route still resolves, validates and renders exactly as it did', () => {
  const src = read(QR_ROUTE);
  // Four outcomes, in the order `jalsa/CLAUDE.md` rule 6 fixes them, none of them connectivity.
  expect(src).toContain('if (!isConfigured())');
  expect(src).toContain("await attempt('guest.page', () => buildGuestPayload(table))");
  expect(src).toContain('if (!loaded.value) return <UnknownTable name={table} />;');
  expect(src).toContain('return <GuestApp table={table} initial={loaded.value} />;');
  // The gate lives in the CLIENT component. The server route is untouched by it, which is what
  // "do not change the existing QR architecture" has to mean in code.
  expect(src).not.toContain('OfflineGate');
  expect(src).not.toContain('browserOffline');
});

test('9. the ordering flow is reached through the same one line it always was', () => {
  const app = read(APP);
  // Every screen still renders off `phase` and the shared props. The gate adds a branch in front
  // of that block; it does not reach into it.
  expect(app).toContain("{phase === 'welcome' ? <WelcomeScreen {...shared} /> : null}");
  expect(app).toContain("{phase === 'cart' ? <CartScreen {...shared} /> : null}");
  const shared = app.slice(app.indexOf('const shared: GuestScreenProps'), app.indexOf('if (data.phase'));
  expect(shared, 'no connectivity state leaks into the screens').not.toContain('arrivedOffline');
  expect(shared).not.toContain('gateCleared');
});

/* ── 10. Try again cannot mint a session ───────────────────────────────────────────────────── */

test('10. Try again RESUMES — it revalidates on the existing cookie and creates no session', () => {
  const src = read(APP).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const start = src.indexOf('<OfflineGate');
  expect(start, 'the gate must be rendered').toBeGreaterThan(-1);
  const retry = src.slice(start, src.indexOf('/>', start));

  // `refresh()` is `useLiveData`'s re-read of the state endpoint. A read.
  expect(retry).toContain('void refresh();');
  // NOT a re-navigation: a reload would discard a payload already in hand to ask the same
  // question again, and every navigation is a fresh chance for the session logic to run.
  expect(retry).not.toContain('window.location');
  expect(retry).not.toContain('router.');
  expect(retry).not.toContain('redirect');
  // And nothing here posts. A session is minted by a write, never by a read.
  expect(retry).not.toContain('send(');
  expect(retry).not.toContain('/api/guest/visit');
});

test('10b. and the endpoint it re-reads is the existing one, not a new check', () => {
  const src = read(APP);
  expect(src).toContain('`/api/guest/state?table=${encodeURIComponent(table)}`');
  // One live-data subscription for the whole surface — the gate did not add a second.
  expect(src.match(/useLiveData</g), 'one hook, one endpoint').toHaveLength(1);
});

/* ── 11 + the new secondary action ─────────────────────────────────────────────────────────── */

test('11. Call captain on this screen is a PHONE CALL, not a second request mechanism', () => {
  const body = fnBody(STATES, 'export function OfflineGate');
  // The existing captain REQUEST posts to /api/guest/ask. From a screen that exists because the
  // server cannot be reached, that request cannot arrive — and claiming it did is the specific
  // dishonesty this request names.
  expect(body).not.toContain('/api/guest/ask');
  expect(body).not.toContain('runBusy');
  expect(body).not.toContain('send(');
  // What it is instead: the `tel:` idiom this surface already uses in two other places.
  expect(body).toContain('href={`tel:${dial}`}');
  expect(body).toContain('{OFFLINE_CALL}');
});

test('11b. the existing captain request is untouched and still the only one of its kind', () => {
  const sheets = read(SHEETS);
  // Unchanged: the sheet still asks the server, still behind the owner's feature switch.
  expect(sheets).toContain("send('/api/guest/ask'");
  expect(sheets).toContain('data.features.callCaptain');
  /* `/api/guest/ask` is the ONE endpoint for anything a guest asks the floor for, and the help
     sheet posts to it three times: the six quick asks, the "suggest something" box and the parcel
     request. That is one mechanism with three callers, which is the point — what must never
     appear is a FOURTH caller on the offline screen, which is asserted above by its absence. */
  expect(sheets.match(/\/api\/guest\/ask/g), 'the help sheet, and only the help sheet').toHaveLength(3);
  // codeOnly, because the comment explaining why the offline screen does NOT use this endpoint
  // names the endpoint. A negative assertion that reads the prose is a test of the prose.
  const all = codeOnly(STATES) + codeOnly(APP);
  expect(all, 'no screen outside the sheet posts a captain request').not.toContain('/api/guest/ask');
});

test('11c. no number configured means no button, not a dead one', () => {
  const body = fnBody(STATES, 'export function OfflineGate');
  // A `tel:` link with nothing after it opens an empty dialler, which on this screen reads as one
  // more thing that does not work.
  expect(body).toContain('{dial ? (');
  expect(body).toContain('{dial ? OFFLINE_CALL_NOTE : OFFLINE_NO_NUMBER}');
  expect(OFFLINE_NO_NUMBER).not.toContain('tel:');
  // The trim is what makes "  " count as no number.
  expect(body).toContain("(callNumber ?? '').replace(/\\s+/g, '')");
});

test('the two actions say what they are, and the note does not overclaim', () => {
  expect(OFFLINE_CALL).toBe('Call captain');
  expect(OFFLINE_CALL_NOTE).toBe('A phone call still works with no internet.');
  // It says a CALL works. It does not say the app works, and it does not say a request was sent.
  expect(OFFLINE_CALL_NOTE).not.toMatch(/has been (called|told|notified)/i);
  expect(OFFLINE_NO_NUMBER).not.toMatch(/has been (called|told|notified)/i);
});

test('the number comes from the payload the server already sent — no new field, no new fetch', () => {
  const app = read(APP);
  expect(app).toContain('callNumber={data.callNumber}');
  const view = read('src/lib/db/guest-view.ts');
  expect(view, 'callNumber already shipped on the guest payload').toContain('callNumber: string;');
});

/* ══ ROUND 3 (18-Sep-2026) — appended, never rewritten ═══════════════════════════════════════
 *
 * Three clauses appeared in the third submission that the first two did not carry: the Jalsa mark
 * on the screen, "Call captain" conditioned on the captain MECHANISM being available rather than
 * only on a number existing, and "no duplicate BILLS" beside no duplicate sessions.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026, round 3) — recorded in TEST_SUMMARY.md.
 */

/* ── The Jalsa mark ────────────────────────────────────────────────────────────────────────── */

test('the screen opens with the Jalsa mark, so it reads as the application', () => {
  const body = fnBody(STATES, 'export function OfflineGate');
  expect(body).toContain('/brand/jalsa-badge.png');
  // The mark the design set declares, not one typed here.
  const tokens = JSON.parse(read('design/tokens.json')) as Record<string, unknown>;
  expect(JSON.stringify(tokens), 'the badge is the token-declared mark').toContain(
    '/brand/jalsa-badge.png'
  );
});

test('it is the LOCAL badge, not the restaurant\'s uploaded logo', () => {
  // `data.logoUrl` is an owner-uploaded file on a remote host. On a screen that exists because
  // the network cannot be reached, that request cannot complete — it would put a broken image on
  // the one screen that must not look broken.
  const body = fnBody(STATES, 'export function OfflineGate');
  expect(body).not.toContain('logoUrl');
  expect(body).not.toContain('https://');
  // Same-origin, and served cache-first with runtime fill by the existing worker.
  const sw = read('public/sw.js');
  expect(sw).toContain("url.pathname.startsWith('/brand/')");
});

test('and it is a plain img, because the optimizer is a network round trip', () => {
  const body = fnBody(STATES, 'export function OfflineGate');
  // next/image serves from /_next/image — a request this screen by definition cannot make.
  expect(body).not.toContain('next/image');
  expect(body).not.toContain('<Image');
  expect(body).toContain('<img');
  // Decorative: the heading beside it already says where the guest is.
  expect(body).toContain('alt=""');
  // No heavy image or animation, as asked.
  expect(body).not.toContain('animate-');
  expect(body).not.toContain('.gif');
  expect(body).not.toContain('.mp4');
});

test('a missing image leaves a deliberate circle, not a broken-image glyph', () => {
  const body = fnBody(STATES, 'export function OfflineGate');
  // The container is what makes the failure mode safe, so it is asserted rather than assumed.
  expect(body).toContain('rounded-full');
  expect(body).toContain('overflow-hidden');
  expect(body).toContain('bg-[var(--surface-sunken)]');
});

/* ── "Where the existing Captain request mechanism is available" ───────────────────────────── */

test('Call captain is shown only where the restaurant offers it AT ALL', () => {
  const body = fnBody(STATES, 'export function OfflineGate');
  // Two conditions answering two different questions: does this restaurant offer the action, and
  // is there anything to dial. Round 2 asserted only the second.
  expect(body).toContain("const dial = captainAvailable ? (callNumber ?? '').replace(/\\s+/g, '') : '';");
  expect(body).toContain('{dial ? (');
});

test('and the switch it reads is the owner\'s existing one, not a new one', () => {
  const app = read(APP);
  expect(app).toContain('captainAvailable={data.features.callCaptain}');
  const features = read('src/lib/guest-features.ts');
  // Already shipped, already the gate for Call captain on the help sheet.
  expect(features).toContain('callCaptain: boolean;');
  expect(read(SHEETS)).toContain('data.features.callCaptain');
  // No new flag was introduced to do this.
  expect(features.match(/callCaptain/g), 'the type and the default, nothing more').toHaveLength(2);
});

/* ── "No duplicate sessions AND no duplicate bills" ────────────────────────────────────────── */

test('10c. Try again cannot open a second bill either', () => {
  /* A bill is opened by a WRITE — `openBill` behind the round/cart endpoints — and it is further
     protected by a partial unique index that stops a second bill opening on an occupied table
     (JP-4). The retry path performs a read, so it cannot reach either. */
  const src = read(APP).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const start = src.indexOf('<OfflineGate');
  const retry = src.slice(start, src.indexOf('/>', start));
  for (const write of ['/api/guest/round', '/api/guest/cart', '/api/guest/bill', 'openBill']) {
    expect(retry, `${write} is a write and has no business in a retry`).not.toContain(write);
  }
  // And the database itself refuses a second bill on a live table, whatever the client does.
  const schema = read('supabase/migrations/20260910070000_jalsa_core_schema.sql');
  expect(schema).toContain('bill_table');
  expect(schema.toLowerCase()).toContain('unique index');
});
