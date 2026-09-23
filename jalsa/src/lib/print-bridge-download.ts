/**
 * print-bridge-download — where the owner's "Download for Windows" button actually leads.
 *
 * THE RULE: NEVER A FAKE LINK
 *   A button that downloads nothing is worse than no button: the owner walks to the kitchen PC,
 *   and nothing is there. So the button exists only when one of two real sources exists, and the
 *   screen says plainly when neither does.
 *
 *   1. HOSTED — `PRINT_BRIDGE_DOWNLOAD_URL`, an https address where the deployment has published
 *      the packaged installer (object storage or a CDN). This is the production shape: a Vercel
 *      function cannot stream a ~40 MB file (its response limit is 4.5 MB), so production hands
 *      the browser a redirect to wherever the artifact lives.
 *   2. LOCAL — the packaged artifact on this server's own disk (`npm run bridge:package`), streamed
 *      by the route. This is what `next start` on a self-hosted machine and `next dev` use.
 *
 *   Neither → `none`, and the Printers screen says the installer has not been published for this
 *   server. That is a deployment step, and it is written down in `bridge/README.md`.
 *
 * THE OWNER NEVER SEES THE URL. The button points at `/api/owner/print-bridge/download`, which is
 * behind the owner's sign-in and the printer permission, and which redirects or streams.
 */

/** Where `npm run bridge:package` writes the artifact, relative to the application root. */
export const BRIDGE_PACKAGE_PATH = 'bridge/dist/jalsa-print-bridge-windows.zip';
/** The name the browser saves it under. Says what it is, to a person looking in Downloads. */
export const BRIDGE_PACKAGE_FILENAME = 'Jalsa-Print-Bridge-Windows.zip';
/** The owner-facing route. The only address the screen ever names. */
export const BRIDGE_DOWNLOAD_ROUTE = '/api/owner/print-bridge/download';

export type BridgeDownload =
  | { kind: 'hosted'; url: string }
  | { kind: 'local'; path: string }
  | { kind: 'none' };

/** An https URL, or nothing. A plain-http installer is a man-in-the-middle's gift. */
export function hostedUrl(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function resolveBridgeDownload(input: { hosted: string | undefined; localExists: boolean }): BridgeDownload {
  const url = hostedUrl(input.hosted);
  if (url) return { kind: 'hosted', url };
  if (input.localExists) return { kind: 'local', path: BRIDGE_PACKAGE_PATH };
  return { kind: 'none' };
}

export const DOWNLOAD_UNAVAILABLE =
  'The Windows installer has not been published for this Jalsa server yet. Ask whoever runs your Jalsa server to publish Jalsa Print Bridge.';
