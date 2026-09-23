/**
 * The bridge's own version, reported to Jalsa on every sync and shown to whoever is diagnosing a
 * PC. Bumped by hand with any change a kitchen PC would need to re-download for.
 *
 * 2.0.0 — pairing, printer discovery, the windows-queue transport and the unattended service.
 * 2.0.1 — installer scripts ASCII-only, shipped with a BOM and CRLF (the first real Windows run
 *         found `→` decoded as a quote by Windows PowerShell 5.1).
 */
export const BRIDGE_VERSION = '2.0.1';
