/**
 * Sign-in scenarios (27-Oct-2026, P-5) — bundled and run by tests/unit/sign-in-throttle.unit.spec.ts.
 * The REAL `signInWithPin` and the REAL session route against fake-supabase: what the database's
 * throttle answers becomes, and what happens on a database that does not have it yet.
 */
import { POST as signIn } from '@/app/api/staff/session/route';
import { SignInThrottled, signInWithPin } from '@/lib/db/auth';
import { networkKey } from '@/lib/network-key';
import { fakeDb, type FakeQuery } from '../fake-supabase';

const g = globalThis as unknown as { __fakeSession?: { address?: string } };
const STAFF = { id: 'st1', name: 'Arun', role: 'Captain', initials: 'AR', provisional: false };
let answer: unknown = null;
let sent: Record<string, unknown> = {};

function respond(q: FakeQuery): unknown {
  if (q.table === 'sign_in_with_pin') {
    sent = (q.body as Record<string, unknown>) ?? {};
    return answer;
  }
  if (q.table === 'verify_staff_pin') return [STAFF];
  return [];
}

function fresh() {
  const db = fakeDb();
  db.calls = [];
  db.latencyMs = 1;
  db.respond = respond as typeof db.respond;
  db.delayFor = () => 0;
  return db;
}

async function direct(name: string, pin: string, address: string) {
  const db = fresh();
  g.__fakeSession = { address };
  let outcome: unknown;
  try {
    const s = await signInWithPin(pin, 'staff');
    outcome = s ? { signedIn: s.name } : { signedIn: null };
  } catch (err) {
    outcome = err instanceof SignInThrottled ? { throttled: err.retryAfterSeconds } : { error: String(err) };
  }
  const rpc = db.calls.filter((c) => c.op === 'rpc').map((c) => c.table);
  return { name, outcome, rpc };
}

async function viaRoute(name: string, pin: string) {
  fresh();
  g.__fakeSession = { address: '203.0.113.7' };
  const res = await signIn(
    new Request('http://localhost/api/staff/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin, surface: 'staff' }),
    }),
    { params: Promise.resolve({}) }
  );
  const body = (await res.json()) as { message?: string; code?: string };
  return {
    name,
    status: res.status,
    retryAfter: res.headers.get('retry-after'),
    message: body.message,
    code: body.code,
  };
}

const out: unknown[] = [];

// What the throttle is given: a key, never the address; one /64 is one network.
{
  fresh();
  g.__fakeSession = { address: '2001:db8:1:2:aaaa::1' };
  answer = { result: 'refused' };
  await signInWithPin('0907', 'owner');
  out.push({
    name: 'what is sent',
    keys: Object.keys(sent).sort(),
    net: sent.p_net,
    surface: sent.p_surface,
    sameAsSibling: sent.p_net === networkKey('2001:db8:1:2:ffff::9', 'round-rig-only-0000000000000000000000000000'),
    containsAddress: JSON.stringify(sent).includes('2001:db8'),
  });
}

answer = { result: 'ok', staff: STAFF };
out.push(await direct('ok', '3691', '203.0.113.7'));
answer = { result: 'refused' };
out.push(await direct('refused', '0907', '203.0.113.7'));
answer = { result: 'throttled', retry_after: 840 };
out.push(await direct('throttled', '3691', '203.0.113.7'));
out.push(await direct('setup code', '1234', '203.0.113.7'));

answer = { result: 'refused' };
out.push(await viaRoute('route: refused', '0907'));
answer = { result: 'throttled', retry_after: 840 };
out.push(await viaRoute('route: throttled for minutes', '0907'));
answer = { result: 'throttled', retry_after: 30 };
out.push(await viaRoute('route: throttled for seconds', '0907'));

// A database without the migration: PostgREST's "no such function".
answer = { __error: 'Could not find the function public.sign_in_with_pin', __code: 'PGRST202' };
out.push(await direct('missing: falls back', '3691', '203.0.113.7'));
out.push(await direct('missing: not asked again', '3691', '203.0.113.7'));
const legacy = [];
for (let i = 0; i < 11; i += 1) legacy.push(await direct(`legacy ${i + 1}`, '3691', '203.0.113.7'));
out.push({ name: 'legacy window', outcomes: legacy.map((l) => l.outcome) });

process.stdout.write(`${JSON.stringify(out)}\n`);
