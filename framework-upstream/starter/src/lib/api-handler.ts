/**
 * api-handler - the one shape every backend endpoint takes.
 *
 * WHY A WRAPPER AND NOT A CONVENTION
 *   A convention is followed until someone is in a hurry. This wrapper makes the correct
 *   behaviour the DEFAULT and the incorrect behaviour extra work:
 *     - authentication is required unless `public: true` is written down deliberately;
 *     - tenant scope is resolved once and handed to the handler, so no query can forget it;
 *     - every response has the same envelope, so clients need one parser;
 *     - internal error detail reaches the log and never the response body;
 *     - a write declares its idempotency key, so a double-tap cannot double-charge.
 *
 * THE ENVELOPE
 *   Success: { data, meta? }        Failure: { error: { code, message, details? } }
 *   `code` is a stable machine string the client maps to behaviour. `message` is already
 *   user-safe. `details` is field-level validation only - never a stack, never SQL.
 */
import { classifyError, userMessageFor } from './errors.taxonomy';
import { logError } from './logger';

export interface AuthContext {
  userId: string;
  /** The isolation boundary. EVERY query must be scoped by this. */
  tenantId: string;
  roles: string[];
}

export interface HandlerRequest {
  method: string;
  headers: Record<string, string | undefined>;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface HandlerResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface RouteOptions<TBody> {
  /** Explicit opt-out of auth. A public endpoint must be a written decision with a reason. */
  public?: boolean;
  /** Empty means "any authenticated user". Listed roles are required. */
  requireRoles?: string[];
  methods: string[];
  /** Parse AND validate. Returning a typed value here is what keeps the handler body honest. */
  parseBody?: (raw: unknown) => TBody;
  /** For non-idempotent writes: the header carrying the client's dedupe key. */
  idempotencyHeader?: string;
  reason?: string;
}

export type Handler<TBody> = (args: {
  req: HandlerRequest;
  auth: AuthContext | null;
  body: TBody;
  idempotencyKey: string | null;
}) => Promise<{ data: unknown; meta?: unknown; status?: number }>;

const ok = (data: unknown, meta?: unknown, status = 200): HandlerResponse => ({
  status,
  headers: { 'Content-Type': 'application/json' },
  body: meta === undefined ? { data } : { data, meta },
});

const fail = (status: number, code: string, message: string, details?: unknown): HandlerResponse => ({
  status,
  headers: { 'Content-Type': 'application/json' },
  body: { error: details === undefined ? { code, message } : { code, message, details } },
});

const STATUS_FOR: Record<string, number> = {
  forbidden: 403, unauthenticated: 401, 'session-dead': 401, conflict: 409,
  validation: 422, 'not-found': 404, 'rate-limited': 429, 'stale-client': 409,
  offline: 503, network: 502, server: 500, unknown: 500,
};

/** Replace with a real verifier. It MUST fail closed: any doubt is a 401, never a pass. */
export type Authenticate = (req: HandlerRequest) => Promise<AuthContext | null>;

export function createRoute<TBody = unknown>(
  options: RouteOptions<TBody>,
  handler: Handler<TBody>,
  authenticate: Authenticate
) {
  if (options.public && !options.reason) {
    throw new Error('A public route must state a `reason`. An unexplained public endpoint is an unreviewed one.');
  }

  return async function route(req: HandlerRequest): Promise<HandlerResponse> {
    const context = `${req.method} ${String(req.query?.__route ?? 'route')}`;

    if (!options.methods.includes(req.method)) {
      return fail(405, 'method_not_allowed', 'That action is not available here.');
    }

    let auth: AuthContext | null = null;
    if (!options.public) {
      try {
        auth = await authenticate(req);
      } catch (err) {
        // An auth provider outage must deny, never admit. Failing open here is a breach.
        logError(context, err, { stage: 'authenticate' });
        return fail(401, 'unauthenticated', 'Please sign in again.');
      }
      if (!auth) return fail(401, 'unauthenticated', 'Please sign in again.');

      if (options.requireRoles?.length && !options.requireRoles.some((r) => auth!.roles.includes(r))) {
        // Deny at the ROUTE, not only in the UI. A hidden button is not access control.
        return fail(403, 'forbidden', 'You do not have permission to do that.');
      }
    }

    let body = req.body as TBody;
    if (options.parseBody) {
      try {
        body = options.parseBody(req.body);
      } catch (err) {
        return fail(422, 'validation', 'Please check the highlighted fields and try again.', (err as { details?: unknown })?.details);
      }
    }

    const idempotencyKey = options.idempotencyHeader
      ? req.headers[options.idempotencyHeader.toLowerCase()] ?? null
      : null;
    if (options.idempotencyHeader && !idempotencyKey) {
      return fail(400, 'idempotency_key_required',
        'This request needs a retry key so a repeated tap cannot be applied twice.');
    }

    try {
      const result = await handler({ req, auth, body, idempotencyKey });
      return ok(result.data, result.meta, result.status ?? 200);
    } catch (err) {
      const cls = classifyError(err);
      logError(context, err, { cls, userId: auth?.userId, tenantId: auth?.tenantId });
      return fail(
        STATUS_FOR[cls] ?? 500,
        cls,
        userMessageFor(cls) ?? 'Something went wrong. Please try again.'
      );
    }
  };
}
