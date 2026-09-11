/**
 * The two application instances the functional suite talks to.
 *
 * WHY THERE ARE TWO
 *   Most journeys need an application that is configured correctly. One class of journey needs
 *   the opposite — an application that is configured correctly and *cannot reach its database* —
 *   and that state cannot be produced by mocking in the browser, because the failure happens in
 *   a server component before any HTML is sent. So it is produced the only way it is produced in
 *   real life: by pointing a real instance at an address that does not answer.
 *
 * WHY 127.0.0.1:1 AND NOT A HOST THAT MERELY 404s
 *   Port 1 refuses the connection instantly on every platform, with no DNS lookup and no
 *   timeout. A test that waits thirty seconds for an unroutable address to give up is a test
 *   that gets deleted, and an outage screen nobody ever sees again.
 */

/** Where the correctly-configured instance lives. Playwright's own baseURL. */
export const APP_URL = process.env.TEST_APP_URL ?? 'http://localhost:3000';

/** Where the instance that cannot reach its database lives. */
export const DEGRADED_URL = process.env.TEST_DEGRADED_URL ?? 'http://127.0.0.1:3101';

/** An address that refuses instantly. Exported so the config and the specs cannot disagree. */
export const UNREACHABLE_DATABASE = 'http://127.0.0.1:1';
