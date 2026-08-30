'use client';
/**
 * CP-3 — every async loader TERMINATES.
 *
 * THE BUG THIS PREVENTS
 *   A spinner with no `finally` hangs forever on the one path nobody tested. It is not a slow
 *   success; it is a failure that looks like patience, and the user waits instead of retrying.
 *
 *   Two further hazards handled here because they are always handled wrong at the call site:
 *   a late response from a superseded request overwriting a newer one, and a state update
 *   after unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { handleError } from '../lib/errors';

export interface AsyncState<T> {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: T | null;
  /** Already user-safe: it came through the wording table, not from the raw error. */
  error: string | null;
}

export function useAsync<T>(fn: () => Promise<T>, context: string, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle', data: null, error: null });
  const alive = useRef(true);
  const runId = useRef(0);

  // Set on mount, not only at ref creation: under StrictMode (and any remount that reuses
  // state) the cleanup below has already flipped this to false, and a ref initialised once
  // would stay false forever - every load silently ignored, the spinner permanent.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const data = await fn();
      // Ignore a response that a newer request has already superseded.
      if (!alive.current || id !== runId.current) return;
      setState({ status: 'success', data, error: null });
    } catch (err) {
      if (!alive.current || id !== runId.current) return;
      const { message } = handleError(err, context);
      setState({ status: 'error', data: null, error: message });
    }
    // No `finally` that flips status: each branch above sets a TERMINAL status, so there is no
    // path out of this function that leaves the state on 'loading'. That is the guarantee.
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void run(); }, [run]);

  return { ...state, reload: run } as const;
}
