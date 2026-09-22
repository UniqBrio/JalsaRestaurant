/**
 * redirect-lineage unit spec — a redirected ticket's contents come from the ticket it replaces.
 *
 * THE DEFECT THIS MODULE EXISTS TO CLOSE
 *   "Print elsewhere" inserts a NEW job against a machine a person chose, carrying THAT machine's
 *   station. Composed from its own identity it matched whichever half of the round the chosen
 *   machine happens to claim — so a tandoor round redirected to the main kitchen composed the
 *   MAIN KITCHEN's dishes, printed them a second time, and never delivered the tandoor's round at
 *   all. Not a refusal; a plausible-looking ticket for the wrong food.
 *
 * WHY THE WALK IS A MODULE AND NOT A LOOP INSIDE bridge-payload.ts
 *   It was written there first, and `bridge-payload.ts` imports `server-only`, so nothing in this
 *   repository could execute it. A depth cap nothing runs is a comment about a depth cap.
 *
 * FAIL-FIRST EVIDENCE (22-Sep-2026): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { MAX_REDIRECT_DEPTH, originOf, type LineageJob } from '../../src/lib/redirect-lineage';

const job = (over: Partial<LineageJob> & { id: string }): LineageJob => ({
  redirectedFromJobId: null,
  printerId: 'p3',
  station: 'Tandoor',
  foodSide: 'all',
  ...over,
});

/** A store that also counts reads, so "no lineage means no queries" is assertable. */
function store(...jobs: LineageJob[]): { read: (id: string) => Promise<LineageJob | null>; reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    read: async (id) => {
      reads.push(id);
      return jobs.find((j) => j.id === id) ?? null;
    },
  };
}

test('a job nobody redirected is its own origin, and costs no reads at all', async () => {
  const s = store();
  const result = await originOf(job({ id: 'a' }), s.read);

  expect(result.ok).toBe(true);
  expect(result.ok && result.origin.id).toBe('a');
  expect(result.ok && result.depth).toBe(0);
  expect(s.reads, 'the ordinary case must not touch the database').toEqual([]);
});

test('one redirect resolves to the ticket it replaced', async () => {
  const origin = job({ id: 'origin', printerId: 'p3', station: 'Tandoor', foodSide: 'non_veg' });
  const redirect = job({
    id: 'redirect',
    redirectedFromJobId: 'origin',
    // The chosen machine, and ITS station. This is the identity that must NOT decide the contents.
    printerId: 'p1',
    station: 'Main Kitchen',
    foodSide: 'all',
  });

  const result = await originOf(redirect, store(origin).read);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.origin.id).toBe('origin');
  expect(result.origin.printerId, 'the origin decides the contents').toBe('p3');
  expect(result.origin.station).toBe('Tandoor');
  expect(result.origin.foodSide).toBe('non_veg');
  expect(result.depth).toBe(1);
});

test('a chain is followed all the way to its root, not to the first hop', async () => {
  const chain = [
    job({ id: 'root', station: 'Tandoor', foodSide: 'veg_side' }),
    job({ id: 'one', redirectedFromJobId: 'root', station: 'Main Kitchen' }),
    job({ id: 'two', redirectedFromJobId: 'one', station: 'Counter' }),
  ];
  const result = await originOf(chain[2] as LineageJob, store(...chain).read);

  expect(result.ok && result.origin.id).toBe('root');
  expect(result.ok && result.origin.station).toBe('Tandoor');
  expect(result.ok && result.origin.foodSide).toBe('veg_side');
  expect(result.ok && result.depth).toBe(2);
});

test(`a chain exactly ${MAX_REDIRECT_DEPTH} long still resolves`, async () => {
  const chain: LineageJob[] = [job({ id: 'j0', station: 'Tandoor' })];
  for (let i = 1; i <= MAX_REDIRECT_DEPTH; i += 1) {
    chain.push(job({ id: `j${i}`, redirectedFromJobId: `j${i - 1}`, station: 'Elsewhere' }));
  }
  const result = await originOf(chain[MAX_REDIRECT_DEPTH] as LineageJob, store(...chain).read);

  expect(result.ok).toBe(true);
  expect(result.ok && result.origin.id).toBe('j0');
  expect(result.ok && result.depth).toBe(MAX_REDIRECT_DEPTH);
});

test('a chain one longer is BLOCKED, and never resolves to a halfway job', async () => {
  // The cap refuses rather than stopping where it ran out. A partial walk composes from whichever
  // job it halted on, which is the wrong-half defect arriving by a different road.
  const chain: LineageJob[] = [job({ id: 'j0' })];
  for (let i = 1; i <= MAX_REDIRECT_DEPTH + 1; i += 1) {
    chain.push(job({ id: `j${i}`, redirectedFromJobId: `j${i - 1}` }));
  }
  const result = await originOf(chain[MAX_REDIRECT_DEPTH + 1] as LineageJob, store(...chain).read);

  expect(result.ok).toBe(false);
  expect(!result.ok && result.blocked).toContain('redirected more than');
});

test('a lineage that points in a circle is BLOCKED rather than looped forever', async () => {
  const a = job({ id: 'a', redirectedFromJobId: 'b' });
  const b = job({ id: 'b', redirectedFromJobId: 'a' });
  const result = await originOf(a, store(a, b).read);

  expect(result.ok).toBe(false);
  expect(!result.ok && result.blocked).toContain('circle');
});

test('a job pointing at an origin that cannot be read is BLOCKED', async () => {
  // `print_job` is never hard-deleted, so this is a real anomaly rather than an ordinary absence.
  // Falling back to the redirect's own identity would be the defect.
  const result = await originOf(job({ id: 'a', redirectedFromJobId: 'gone' }), store().read);

  expect(result.ok).toBe(false);
  expect(!result.ok && result.blocked).toContain('can no longer be read');
});

test('every refusal reads as a sentence — it lands in print_job.last_error', async () => {
  const refusals = [
    await originOf(job({ id: 'a', redirectedFromJobId: 'gone' }), store().read),
    await (async () => {
      const chain: LineageJob[] = [job({ id: 'j0' })];
      for (let i = 1; i <= MAX_REDIRECT_DEPTH + 1; i += 1) {
        chain.push(job({ id: `j${i}`, redirectedFromJobId: `j${i - 1}` }));
      }
      return originOf(chain[MAX_REDIRECT_DEPTH + 1] as LineageJob, store(...chain).read);
    })(),
  ];
  for (const r of refusals) {
    expect(r.ok).toBe(false);
    if (r.ok) continue;
    expect(r.blocked.length).toBeGreaterThan(40);
    expect(r.blocked.trim().endsWith('.')).toBe(true);
  }
});

test('the walk reads each hop once and no more', async () => {
  const chain = [
    job({ id: 'root' }),
    job({ id: 'one', redirectedFromJobId: 'root' }),
    job({ id: 'two', redirectedFromJobId: 'one' }),
  ];
  const s = store(...chain);
  await originOf(chain[2] as LineageJob, s.read);
  expect(s.reads).toEqual(['one', 'root']);
});
