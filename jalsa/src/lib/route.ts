import 'server-only';
import { NextResponse } from 'next/server';
import { PermissionDenied } from '@/lib/permissions';
import { logError } from '@/lib/logger';

/**
 * route - the ONE shape every API answer takes, and the ONE place an exception becomes one.
 *
 * WHY IT MATTERS THAT THERE IS EXACTLY ONE
 *   The client's error taxonomy (src/lib/errors.taxonomy.ts) classifies by STATUS and CODE. If
 *   each handler invented its own envelope, the taxonomy would classify half the failures as
 *   `unknown`, and `unknown` is the class that produces "Something went wrong" on a screen
 *   where the guest can still see their own bill sitting there.
 *
 * WHAT NEVER CROSSES THIS BOUNDARY
 *   A database error's own message. It names tables, columns and constraints, and it is written
 *   for an engineer reading a log - not for someone at table A5. The engineer's copy goes to the
 *   log, always, before the user-facing translation is chosen.
 */

export interface ApiError {
  code: string;
  message: string;
  /** Present on a permission failure: which grant was missing. Drives the designed denied state. */
  permission?: string;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, { status: 200, ...init });
}

export function fail(status: number, body: ApiError): NextResponse {
  return NextResponse.json(body, { status });
}

/**
 * Wrap a handler so every failure leaves the same way.
 *
 * PermissionDenied becomes 403 with the permission named, because Standard 9.3 requires a
 * denied state that says which permission is missing and who can grant it - and a bare 403
 * cannot say either.
 */
export function handler(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof PermissionDenied) {
        return fail(403, { code: 'forbidden', message: err.message, permission: err.permission });
      }
      logError('api', err, { url: req.url });
      const message =
        err instanceof Error && err.message.startsWith('Configuration error')
          ? err.message
          : 'Something on our side failed. Nothing you did was lost — try again.';
      return fail(500, { code: 'server', message });
    }
  };
}

/** Parse a JSON body, treating malformed input as a validation failure rather than a crash. */
export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BadRequest('That request was not readable.');
  }
}

export class BadRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}
