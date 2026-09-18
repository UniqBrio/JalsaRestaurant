/**
 * The indoor queue: who may join, who may manage it, what a closed queue does to the people
 * already in it, and what the entrance code carries.
 *
 * WHAT THIS RUN ACTUALLY CHANGED, AND WHAT WAS ALREADY TRUE
 *   Most of this feature existed. The cases below therefore split into two kinds, and both are
 *   worth having: the ones covering the FOUR gaps this run closed, and the REGRESSION ones
 *   pinning behaviour that was already correct and must stay so — the cookie isolation, the
 *   single token series, the party sizes, and the ordering handoff. The second kind is not
 *   padding: the request's own list asks for them, and a guarantee nobody asserts is a guarantee
 *   that quietly stops holding.
 *
 * WHY THESE ARE SOURCE AND SCHEMA ASSERTIONS
 *   Every case is a question about which branch runs, where a value comes from, or what the
 *   database refuses. Driving a real join needs a service-role key for a non-production Supabase
 *   project, and this container holds only production's, which ENVIRONMENTS.md names as never an
 *   automated target. The cases needing a round trip are recorded in TEST_SUMMARY.md as NOT
 *   EXECUTED rather than as passing.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026): four injected defects, recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const MUTATIONS = 'src/lib/db/mutations.ts';
const QUERIES = 'src/lib/db/queries.ts';
const GUEST_ROUTE = 'src/app/api/guest/queue/route.ts';
const QR_ROUTE = 'src/app/api/owner/qr/route.ts';
const QUEUE_SCREEN = 'src/features/guest/GuestQueue.tsx';
const QUEUE_PAGE = 'src/app/q/page.tsx';
const WAITLIST = 'src/features/owner/sections/WaitlistSection.tsx';
const SETTINGS = 'src/features/owner/sections/SettingsSection.tsx';
const PERMISSIONS = 'src/lib/permissions.ts';
const SCHEMA = 'supabase/migrations/20260916090000_jalsa_waitlist.sql';
const SHARED = 'src/lib/queue-closed.ts';

const read = (path: string): string => readFileSync(path, 'utf8');

function codeOnly(path: string): string {
  const raw = read(path);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  expect(stripped.length, `stripping ${path} must leave the code behind`).toBeGreaterThan(raw.length / 3);
  return stripped;
}

/** One function's body. Braces counted; the body's brace is the one that ends its line. */
function fn(path: string, signature: string): string {
  const src = codeOnly(path);
  const start = src.indexOf(signature);
  expect(start, `${signature} must exist in ${path}`).toBeGreaterThan(-1);
  const paren = src.indexOf('(', start);
  let depth = 0;
  let i = paren;
  for (; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  let bodyOpen = -1;
  for (let k = i; k < src.length - 1; k += 1) {
    if (src[k] === '{' && src[k + 1] === '\n') {
      bodyOpen = k;
      break;
    }
  }
  expect(bodyOpen, `${signature} must have a body`).toBeGreaterThan(-1);
  depth = 0;
  let end = -1;
  for (let j = bodyOpen; j < src.length; j += 1) {
    if (src[j] === '{') depth += 1;
    else if (src[j] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  expect(end, `${signature} must close`).toBeGreaterThan(bodyOpen);
  const body = src.slice(start, end);
  expect(body.length, `${signature}'s body must not be empty`).toBeGreaterThan(150);
  return body;
}

/* ── 1-2. Open lets you in, closed does not — AT THE SERVER ────────────────────────────────── */

test('1. an open queue accepts a join', () => {
  const join = fn(MUTATIONS, 'export async function guestJoinQueue');
  // The default is OPEN, so a restaurant that never touched the switch behaves as it always did,
  // and a missing settings row cannot silently lock the door.
  expect(join).toContain("readSettings('queue', { open: true })");
  expect(join).toContain('if (open === false) throw new Error(QUEUE_CLOSED)');
  expect(join).toContain(".from('waitlist_entry')");
});

test('2. a CLOSED queue refuses a new party in the mutation, not only on the screen', () => {
  const join = fn(MUTATIONS, 'export async function guestJoinQueue');

  // THE GAP THIS RUN CLOSED. The check must come BEFORE a token is taken out of the shared
  // series — a refused join that had already consumed W-19 would leave a hole in the night's
  // numbering that nobody could explain.
  const check = join.indexOf('if (open === false)');
  const token = join.indexOf("nextNumber('waitlist')");
  const insert = join.indexOf(".from('waitlist_entry')");
  expect(check, 'the closed check exists').toBeGreaterThan(-1);
  expect(check, 'and runs before a token is taken').toBeLessThan(token);
  expect(check, 'and before anything is inserted').toBeLessThan(insert);
});

test('2b. the route turns that refusal into a 409 a phone can act on', () => {
  const route = codeOnly(GUEST_ROUTE);
  expect(route).toContain('err.message === QUEUE_CLOSED');
  // 409, not 400: the request was well formed and would have worked a minute earlier.
  expect(route).toContain("fail(409, { code: 'conflict', message: QUEUE_CLOSED })");
});

test('2c. one sentence, held in one module, compared rather than copied', () => {
  // The server throws it, the route answers with it, the screen compares against it. Copied into
  // the component instead, the comparison would stop matching the first time somebody improved
  // one of the two copies.
  /* Read RAW, not through `codeOnly`: this module is one exported line under a long note, so
     stripping its comments leaves far less than the third `codeOnly` insists on — a guard that is
     right for a component file and wrong for a constant. The two assertions below are exact, so
     they need no stripping to be safe. */
  expect(read(SHARED)).toContain('export const QUEUE_CLOSED =');
  expect(read(SHARED), 'it must stay importable by a client component').not.toContain("import 'server-only'");
  for (const f of [MUTATIONS, GUEST_ROUTE, QUEUE_SCREEN]) {
    expect(codeOnly(f), `${f} must import the shared sentence`).toContain("from '@/lib/queue-closed'");
  }
});

test('2d. a tab that was open when the queue closed shows the closed screen, not a dead form', () => {
  const screen = codeOnly(QUEUE_SCREEN);
  expect(screen).toContain('if (message === QUEUE_CLOSED)');
  expect(screen).toContain('setClosedSinceLoad(true)');
  expect(screen).toContain('if (!queueOpen || closedSinceLoad)');
});

/* ── 3 + 17. Closing is not cancelling ─────────────────────────────────────────────────────── */

test('3+17. closing the queue touches no existing row, and reopening restores nothing', () => {
  const join = fn(MUTATIONS, 'export async function guestJoinQueue');
  // The close path is a SETTING. It has no update and no delete against waitlist_entry, which is
  // what makes "closed" and "cancelled" different facts.
  expect(join, 'the join path must not clear anybody').not.toContain('removed_at');

  const waitlist = codeOnly(WAITLIST);
  const toggle = waitlist.indexOf("action: 'write-setting'");
  expect(toggle, 'the toggle writes a setting').toBeGreaterThan(-1);
  expect(waitlist.slice(toggle, toggle + 200)).toContain("key: 'queue'");
  expect(waitlist.slice(toggle, toggle + 200)).toContain('value: { open: !queueOpen }');

  // And the screen renders an EXISTING entry before it ever considers the closed state, so a
  // waiting party keeps its token through a close and a reopen.
  const screen = codeOnly(QUEUE_SCREEN);
  const entryBranch = screen.indexOf('if (entry) {');
  const closedBranch = screen.indexOf('if (!queueOpen || closedSinceLoad)');
  expect(entryBranch, 'the entry branch exists').toBeGreaterThan(-1);
  expect(entryBranch, 'and is reached first').toBeLessThan(closedBranch);
});

/* ── 4-6. The row, its token, its place ────────────────────────────────────────────────────── */

test('4. party size is validated and persisted, with the reference\'s own set offered', () => {
  const join = fn(MUTATIONS, 'export async function guestJoinQueue');
  expect(join).toContain('Number.isInteger(input.partySize)');
  expect(join).toContain('party_size: input.partySize');
  // Exactly the set the reference draws. One list, in the component that renders it.
  expect(codeOnly(QUEUE_SCREEN)).toContain('const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 8, 10] as const');
  expect(codeOnly(QUEUE_SCREEN), '10 is shown as 10+').toContain("{n === 10 ? '10+' : n}");
  // And the database refuses a nonsense size whatever the screen offers.
  expect(read(SCHEMA)).toContain('party_size     int  not null check (party_size > 0)');
});

test('5. the token comes from the SHARED number series — not a second generator', () => {
  const join = fn(MUTATIONS, 'export async function guestJoinQueue');
  expect(join).toContain("nextNumber('waitlist')");
  // No local counter, no random token, no date-based scheme.
  expect(join, 'no second token scheme').not.toMatch(/`W-\$\{/);
  expect(join, 'and the token is never derived from a table').not.toContain('table');
  // The series is a row in the shared table, with its kind allowed by a constraint.
  expect(read(SCHEMA)).toContain('number_series_kind_check');
});

test('6+7+8. position, requests and guests are each computed once', () => {
  const entry = fn(QUERIES, 'export async function readQueueEntry');
  // Position is "everyone still waiting who joined before me" — seated and removed excluded, so
  // it falls as the room turns over.
  expect(entry).toContain(".is('seated_at', null)");
  expect(entry).toContain(".is('removed_at', null)");
  expect(entry).toContain(".lt('joined_at', joinedAtIso)");
  expect(entry).toContain('position: ahead + 1');

  // The operator's two numbers come from the one list, so they cannot disagree with each other.
  const waitlist = codeOnly(WAITLIST);
  expect(waitlist).toContain('const heads = queue.reduce((a, w) => a + w.partySize, 0)');
  expect(waitlist).toContain('data-testid="owner-queue-headline"');
});

test('7b. the operator sees REQUESTS and GUESTS, never one standing for the other', () => {
  const waitlist = read(WAITLIST);
  // Both, in the headline, with the singular cases spelled out.
  expect(waitlist).toContain("queue.length === 1 ? '1 request' : `${queue.length} requests`");
  expect(waitlist).toContain("heads === 1 ? '1 guest' : `${heads} guests`");
  // And the tile agrees with it rather than saying something else.
  expect(waitlist).toContain('label="Requests waiting"');
  expect(waitlist).toContain("`${heads} ${heads === 1 ? 'guest' : 'guests'} in total`");
});

/* ── 9-13. Welcoming, and the handoff into ordinary ordering ───────────────────────────────── */

test('9+10. a welcomed party changes state, and the guest screen reads that state', () => {
  const entry = fn(QUERIES, 'export async function readQueueEntry');
  // Four states from two timestamps and a removal — no status column to drift from the stamps.
  expect(entry).toContain(
    "state: removed ? 'left' : seated ? 'seated' : data.notified_at !== null ? 'ready' : 'waiting'"
  );
  const screen = codeOnly(QUEUE_SCREEN);
  expect(screen).toContain("entry.state === 'seated'");
  expect(screen).toContain('Your table is ready');
});

test('11+12. the assigned table is shown, and Start ordering enters the EXISTING journey', () => {
  const screen = codeOnly(QUEUE_SCREEN);
  // The real table, from the row — not a guess and not a parameter the phone chose.
  expect(screen).toContain('entry.tableName');
  expect(screen).toContain('href={`/t/${entry.tableName}`}');
  // Which is the ordinary table route. No queue-specific ordering path anywhere.
  expect(screen, 'no second ordering flow').not.toContain('/api/guest/round');
  expect(screen, 'and no bill of its own').not.toContain('ensureOpenBill');

  // The table name is read from the seated table, so it cannot name a table nobody assigned.
  expect(fn(QUERIES, 'export async function readQueueEntry')).toContain('dining_table:seated_table_id(name)');
});

test('13. joining twice does not mint a second token or a second row', () => {
  const route = codeOnly(GUEST_ROUTE);
  // A double tap at the door must not put four people in the queue twice.
  expect(route).toContain("if (entry && (entry.state === 'waiting' || entry.state === 'ready')) return ok({ entry })");
  const existing = route.indexOf('const existing = jar.get(COOKIE)?.value');
  const join = route.indexOf('await guestJoinQueue(');
  expect(existing, 'the existing row is checked first').toBeLessThan(join);
});

/* ── 14-16. Permissions ────────────────────────────────────────────────────────────────────── */

test('14+15+16. queue management runs on the EXISTING granular permissions', () => {
  const perms = read(PERMISSIONS);
  // Six keys, already separated finer than one "queue management" grant would be.
  for (const key of ['queue.view', 'queue.walkin', 'queue.notify', 'queue.seat', 'queue.close', 'queue.clear']) {
    expect(perms, `${key} must exist`).toContain(`'${key}'`);
  }
  // No parallel system was invented for this feature.
  expect(perms, 'no coarse catch-all was added').not.toContain("'queue.manage'");

  // Each control is gated on its OWN grant, so Captain B without queue.close simply has no
  // open/close button — rather than a button that fails when pressed.
  const waitlist = codeOnly(WAITLIST);
  expect(waitlist).toContain("data.grants.includes('queue.close')");
  expect(waitlist).toContain("data.grants.includes('queue.seat')");
  expect(waitlist).toContain('{canClose ? (');

  const settings = codeOnly(SETTINGS);
  expect(settings).toContain("data.grants.includes('queue.close')");
  expect(settings).toContain('{canClose ? (');
  // Nothing anywhere keys off a person rather than a grant.
  expect(waitlist, 'no hardcoded staff').not.toMatch(/name === '[A-Z]/);
  expect(settings, 'no hardcoded staff').not.toMatch(/name === '[A-Z]/);
});

/* ── 18-19. Isolation ──────────────────────────────────────────────────────────────────────── */

test('18. a party can only ever read its own row, and the handle is not in the URL', () => {
  const route = codeOnly(GUEST_ROUTE);
  // The id is an http-only cookie: not shoulder-surfable across a crowded doorway, not
  // bookmarkable, not pasteable into a group chat.
  expect(route).toContain("const COOKIE = 'jalsa_queue'");
  expect(route).toContain('httpOnly: true');
  expect(route).toContain("sameSite: 'lax'");
  // The GET reads exactly one row, by that id, and takes no parameter from the caller.
  expect(route).toContain('readQueueEntry(id)');
  expect(route, 'the guest route must not accept an id').not.toContain("searchParams.get('id')");
  expect(route, 'nor list the queue').not.toContain('listWaitlist');

  // And the read is scoped to this restaurant as well as to the row.
  expect(fn(QUERIES, 'export async function readQueueEntry')).toContain(
    ".eq('restaurant_id', restaurantId)"
  );
});

test('19. the entrance code identifies a PLACE and nothing else', () => {
  /* The whole route file, not one function body: its handler is an arrow passed to `handler(...)`,
     so the brace that opens the body does not end its line and the body-finder cannot see it.
     The file holds exactly one handler, so reading all of it asserts the same thing. */
  const qr = codeOnly(QR_ROUTE);
  // `/q` and nothing appended. No token, no party, no session, no bill.
  expect(qr).toContain('`${origin}/q`');

  /* Asserted against the TARGET expression, not the whole file: a substring scan for "token"
     across the module matches `@/theme/tokens.generated`, which is the colour import and has
     nothing to do with what the QR encodes. The question is what goes INTO the URL. */
  const targetLine = qr.split('\n').find((l) => l.includes('const target =')) ?? '';
  expect(targetLine, 'the target expression must be present').toContain('origin');
  for (const forbidden of ['token', 'billId', 'sessionId', 'phone', 'partySize', 'entry']) {
    expect(targetLine, `the code must not carry ${forbidden}`).not.toContain(forbidden);
  }
  // Nothing from the request body or a cookie can reach it either — only the one search param.
  expect(qr, 'the QR never reads a cookie').not.toContain('cookies(');
  expect(qr, 'and never reads a body').not.toContain('body<');
  // One generator for both codes — the absence of a table name IS the question being asked.
  expect(qr).toContain("searchParams.get('table')");
  expect(qr).toContain('table ? `${origin}/t/${encodeURIComponent(table)}` : `${origin}/q`');
  // Behind the same grant as the table codes.
  expect(qr).toContain("staff.grants.can('tables.qr')");
});

test('19b. the guest-session correction is not regressed by any of this', () => {
  // The queue never touches a guest session: it has its own cookie, its own row, and hands off
  // by NAVIGATING to /t/<table>, where the ordinary session logic starts from scratch.
  const route = codeOnly(GUEST_ROUTE);
  expect(route, 'the queue route must not touch guest_session').not.toContain('guest_session');
  expect(route).not.toContain('resolveGuest');
  expect(route).not.toContain('attachBillToSession');
  const screen = codeOnly(QUEUE_SCREEN);
  expect(screen, 'the handoff is a link, not a session write').toContain('href={`/t/${entry.tableName}`}');
});

/* ── 20. Table constraints ─────────────────────────────────────────────────────────────────── */

test('20. seating still runs through the existing availability rules', () => {
  const waitlist = codeOnly(WAITLIST);
  // Only tables that are on the floor plan, carry no open bill, and are not mid-clear.
  expect(waitlist).toContain('t.active && !t.billId && t.clearing === null');
  // The database refuses the contradiction whatever the screen offers.
  expect(read(SCHEMA)).toContain('constraint waitlist_entry_one_ending');
});

/* ── The live update ───────────────────────────────────────────────────────────────────────── */

test('the waiting screen uses the ONE polling idiom, not its own timer', () => {
  const screen = codeOnly(QUEUE_SCREEN);
  expect(screen).toContain("import { useLiveData } from '@/hooks/useLiveData'");
  expect(screen).toContain("useLiveData<{ entry: QueueSelfView | null }>('/api/guest/queue'");
  // The bespoke interval is gone — that was a second idiom, and it polled with the phone in a
  // pocket and blanked the token on a single failed read.
  expect(screen, 'no hand-rolled interval').not.toContain('setInterval');
  expect(screen, 'and nothing sleeps or retries by hand').not.toContain('setTimeout');
});

test('what this phone just did outranks a poll that was already in flight', () => {
  const screen = codeOnly(QUEUE_SCREEN);
  expect(screen).toContain('const entry = justDid ? justDid.entry : live.data.entry');
  // The override is spent once the server agrees, and is cleared during render rather than in an
  // effect — a pure comparison, so React 19 calling it twice is the same as calling it once.
  expect(screen).toContain('if (justDid && liveId === localId) setJustDid(null)');
});

/* ── The owner's entrance card ─────────────────────────────────────────────────────────────── */

test('Tables & QR gains the entrance code beside the table codes', () => {
  const settings = codeOnly(SETTINGS);
  expect(settings).toContain('data-testid="owner-entrance-qr"');
  expect(settings).toContain('data-testid="owner-entrance-status"');
  expect(settings).toContain('data-testid="owner-entrance-toggle"');
  expect(settings).toContain('<IndoorQueueCard');
  // Its status is READ from the same setting both screens read, so they cannot disagree.
  expect(settings).toContain('const open = queue.open !== false');
  // It says the thing an owner needs to believe before they will ever press Close.
  expect(read(SETTINGS)).toContain('Closing stops NEW parties only');
});

test('the audit trail already covers the queue, and was not duplicated', () => {
  const join = fn(MUTATIONS, 'export async function guestJoinQueue');
  expect(join).toContain('await audit(');
  expect(join).toContain("action: 'Waitlist'");
  // No second audit mechanism was introduced for this feature.
  expect(codeOnly(GUEST_ROUTE), 'the route does not audit separately').not.toContain('audit(');
});
