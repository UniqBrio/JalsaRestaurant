'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { handleError } from '@/lib/errors';
import { newGate, begin, end, wrote, superseded } from './refresh-gate';
import { echoedState } from '@/lib/write-echo';
import { staleNotice } from '@/lib/stale-notice';
import { forgetStamp, isUnchanged, newCheck, pollTarget, readInFull, type CheckState } from './change-check';

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
 *   4. ONE IN FLIGHT — BUT A WRITE'S OWN READ IS NEVER DROPPED. A slow response must not stack
 *      up behind itself and arrive out of order, which is how a screen ends up showing an older
 *      state than the one it just showed. That applies to SCHEDULED polls. The read that follows
 *      a write is a different thing and `refresh-gate.ts` treats it as one: dropping it leaves
 *      the person looking at a screen that does not show what they just did, and the next thing
 *      they do is press the button again. See that file for the account.
 */

export interface LiveData<T> {
  data: T;
  refreshing: boolean;
  /** Set when the LAST refresh failed. `data` still holds the last good answer. */
  staleReason: string | null;
  refresh: () => Promise<void>;
  /** POST JSON, then refresh — a refresh that is never dropped. Throws with a user-worded
   *  message for the caller to surface. */
  send: <R>(path: string, payload: unknown) => Promise<R>;
}

export interface LiveOptions {
  /**
   * Ask "has anything changed?" on each tick instead of re-reading everything, and read in full
   * at least this often (see `change-check.ts`). Omitted: every tick is a full read, as before.
   */
  fullEveryMs?: number;
}

export function useLiveData<T>(url: string, initial: T, intervalMs = 6000, options: LiveOptions = {}): LiveData<T> {
  const [data, setData] = useState<T>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const gate = useRef(newGate());
  /* Consecutive failed reads. One is a blip on a phone in a restaurant, not an outage — see
     src/lib/stale-notice.ts for why this counts rather than reacting to the first. */
  const failures = useRef(0);
  /** The last payload as sent by the server. Compared as text so an identical poll changes no
   *  state at all — on the owner console that is one large tree not re-rendering every 8
   *  seconds for a screen that did not change. */
  const lastText = useRef<string | null>(null);
  /** The change-check state, when this screen uses one (fix 4). */
  const check = useRef<CheckState | null>(options.fullEveryMs ? newCheck(options.fullEveryMs) : null);

  const refreshOnce = useCallback(
    async (force: boolean): Promise<boolean> => {
      if (!begin(gate.current, force)) return false;
      setRefreshing(true);
      // A write that answers with its own screen may land while this read is out; if it does,
      // this read is older than what is showing and must not replace it (refresh-gate `wrote`).
      const seen = gate.current.writes;
      const now = Date.now();
      const target = check.current ? pollTarget(url, check.current, now, force) : { href: url, full: true };
      try {
        const res = await fetch(target.href, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${url} ${res.status}`);
        const text = await res.text();
        if (superseded(gate.current, seen)) {
          // Older than the screen. Drop it; the next tick reads afresh.
        } else if (check.current && isUnchanged(text)) {
          // Nothing this screen shows has moved since the stamp it sent. Keep everything.
        } else {
          if (text !== lastText.current) {
            lastText.current = text;
            setData(JSON.parse(text) as T);
          }
          if (check.current) readInFull(check.current, res.headers.get('x-change-stamp'), now);
        }
        failures.current = 0;
        setStaleReason(null);
      } catch (err) {
        // The engineer's copy still goes to the log every time, on the first failure as on the
        // tenth. What changes is only what the GUEST is told, and when.
        handleError(err, 'live.refresh');
        failures.current += 1;
        setStaleReason(staleNotice(failures.current));
      }
      // Deliberately NOT a `finally { return ... }`: a return inside finally discards any
      // exception the block was unwinding. Everything above is caught, so this line is reached
      // on both paths, and the gate is released exactly once either way.
      setRefreshing(false);
      return end(gate.current);
    },
    [url]
  );

  /** A scheduled poll. Dropped without ceremony if a read is already out. */
  const refresh = useCallback(async () => {
    await refreshOnce(false);
  }, [refreshOnce]);

  /** A read a person caused. Waits its turn rather than being dropped. */
  const refreshNow = useCallback(async () => {
    if (await refreshOnce(true)) await refreshOnce(true);
  }, [refreshOnce]);

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
        // Returning to the tab is a person, not a timer: show them the truth, do not drop it.
        void refreshNow();
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
  }, [refresh, refreshNow, intervalMs]);

  const send = useCallback(
    async <R>(path: string, payload: unknown): Promise<R> => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const parsed = (await res.json()) as R & { message?: string; state?: unknown };
      if (!res.ok) throw new Error(parsed.message ?? 'That did not go through.');

      /* If the write ANSWERED with the new state, that is the answer — apply it and stop.
         The server had just written it and was sitting next to the database; going back to
         fetch what it already handed us costs one round trip to another region, and can cost
         two, because a read a person caused is never dropped and a poll may already be out.
         Three serial trips with the screen frozen is what "adding or removing a tip takes too
         long" was (12-Sep-2026). See src/lib/db/guest-echo.ts for the server half. */
      const echoed = echoedState<T>(parsed);
      if (echoed !== null) {
        wrote(gate.current);
        if (check.current) forgetStamp(check.current);
        const text = JSON.stringify(echoed);
        if (text !== lastText.current) {
          lastText.current = text;
          setData(echoed);
        }
        failures.current = 0;
        setStaleReason(null);
        return parsed;
      }

      // No echo — fall back to reading it. Never `refresh()`: the whole point of this hook is
      // that what you just did appears on the screen, and a poll already on the wire must not
      // be allowed to swallow that.
      await refreshNow();
      return parsed;
    },
    [refreshNow]
  );

  // `refresh` on the returned object is the person-caused one: a screen asking for fresh
  // data on purpose is never a tick, and every caller of it means "now".
  return { data, refreshing, staleReason, refresh: refreshNow, send };
}
