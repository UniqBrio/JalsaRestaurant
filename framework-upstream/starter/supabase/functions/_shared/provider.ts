/**
 * CP-12 — calling an external model provider.
 *
 * Five rules, each from a distinct failure mode:
 *
 *   1. SERVER-SIDE ONLY. A provider key in a client bundle is a key you have published.
 *   2. MINIMAL PAYLOAD. Send the least data that answers the question. Anything you send has
 *      left your system permanently, whatever the retention policy says today.
 *   3. THE OUTPUT IS UNTRUSTED. It is data, never instructions. It may contain text designed
 *      to be read as a command, and it may simply be wrong with total confidence.
 *   4. DEGRADE GRACEFULLY AND VISIBLY. "This is temporarily unavailable" is a fine answer.
 *      Silently returning an empty result is not — it looks like a real answer.
 *   5. PIN VERSIONS. An unpinned model changes under you, and the change arrives as a
 *      production incident with no deploy to correlate it against.
 */

export interface ProviderConfig {
  endpoint: string;
  apiKey: string;
  /** Pinned. "we changed the prompt slightly" is an undocumented migration. */
  model: string;
  promptVersion: string;
  timeoutMs: number;
  maxCostPerCallCents: number;
}

export interface ProviderResult<T> {
  ok: boolean;
  data?: T;
  /** Already user-safe. Never the provider's raw error. */
  error?: string;
  meta: { model: string; promptVersion: string; latencyMs: number; degraded: boolean };
}

export async function callProvider<T>(
  cfg: ProviderConfig,
  payload: Record<string, unknown>,
  parse: (raw: unknown) => T
): Promise<ProviderResult<T>> {
  const started = Date.now();
  const meta = { model: cfg.model, promptVersion: cfg.promptVersion, latencyMs: 0, degraded: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ ...payload, model: cfg.model }),
    });

    meta.latencyMs = Date.now() - started;

    if (!res.ok) {
      // Log the detail; return a sentence. The provider's error text is for you, not the user.
      console.error(JSON.stringify({ level: 'error', event: 'provider_error', status: res.status, model: cfg.model }));
      return { ok: false, error: 'That is temporarily unavailable. Please try again shortly.', meta: { ...meta, degraded: true } };
    }

    const raw = await res.json();

    // VALIDATE. A model can return well-formed JSON with a wrong shape, and an unvalidated
    // shape becomes a runtime error three layers away from here, where it is unrecognisable.
    try {
      return { ok: true, data: parse(raw), meta };
    } catch {
      console.error(JSON.stringify({ level: 'error', event: 'provider_shape_invalid', model: cfg.model }));
      return { ok: false, error: 'We could not read that result. Please try again.', meta: { ...meta, degraded: true } };
    }
  } catch (err) {
    meta.latencyMs = Date.now() - started;
    const aborted = (err as Error)?.name === 'AbortError';
    console.error(JSON.stringify({ level: 'error', event: aborted ? 'provider_timeout' : 'provider_failure', model: cfg.model }));
    return { ok: false, error: 'That is temporarily unavailable. Please try again shortly.', meta: { ...meta, degraded: true } };
  } finally {
    clearTimeout(timer);
  }
}
