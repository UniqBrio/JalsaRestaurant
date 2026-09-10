'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { handleError } from '@/lib/errors';

/**
 * useLiveData — the ONE way this application keeps a screen current (Standard 10.4).
 *
 * All three surfaces need the same four behaviours, and every one of them is a defect if a
 * screen invents its own version:
 *
 *   1. POLL, don't stream. What arrives from elsewhere — a round sent, a round ready, a request
 *      raised, a dish sold out — is seconds-urgent, not milliseconds-urgent, and every one of
 *      those events also has a person narrating it in the room. Polling survives a dead spot
 *      without a reconnect storm, and it needs no browser-reachable database policy, so a phone
 *      on the restaurant's wifi still cannot read anyone else's bill.
 *
 *   2. STOP WHEN HIDDEN. A handset in an apron pocket polling all evening is a flat battery by
 *      nine. It resumes on focus and re-reads immediately, so returning to the tab shows the
 *      truth rather than a stale screen under a spinner.
 *
 *   3. NEVER BLANK ON FAILURE. The last good payload stays and a reason is surfaced beside it.
 *      A captain in a dead spot can still read the table they are standing at; blanking would be
 *      honest about the network and useless about the work.
 *
 *   4. ONE IN FLIGHT. A slow response must not stack up behind itself and arrive out of order,
 *      which is how a screen ends up showing an older state than the one it just showed.
 */

export interface LiveData<T> {
  data: T;
  refreshing: boolean;
  /** Set when the LAST refresh failed. `data` still holds the last good answer. */
  staleReason: string | null;
  refresh: () => Promise<void>;
  /** POST JSON, then refresh. Throws with a user-worded message for the caller to surface. */
  send: <R>(path: string, payload: unknown) => Promise<R>;
}

export function useLiveData<T>(url: string, initial: T, intervalMs = 6000): LiveData<T> {
  const [data, setData] = useState<T>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      setData((await res.json()) as T);
      setStaleReason(null);
    } catch (err) {
      const handled = handleError(err, 'live.refresh');
      setStaleReason(handled.message ?? 'This screen is not live at the moment.');
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [url]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (!timer) timer = setInterval(() => void refresh(), intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onWake = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [refresh, intervalMs]);

  const send = useCallback(
    async <R>(path: string, payload: unknown): Promise<R> => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const parsed = (await res.json()) as R & { message?: string };
      if (!res.ok) throw new Error(parsed.message ?? 'That did not go through.');
      await refresh();
      return parsed;
    },
    [refresh]
  );

  return { data, refreshing, staleReason, refresh, send };
}
