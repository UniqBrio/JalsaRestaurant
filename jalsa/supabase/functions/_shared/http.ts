/**
 * _shared/http - ONE implementation of the things every cloud function needs.
 *
 * WHY SHARED AND NOT COPIED
 *   CORS headers, the response envelope and the error mapping re-declared in each function
 *   means N slightly different implementations, and a security header fixed in one place and
 *   forgotten in the other N-1. The rule is one blessed idiom per cross-cutting concern; this
 *   file is that idiom for HTTP.
 */

/**
 * CORS. The default is an ALLOWLIST, not `*`.
 *   `*` plus credentials is rejected by browsers anyway, and `*` without credentials is a
 *   standing invitation for any origin to call your API on a user's behalf. Name your origins.
 */
export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : allowed[0] ?? 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-idempotency-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export interface Envelope<T> { data?: T; error?: { code: string; message: string; details?: unknown } }

export const json = <T>(body: Envelope<T>, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export interface FunctionContext { userId: string; tenantId: string; roles: string[] }

export interface HandlerOptions {
  allowedOrigins: string[];
  methods: string[];
  /** Explicit, and it must carry a reason. An unexplained public function is an unreviewed one. */
  public?: { reason: string };
  requireRoles?: string[];
  /** Non-idempotent writes require a client-supplied retry key. */
  requireIdempotencyKey?: boolean;
}

/**
 * Wrap a handler with the behaviour every function must have and none should re-implement.
 *
 * The verification function MUST fail CLOSED: a network failure reaching the auth provider
 * denies the request. Failing open there converts a provider outage into an authorisation
 * bypass - the single most expensive shortcut available in this file.
 */
export function withRequestPipeline(
  options: HandlerOptions,
  verify: (req: Request) => Promise<FunctionContext | null>,
  handler: (req: Request, ctx: FunctionContext | null, idempotencyKey: string | null) => Promise<Envelope<unknown>>
) {
  if (options.public && !options.public.reason) {
    throw new Error('A public function must state a reason.');
  }

  return async (req: Request): Promise<Response> => {
    const cors = corsHeaders(req.headers.get('origin'), options.allowedOrigins);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!options.methods.includes(req.method)) {
      return json({ error: { code: 'method_not_allowed', message: 'That action is not available here.' } }, 405, cors);
    }

    let ctx: FunctionContext | null = null;
    if (!options.public) {
      try {
        ctx = await verify(req);
      } catch {
        return json({ error: { code: 'unauthenticated', message: 'Please sign in again.' } }, 401, cors);
      }
      if (!ctx) return json({ error: { code: 'unauthenticated', message: 'Please sign in again.' } }, 401, cors);
      if (options.requireRoles?.length && !options.requireRoles.some((r) => ctx!.roles.includes(r))) {
        return json({ error: { code: 'forbidden', message: 'You do not have permission to do that.' } }, 403, cors);
      }
    }

    const idempotencyKey = req.headers.get('x-idempotency-key');
    if (options.requireIdempotencyKey && !idempotencyKey) {
      return json({ error: { code: 'idempotency_key_required', message: 'This request needs a retry key so a repeated tap cannot be applied twice.' } }, 400, cors);
    }

    try {
      const result = await handler(req, ctx, idempotencyKey);
      return json(result, result.error ? 400 : 200, cors);
    } catch (err) {
      // The engineer gets the detail; the caller gets a calm sentence. Never trade one for the other.
      console.error(JSON.stringify({
        level: 'error',
        fn: new URL(req.url).pathname,
        tenantId: ctx?.tenantId,
        message: (err as Error)?.message ?? String(err),
      }));
      return json({ error: { code: 'server', message: 'Something went wrong on our side. Please try again shortly.' } }, 500, cors);
    }
  };
}

/**
 * Outbound-send guard. Every function that can message a real human calls this FIRST.
 *
 * The default is DENY. A test run that reaches a real customer cannot be undone; a test run
 * that fails to send costs one line in a log.
 */
export function assertOutboundAllowed(destination: string, env: { allowOutbound: boolean; allowlist: string[]; appEnv: string }) {
  if (env.appEnv === 'production') return;
  if (!env.allowOutbound) {
    throw new Error(`Outbound send to "${destination}" refused: ALLOW_OUTBOUND_MESSAGES is not enabled in ${env.appEnv}.`);
  }
  if (!env.allowlist.includes(destination)) {
    throw new Error(`Outbound send to "${destination}" refused: not in OUTBOUND_ALLOWLIST for ${env.appEnv}.`);
  }
}
