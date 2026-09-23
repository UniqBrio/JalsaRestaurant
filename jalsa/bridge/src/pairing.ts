import { PAIRED_CONFIG_VERSION, type PairedConfig } from './paired-config';

/**
 * pairing — the installer's one question, and the answer written to disk.
 *
 * The person at the kitchen PC types the code Jalsa showed the owner. This exchanges it for the
 * computer's credential and nothing else: the request names no restaurant (the code decides that,
 * server-side) and the response is written straight to `config.json`, never echoed.
 *
 * `fetch` is injected, so every refusal — wrong code, used code, expired code, no network — is
 * exercised by a unit spec rather than discovered at a restaurant.
 */

export type PairOutcome = { ok: true; config: PairedConfig } | { ok: false; message: string };

/** Forgive case, spaces and dashes; the server applies the real rule. */
export const tidyCode = (raw: string): string => raw.toUpperCase().replace(/[\s-]+/g, '');

export const NO_NETWORK =
  'This computer could not reach Jalsa. Check the internet connection on this computer and try again.';

export async function pairComputer(input: {
  origin: string;
  code: string;
  hostname: string;
  bridgeVersion: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<PairOutcome> {
  const doFetch = input.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${input.origin.replace(/\/+$/, '')}/api/bridge/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: tidyCode(input.code), hostname: input.hostname, bridgeVersion: input.bridgeVersion }),
    });
  } catch {
    return { ok: false, message: NO_NETWORK };
  }

  let body: Record<string, unknown> = {};
  try {
    body = ((await res.json()) ?? {}) as Record<string, unknown>;
  } catch {
    // A proxy's HTML error page, a captive portal. Not Jalsa.
    return { ok: false, message: NO_NETWORK };
  }

  if (!res.ok) {
    const said = typeof body.message === 'string' && body.message ? body.message : '';
    return { ok: false, message: said || `Jalsa refused the code (${res.status}). Get a new code in Jalsa and try again.` };
  }

  const token = typeof body.token === 'string' ? body.token : '';
  const apiUrl = typeof body.apiUrl === 'string' ? body.apiUrl : '';
  const label = typeof body.label === 'string' ? body.label : '';
  if (!token.startsWith('jbt_') || !apiUrl || !label) {
    return { ok: false, message: 'Jalsa answered in a way this installer does not understand. Update Jalsa Print Bridge and try again.' };
  }

  return {
    ok: true,
    config: {
      version: PAIRED_CONFIG_VERSION,
      apiUrl,
      token,
      label,
      restaurantName: typeof body.restaurantName === 'string' ? body.restaurantName : '',
      pairedAt: (input.now ?? (() => new Date()))().toISOString(),
    },
  };
}
