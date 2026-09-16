/**
 * CP-4 — ONE data client. Every read and write goes through it.
 *
 * WHY A SINGLE MODULE
 *   Auth headers, tenant scope, timeouts, retry policy, envelope parsing and error
 *   classification are all cross-cutting. Duplicated per call site, they are correct in the
 *   places someone remembered and silently absent everywhere else — and the absence is
 *   invisible until the failure it was meant to handle actually occurs.
 *
 *   A component that constructs its own request is a component that bypassed all six.
 */
import { publicConfig } from './config';
import { classifyError, retryPolicyFor } from './errors.taxonomy';

export interface Envelope<T> { data?: T; error?: { code: string; message: string; details?: unknown } }

let getToken: () => string | null = () => null;
/** Set once at application start. Keeps this module free of any auth-library import. */
export const setTokenProvider = (fn: () => string | null) => { getToken = fn; };

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function request<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string; timeoutMs?: number } = {}
): Promise<T> {
  const { idempotencyKey, timeoutMs = 15_000, ...rest } = init;
  const url = path.startsWith('http') ? path : `${publicConfig.apiUrl}${path}`;

  // Retry only what a retry can fix, and only ONCE. Retrying a 4xx multiplies load without
  // changing the answer; retrying indefinitely turns a blip into a self-inflicted outage.
  for (let attempt = 0; attempt < 2; attempt++) {
    // A request with no timeout is a hung connection, not a slow response.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = getToken();
      const res = await fetch(url, {
        ...rest,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
          // The server compares this and can tell the client it is stale, rather than
          // failing in a way that looks like a bug.
          'X-Client-Build': publicConfig.buildId,
          ...(rest.headers ?? {}),
        },
      });

      const body = (await res.json().catch(() => ({}))) as Envelope<T>;
      if (!res.ok || body.error) {
        const e = body.error ?? { code: 'server', message: 'Request failed' };
        const err = new ApiError(e.code, e.message, res.status, e.details);
        const policy = retryPolicyFor(classifyError({ status: res.status, code: e.code, message: e.message }));
        if (policy.retry && attempt === 0) { await sleep(policy.backoffMs); continue; }
        throw err;
      }
      return body.data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const policy = retryPolicyFor(classifyError(err));
      if (policy.retry && attempt === 0) { await sleep(policy.backoffMs); continue; }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError('server', 'Request failed after retry', 500);
}

export const get = <T>(path: string) => request<T>(path, { method: 'GET' });
export const post = <T>(path: string, body: unknown, idempotencyKey?: string) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body), ...(idempotencyKey !== undefined ? { idempotencyKey } : {}) });
export const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
