/**
 * refresh-gate — deciding whether a refresh may start, and what happens when one is already
 * running.
 *
 * WHY THIS IS A MODULE AND NOT THREE LINES INSIDE THE HOOK
 *   It was three lines inside the hook, and they were wrong. One boolean served two different
 *   jobs: "do not stack scheduled polls on top of each other" and "serialise every read". The
 *   first is correct — a dropped tick costs nothing, the next one is six seconds away. The
 *   second silently discards the read that matters most.
 *
 * THE DEFECT IT EXISTS TO PREVENT
 *   A captain presses Send. The POST succeeds. The hook then asks for fresh state — and is
 *   refused, because a scheduled poll happened to be waiting on the network at that moment. The
 *   screen keeps showing the round as unsent for up to six seconds (eight on the owner console).
 *   The captain presses Send again. Now there are two rounds in the kitchen and two lines on the
 *   guest's bill, and nothing anywhere recorded a mistake.
 *
 * THE RULE
 *   A refresh a PERSON caused is never dropped. If one is already in flight it is remembered and
 *   re-run the moment that one finishes, so the read always reflects the write. A refresh a TIMER
 *   caused is dropped freely — that is what a timer is for.
 */

export interface GateState {
  /** A refresh is currently awaiting the network. */
  inFlight: boolean;
  /** A person-caused refresh arrived while one was in flight, and is owed a run. */
  pending: boolean;
  /** How many writes have answered WITH the screen they changed (see `wrote`). */
  writes: number;
}

export const newGate = (): GateState => ({ inFlight: false, pending: false, writes: 0 });

/**
 * A write has answered with the screen it changed, and that screen is now showing.
 *
 * THE SAME DEFECT, BY A SECOND DOOR (review of latency fix 3, 24-Sep-2026)
 *   When a write answers with its own screen, no read follows it — so the gate above never sees
 *   it. A scheduled poll that left BEFORE the write can still land AFTER its answer, carrying the
 *   state from before the tap, and put the round back to "unsent" for six seconds. That is the
 *   exact double-send this module was written to stop. A read that started before a write's answer
 *   is therefore older than what is on screen, and is discarded (`superseded`).
 */
export function wrote(state: GateState): void {
  state.writes += 1;
}

/** Did a write answer while this read was out? `seen` is `state.writes` when the read began. */
export function superseded(state: GateState, seen: number): boolean {
  return state.writes !== seen;
}

/**
 * May this refresh start now?
 *
 * `force` marks a refresh a person caused — after a write, or on returning to the tab. Returns
 * false for a dropped scheduled poll, and false-but-remembered for a forced one that must wait.
 */
export function begin(state: GateState, force = false): boolean {
  if (!state.inFlight) {
    state.inFlight = true;
    return true;
  }
  // Already reading. A timer's request is worthless now; a person's is owed.
  if (force) state.pending = true;
  return false;
}

/**
 * The in-flight refresh has finished. Returns true when a person-caused refresh was deferred and
 * must now run — the caller re-enters immediately rather than waiting for the next tick.
 */
export function end(state: GateState): boolean {
  state.inFlight = false;
  if (!state.pending) return false;
  state.pending = false;
  return true;
}
