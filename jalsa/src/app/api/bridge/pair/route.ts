import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { publicConfig } from '@/lib/config';
import { normalizePairingCode, PAIRING_MESSAGES } from '@/lib/bridge-pairing-code';
import { redeemPairingCode } from '@/lib/db/bridge-pairing';

/**
 * POST /api/bridge/pair — a printing computer exchanges a pairing code for its credential.
 *
 * ONE VERB, AND IT IS NOT ONE OF THE BRIDGE'S. This route cannot list, claim or report anything;
 * it can only spend a code. It is separate from `/api/bridge` so that route keeps its rule — every
 * request carries a bearer token, checked before the body is read — without an exception carved
 * into it for the one caller that has no token yet.
 *
 * WHAT THE REQUEST CANNOT SAY: which restaurant. There is no field for it. The credential belongs
 * to whichever restaurant issued the code, and that is decided by the code's own row.
 *
 * The answer carries the bridge API address this server considers canonical, so the installer
 * does not have to be told it twice.
 */

interface PairRequest {
  code?: unknown;
  hostname?: unknown;
  bridgeVersion?: unknown;
}

export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const input = await body<PairRequest>(req);
  const code = normalizePairingCode(input.code);
  if (!code) return fail(400, { code: 'bad_code', message: PAIRING_MESSAGES.unknown });

  const result = await redeemPairingCode({
    code,
    hostname: typeof input.hostname === 'string' ? input.hostname : '',
    bridgeVersion: typeof input.bridgeVersion === 'string' ? input.bridgeVersion : '',
  });

  if (!result.ok) {
    // 410 for a code that existed and is spent or stale; 400 for one that never did.
    return fail(result.verdict === 'unknown' ? 400 : 410, {
      code: `pairing_${result.verdict}`,
      message: PAIRING_MESSAGES[result.verdict],
    });
  }

  return ok({
    apiUrl: `${publicConfig.appUrl.replace(/\/+$/, '')}/api/bridge`,
    token: result.token,
    label: result.label,
    restaurantName: result.restaurantName,
  });
});
