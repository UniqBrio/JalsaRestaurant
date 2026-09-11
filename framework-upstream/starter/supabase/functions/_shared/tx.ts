/**
 * CP-10 — a multi-write flow is ONE transaction.
 *
 * THE BUG THIS PREVENTS
 *   A cascade of three writes issued as three requests can leave two applied and one not. That
 *   partial state is usually invalid, usually invisible, and usually discovered weeks later by
 *   someone reconciling by hand.
 *
 *   "It only fails if the network drops between step two and step three" is not reassurance.
 *   At scale that is a daily occurrence.
 *
 * THE RULE
 *   Anything that must succeed together executes inside one server-side transaction. If the
 *   steps genuinely cannot share a transaction — one of them calls an external service —
 *   then the flow needs an explicit compensating action, and that is a design decision to be
 *   made deliberately, not discovered.
 */

export interface TxClient {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export async function withTransaction<T>(
  client: TxClient,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  await client.query('begin');
  try {
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    // Rollback must not mask the original error - that error is the only thing that explains
    // what went wrong, and losing it turns a clear failure into a mystery.
    try { await client.query('rollback'); } catch { /* intentionally swallowed */ }
    throw err;
  }
}

/**
 * For a flow that CANNOT be one transaction — because a step leaves the database, such as
 * charging a card or sending a message.
 *
 * Two rules that make this survivable:
 *   1. The external step goes LAST, after everything reversible has committed.
 *   2. Its failure is recorded as a durable, visible state — never a silent retry loop and
 *      never a swallowed exception. Someone must be able to find it and act.
 */
export interface CompensatingStep { do: () => Promise<void>; undo: () => Promise<void>; name: string }

export async function withCompensation(steps: CompensatingStep[]): Promise<void> {
  const done: CompensatingStep[] = [];
  try {
    for (const step of steps) { await step.do(); done.push(step); }
  } catch (err) {
    for (const step of done.reverse()) {
      try { await step.undo(); } catch (undoErr) {
        // A failed compensation is a data-integrity incident, not a log line. It must be loud
        // enough that a human sees it, because nothing else will fix it.
        console.error(JSON.stringify({
          level: 'error', event: 'compensation_failed', step: step.name,
          message: (undoErr as Error)?.message,
        }));
      }
    }
    throw err;
  }
}
