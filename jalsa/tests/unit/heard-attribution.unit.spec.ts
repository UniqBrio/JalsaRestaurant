import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import { SEEDED_HEARD_SOURCES, heardKey, tallyHeard } from '../../src/lib/heard-about';

/**
 * 02-Oct-2026 — "How did you hear about us?" answers are kept, asked of every phone once, and
 * counted the same way in Uplift and in Reports.
 *
 * The write is the real `recordHeardAbout` on the round rig (tests/support/rounds/heard.scenarios.ts):
 * an answer goes to `guest_attribution`, which survives the session (see guest-attribution.db).
 */

interface Write {
  table: string;
  op: string;
  body: Record<string, unknown>;
  filters: string[];
}
interface Result {
  name: string;
  threw: string | null;
  writes: Write[];
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/heard.scenarios.ts', import.meta.url));
let results: Result[] = [];
const by = (name: string): Result => results.find((r) => r.name === name)!;

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

test('an answer is written to the attribution that survives, as well as to the session', () => {
  const r = by('first answer');
  expect(r.threw).toBeNull();
  expect(r.writes.find((w) => w.table === 'guest_session')?.body).toEqual({ heard_about: 'Google review' });
  const kept = r.writes.find((w) => w.table === 'guest_attribution');
  expect(kept?.op).toBe('insert');
  expect(kept?.body).toMatchObject({
    restaurant_id: 'r1',
    session_token: 'phone-a',
    source: 'Google review',
    guest_session_id: 's1',
    table_id: 't1',
    bill_id: 'b1',
  });
});

test('re-picking in the same sitting corrects the answer - it is never counted twice', () => {
  const kept = by('re-picked in the same sitting').writes.filter((w) => w.table === 'guest_attribution');
  expect(kept).toHaveLength(1);
  expect(kept[0]).toMatchObject({ op: 'update', body: { source: 'Instagram' } });
  expect(kept[0]?.filters).toContain('eq:id=a1');
});

test('clearing the answer in the same sitting withdraws it', () => {
  const kept = by('cleared in the same sitting').writes.filter((w) => w.table === 'guest_attribution');
  expect(kept).toEqual([{ table: 'guest_attribution', op: 'delete', body: null, filters: ['eq:id=a1'] }]);
});

test('"Not now" is remembered on the session and records no answer', () => {
  const r = by('not now');
  expect(r.writes).toHaveLength(1);
  expect(r.writes[0]?.table).toBe('guest_session');
  expect(Object.keys(r.writes[0]!.body)).toEqual(['heard_dismissed_at']);
});

/* ── Counting ─────────────────────────────────────────────────────────────────────────────── */

test('the standard choices stay standard, however they were typed', () => {
  const t = tallyHeard(['google review!', 'Google  Review', 'GOOGLE-REVIEW', 'Friend recommended']);
  expect(t[0]).toEqual({ source: 'Google review', count: 3, share: 75 });
  expect(t[1]).toEqual({ source: 'Friend recommended', count: 1, share: 25 });
  expect(SEEDED_HEARD_SOURCES).toEqual(['Google review', 'Friend recommended', 'Ordered earlier', 'Regular customer']);
});

test('a guest\'s own answer stays visible, and its plural is not a second source', () => {
  const t = tallyHeard(['Walked past', 'walked past.', 'Friends recommended', 'Instagram']);
  expect(t).toContainEqual({ source: 'Walked past', count: 2, share: 50 });
  // "Friends recommended" is the standard "Friend recommended", not a new source.
  expect(t).toContainEqual({ source: 'Friend recommended', count: 1, share: 25 });
  expect(t).toContainEqual({ source: 'Instagram', count: 1, share: 25 });
});

test('nothing is guessed: a different word is a different source', () => {
  // "Google" is not folded into "Google review" - that would be inventing what the guest meant.
  const t = tallyHeard(['Google', 'Google review']);
  expect(t.map((r) => r.source).sort()).toEqual(['Google', 'Google review']);
  expect(heardKey(' Google—Review! ')).toBe('google review');
});

/* ── Where it is asked, and where it is read ──────────────────────────────────────────────── */

const code = (p: string): string => readFileSync(p, 'utf8');

test('a phone that joined after the first round is asked once on its order screen', () => {
  const app = code('src/features/guest/GuestApp.tsx');
  expect(app).toContain("const [joinedLate] = React.useState(() => startingPhase(factsOf(initial)) !== 'welcome');");
  const progress = code('src/features/guest/GuestProgress.tsx');
  expect(progress).toContain('{joinedLate && !data.heardAbout && !data.heardDismissed ? <HeardPrompt data={data} send={send} /> : null}');
  const prompt = code('src/features/guest/HeardPrompt.tsx');
  expect(prompt).toContain("send('/api/guest/heard', { dismiss: true })");
  expect(prompt).toContain("send('/api/guest/heard', { source })");
});

test('the owner reads the surviving answers, in Uplift and in Reports, with the same card', () => {
  const q = code('src/lib/db/queries.ts');
  const fn = q.slice(q.indexOf('export async function listHeardAboutBetween'));
  expect(fn.slice(0, 900)).toContain(".from('guest_attribution')");
  expect(fn.slice(0, 900)).toContain(".gte('answered_at', start.toISOString())");
  const reports = code('src/features/owner/sections/ReportsSection.tsx');
  expect(reports).toContain("{tab === 'sales' && data.grants.includes('rep.sales') ? (");
  expect(reports).toContain('<HeardAboutCard key={`${range.from}/${range.to}`} range={range} testId="owner-rep-heard" />');
  // Responses, never customers: Jalsa has no customer records.
  expect(code('src/features/owner/sections/UpliftSection.tsx')).toContain('`Total guest responses · ${result.total}`');
});
