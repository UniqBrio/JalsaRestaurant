/**
 * Cancel an order already with the kitchen and free its table; a takeaway's photo (07-Oct-2026).
 *
 * The write paths are the REAL mutations on the round rig (order-cancel.scenarios.ts); the
 * database function itself is proven in order-cancel.db.unit.spec.ts; the rules shared with the
 * screens are pure and tested directly; the doors (routes, the media route) are pinned by source.
 *
 * FAIL-FIRST: run against the previous `mutations.ts`, the scenario bundle does not build -
 * `No matching export in "src/lib/db/mutations.ts" for import "cancelOrderAndFreeTable"` - so
 * every case fails (observed 07-Oct-2026; `setTakeawayPhoto`, now in owner-mutations.ts, was
 * equally absent).
 * NOT OBSERVED FAILING on their own: the closeBill / requestPayment void cases, because the bundle
 * cannot build on that tree to reach them. By reading: its closeBill wrote with
 * `.neq('status', 'closed')` and requestPayment likewise, so both accepted a void bill.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';
import {
  NO_REASON_GIVEN,
  ORDER_CANCEL_COPY,
  ORDER_CANCEL_MESSAGES,
  ORDER_CANCEL_REASONS,
  orderCancelReason,
  orderCancelledMessage,
  tableIsCancellable,
} from '../../src/lib/order-cancel';
import { tableIsFreeable } from '../../src/lib/status';
import { MEDIA_URL, isTakeawayPhotoUrl, takeawayPhotoBill } from '../../src/lib/media';
import { fitWithin, MAX_SIDE } from '../../src/lib/image-shrink';
import { rangeIsEmpty } from '../../src/lib/report-range';

interface Result {
  name: string;
  out: unknown;
  threw: string | null;
  log: Array<{ table: string; op: string; body: Record<string, unknown> | null; cols: string; filters: string[] }>;
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/order-cancel.scenarios.ts', import.meta.url));
const APP = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string): string => readFileSync(`${APP}${p}`, 'utf8');
let results: Result[] = [];
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};
const writes = (r: Result) => r.log.filter((l) => l.op !== 'select');

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

/* ── The rules the screens share ───────────────────────────────────────────────────────────── */

test('the reasons are the requested list, and "Other" needs a few words', () => {
  expect(ORDER_CANCEL_REASONS).toEqual([
    'Customer emergency',
    'Customer changed mind',
    'Order mistake',
    'Kitchen issue',
    'Item unavailable',
    'Duplicate order',
    'Other',
  ]);
  expect(orderCancelReason('', '')).toEqual({ ok: true, reason: NO_REASON_GIVEN, note: '' });
  expect(orderCancelReason('Kitchen issue', 'ignored')).toEqual({ ok: true, reason: 'Kitchen issue', note: '' });
  expect(orderCancelReason('Other', '   ')).toEqual({ ok: false, problem: ORDER_CANCEL_MESSAGES.otherNeedsNote });
  expect(orderCancelReason('Other', ' Guest unwell ')).toEqual({ ok: true, reason: 'Other', note: 'Guest unwell' });
  expect(orderCancelReason('Other', 'x'.repeat(500))).toMatchObject({ ok: true, note: 'x'.repeat(200) });
  expect(orderCancelReason('Anything at all', '')).toMatchObject({ ok: false });
});

test('the dialog says what was asked for, and the success line names the table', () => {
  expect(ORDER_CANCEL_COPY.title).toBe('Cancel Order & Free Table?');
  expect(ORDER_CANCEL_COPY.body).toBe(
    'This order is already being processed. Cancelling it will release the table and record the order as cancelled. Are you sure you want to continue?'
  );
  expect(ORDER_CANCEL_COPY.confirm).toBe('Cancel Order & Free Table');
  expect(ORDER_CANCEL_COPY.keep).toBe('Cancel');
  expect(orderCancelledMessage(['12'])).toBe('Order cancelled successfully. Table 12 is now free.');
  expect(orderCancelledMessage(['A1', 'A2'])).toBe('Order cancelled successfully. Tables A1, A2 are now free.');
  expect(ORDER_CANCEL_MESSAGES.gone).toBe('This order has already been cancelled or completed.');
  expect(ORDER_CANCEL_MESSAGES.changed).toBe(
    'Unable to cancel the order. The order may have already been completed or changed by another user.'
  );
});

test('offered only on a table with rounds, to someone holding both grants - never beside Mark free', () => {
  const both = ['tables.free', 'orders.cancel_after'];
  expect(tableIsCancellable({ roundCount: 2, billId: 'b' }, both)).toBe(true);
  expect(tableIsCancellable({ roundCount: 0, billId: 'b' }, both)).toBe(false); // that is Mark free
  expect(tableIsCancellable({ roundCount: 0, billId: null }, both)).toBe(false); // a free table
  expect(tableIsCancellable({ roundCount: 2, billId: 'b' }, ['tables.free'])).toBe(false);
  expect(tableIsCancellable({ roundCount: 2, billId: 'b' }, ['orders.cancel_after'])).toBe(false);
  for (const roundCount of [0, 1, 3]) {
    const t = { roundCount, billId: 'b', phonesAttached: 1 };
    expect(tableIsCancellable(t, both) && tableIsFreeable(t), `rounds ${roundCount}`).toBe(false);
  }
});

/* ── The cancellation, through the real mutation ───────────────────────────────────────────── */

test('both grants are demanded on the server, and nothing is read or written without them', () => {
  expect(by('cancel without tables.free').threw).toMatch(/^PermissionDenied/);
  expect(by('cancel without tables.free').log).toEqual([]);
  expect(by('cancel without orders.cancel_after').threw).toMatch(/^PermissionDenied/);
  expect(by('cancel without orders.cancel_after').log).toEqual([]);
});

test('a cancellation is ONE call to the database function, with the version read first and the order value without the tip', () => {
  const r = by('cancel');
  expect(r.threw).toBeNull();
  expect(r.out).toEqual({ billCode: 'B-0412', tables: ['T12'] });
  // The version is read, scoped to this restaurant, before the order itself.
  expect(r.log[0]!.cols).toBe('version');
  expect(r.log[0]!.filters).toContain('eq:restaurant_id="r1"');
  const w = writes(r);
  expect(w.map((l) => `${l.table}:${l.op}`)).toEqual(['cancel_bill_and_free:rpc']);
  // 2 x 240 = 480, less 10% = 432, plus 5% GST = 454. The 50 tip is staff money, not the order's.
  expect(w[0]!.body).toMatchObject({
    p_bill_id: '11111111-1111-4111-8111-111111111111',
    p_table_id: '22222222-2222-4222-8222-222222222222',
    p_expected_version: 7,
    p_actor_staff_id: 'st1',
    p_actor_label: 'Ravi',
    p_reason: 'Customer emergency',
    p_total: 454,
  });
  // Never a delete, anywhere.
  expect(r.log.some((l) => l.op === 'delete')).toBe(false);
});

test('the reason is recorded as chosen, "No reason given" when none, and "Other" with its words', () => {
  expect(writes(by('cancel, no reason'))[0]!.body).toMatchObject({ p_reason: NO_REASON_GIVEN, p_note: '' });
  expect(writes(by('cancel, Other with a note'))[0]!.body).toMatchObject({ p_reason: 'Other', p_note: 'Guest felt unwell' });
  for (const name of ['cancel, Other without a note', 'cancel, a reason not on the list', 'cancel, not a uuid']) {
    expect(by(name).threw, name).toMatch(/^OrderNotLive: /);
    expect(by(name).log, name).toEqual([]);
  }
});

test('A and B: an order completed or cancelled by someone else is refused in words, and nothing is written', () => {
  for (const name of [
    'cancel, another restaurant',
    'cancel, already void when read',
    'cancel, already closed when read',
    'cancel, the database says gone',
  ]) {
    expect(by(name).threw, name).toBe(`OrderNotLive: ${ORDER_CANCEL_MESSAGES.gone}`);
    expect(writes(by(name)).filter((l) => l.op !== 'rpc'), name).toEqual([]);
  }
  expect(by('cancel, the database says changed').threw).toBe(`OrderNotLive: ${ORDER_CANCEL_MESSAGES.changed}`);
  // C: the table now holds a different order.
  expect(by('cancel, the database says not_here').threw).toBe(`OrderNotLive: ${ORDER_CANCEL_MESSAGES.notHere}`);
  // A takeaway is at no table; this action is for tables.
  expect(by('cancel, a takeaway').threw).toBe(`OrderNotLive: ${ORDER_CANCEL_MESSAGES.changed}`);
  expect(writes(by('cancel, a takeaway'))).toEqual([]);
});

test('a cancelled order can never be closed as paid, nor asked to pay', () => {
  const closed = by('close a cancelled order');
  // SUPERSEDED 07-Oct-2026 (copy review, same day): the message was "This order was cancelled -
  // there is no payment to record." - now an em-dash, with the next step.
  expect(closed.threw).toBe('OrderNotLive: This order was cancelled — there is no payment to record. Reload to see the floor as it is now.');
  expect(writes(closed)).toEqual([]);

  // Cancelled between the read and the write: the conditional write changed nothing, and no
  // Payment line, invoice or notice follows.
  const between = by('close, cancelled in between');
  expect(between.threw).toMatch(/^OrderNotLive: /);
  expect(writes(between).map((l) => `${l.table}:${l.op}`)).toEqual(['bill:update']);
  expect(writes(between)[0]!.filters).toContain('in:status=["open","payment_requested"]');

  // Closed by someone else in between: the same answer as before, still no second Payment line.
  const twice = by('close, closed by someone else in between');
  expect(twice.out).toEqual({ payable: 504 });
  expect(writes(twice).map((l) => `${l.table}:${l.op}`)).toEqual(['bill:update']);

  expect(writes(by('guest asks to pay on a cancelled order'))).toEqual([]);
  const open = writes(by('guest asks to pay on an open order'));
  expect(open[0]!.filters).toContain('eq:status="open"');
});

/* ── The takeaway photo, through the real mutation ─────────────────────────────────────────── */

test('a photo needs orders.create, a takeaway of this restaurant, still running', () => {
  expect(by('photo without orders.create').threw).toMatch(/^PermissionDenied/);
  expect(by('photo without orders.create').log).toEqual([]);
  expect(by('photo on a dine-in order').threw).toBe('PhotoRefused: Only a takeaway order carries a photo.');
  expect(by('photo on another restaurant').threw).toBe('PhotoRefused: Only a takeaway order carries a photo.');
  expect(by('photo on another restaurant').log[0]!.filters).toContain('eq:restaurant_id="r1"');
  // SUPERSEDED 07-Oct-2026 (copy review, same day): matched /no longer running/.
  expect(by('photo on a settled takeaway').threw).toMatch(/is already settled or cancelled, so its photo can no longer be changed/);
  for (const name of ['photo on a dine-in order', 'photo on another restaurant', 'photo on a settled takeaway']) {
    expect(writes(by(name)), name).toEqual([]);
  }
});

test('the bytes are checked on the server: a PDF and an oversized file are refused before anything is stored', () => {
  expect(by('photo that is a pdf').threw).toBe('PhotoRefused: Only PNG or JPEG images can be used. Choose a .png, .jpg or .jpeg file.');
  expect(by('photo that is a pdf').log).toEqual([]);
  expect(by('photo over 1 MB').threw).toMatch(/^PhotoRefused: That image is .* MB/);
  expect(by('photo over 1 MB').log).toEqual([]);
});

test('added: stored under a key the server makes, in the existing bucket, then recorded on the order and audited', () => {
  const r = by('photo added');
  const url = (r.out as { photoUrl: string }).photoUrl;
  expect(isTakeawayPhotoUrl(url)).toBe(true);
  expect(takeawayPhotoBill(url)).toBe('11111111-1111-4111-8111-111111111111');
  const w = writes(r);
  expect(w.map((l) => `${l.table}:${l.op}`)).toEqual(['storage:media:upload', 'bill:update', 'audit_entry:insert']);
  expect(w[0]!.cols).toBe(url.replace('/api/media/', ''));
  expect(w[0]!.body).toMatchObject({ upsert: false, contentType: 'image/jpeg' });
  expect(w[1]!.body).toEqual({ photo_url: url });
  expect(w[1]!.filters).toEqual(expect.arrayContaining(['eq:restaurant_id="r1"', 'in:status=["open","payment_requested"]', 'eq:photo_url=""']));
  expect(w[2]!.body).toMatchObject({ action: 'Bill', detail: 'B-0412 takeaway photo added', actor_label: 'Ravi' });
  expect(by('photo added after asking to pay').threw).toBeNull();
});

test('replaced and removed: the old file is deleted and the change audited; a race leaves nothing behind', () => {
  const old = 'takeaway/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg';
  const replaced = writes(by('photo replaced'));
  expect(replaced.map((l) => `${l.table}:${l.op}`)).toEqual(['storage:media:upload', 'bill:update', 'storage:media:remove', 'audit_entry:insert']);
  expect(replaced[2]!.cols).toBe(old);
  expect(replaced[3]!.body).toMatchObject({ detail: 'B-0412 takeaway photo replaced' });

  const removed = writes(by('photo removed'));
  expect(removed.map((l) => `${l.table}:${l.op}`)).toEqual(['bill:update', 'storage:media:remove', 'audit_entry:insert']);
  expect(removed[0]!.body).toEqual({ photo_url: '' });
  expect(removed[1]!.cols).toBe(old);
  expect(removed[2]!.body).toMatchObject({ detail: 'B-0412 takeaway photo removed' });

  const failed = by('photo storage fails');
  expect(failed.threw).toBe('PhotoRefused: The photo could not be saved. Try again.');
  expect(writes(failed).map((l) => `${l.table}:${l.op}`)).toEqual(['storage:media:upload']);

  const race = by('photo changed by someone else in between');
  expect(race.threw).toMatch(/changed while you were adding the photo/);
  const rw = writes(race);
  expect(rw.map((l) => `${l.table}:${l.op}`)).toEqual(['storage:media:upload', 'bill:update', 'storage:media:remove']);
  // The file it uploaded is the file it removes - never anyone else's.
  expect(rw[2]!.cols).toBe(rw[0]!.cols);
});

test('a takeaway photo URL is never a public media URL', () => {
  const url = '/api/media/takeaway/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg';
  expect(isTakeawayPhotoUrl(url)).toBe(true);
  expect(MEDIA_URL.test(url)).toBe(false);
  expect(isTakeawayPhotoUrl('/api/media/takeaway/../menu/x.jpg')).toBe(false);
  expect(isTakeawayPhotoUrl('/api/media/menu/33333333-3333-4333-8333-333333333333.jpg')).toBe(false);
});

test('a phone photo is drawn at most 1600 px on its long side, never enlarged', () => {
  expect(MAX_SIDE).toBe(1600);
  expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  expect(fitWithin(4000, 1000, 1120)).toEqual({ width: 1120, height: 280 });
});

/* ── Reports ───────────────────────────────────────────────────────────────────────────────── */

test('cancelled orders are listed on their own and never reach a revenue or GST figure', () => {
  const q = read('src/lib/db/queries.ts');
  const listClosed = q.slice(q.indexOf('export async function listClosedBillsBetween'), q.indexOf('/** A cancelled order, as the operational report'));
  expect(listClosed).toContain(".eq('status', 'closed')");
  const listCancelled = q.slice(q.indexOf('export async function listCancelledBillsBetween'));
  expect(listCancelled).toContain(".eq('status', 'void')");
  expect(listCancelled).toContain(".gte('cancelled_at'");
  const route = read('src/app/api/owner/report/route.ts');
  // The summary and every panel are built from `bills` (closed only); cancelled goes out on its own.
  expect(route).toContain('const summary = summarise({ bills: rangeBills, expenses: rangeExpenses });');
  expect(route).toMatch(/cancelled: cancelled\.map/);
  expect(route).not.toMatch(/rangeBills[^\n]*cancelled/);
  // A range with only cancellations still shows the Orders panel.
  expect(rangeIsEmpty({ summary: { bills: 0 }, expenses: [], cancelled: [{}] })).toBe(false);
  expect(rangeIsEmpty({ summary: { bills: 0 }, expenses: [] })).toBe(true);
});

/* ── The doors ─────────────────────────────────────────────────────────────────────────────── */

test('both floors send cancel-free-table, and both routes answer a refusal as a 409 in its own words', () => {
  for (const p of ['src/app/api/staff/action/route.ts', 'src/app/api/owner/action/route.ts']) {
    const s = read(p);
    expect(s, p).toContain("case 'cancel-free-table':");
    expect(s, p).toContain("if (err instanceof OrderNotLive) return fail(409, { code: 'conflict', message: err.message });");
  }
  expect(read('src/app/api/owner/action/route.ts')).toContain("if (err instanceof PhotoRefused) return fail(409, { code: 'conflict', message: err.message });");
});

test('the media route serves a takeaway photo only to signed-in staff who may see orders, and never caches it publicly', () => {
  const s = read('src/app/api/media/[...path]/route.ts');
  const fn = s.slice(s.indexOf('async function takeawayPhoto'));
  expect(fn).toContain("(await currentStaff('owner')) ?? (await currentStaff('staff'))");
  expect(fn).toContain("who.grants.can('orders.view')");
  expect(fn).toContain('who.provisional');
  expect(fn).toContain(".eq('restaurant_id', restaurantId)");
  expect(fn).toContain('bill.photo_url !== `/api/media/${key}`');
  expect(fn).toContain("'Cache-Control': 'private, no-store'");
  expect(fn).not.toContain('public');
  // Checked BEFORE the public pattern, so a takeaway key can never fall through to it.
  expect(s.indexOf('if (photoBill) return takeawayPhoto(key, photoBill);')).toBeLessThan(s.indexOf('if (!MEDIA_URL.test('));
});

/* ── The doors, called for real (permission review, 07-Oct-2026) ─────────────────────────────
   FAIL-FIRST: with the two route checks removed, the provisional case got past the door and was
   answered by the action itself - "Expected: 403, Received: 409" (observed 07-Oct-2026). The media cases were written after the
   route existed: NOT OBSERVED FAILING - they pin the 404s the source pins above describe. */

interface DoorResult {
  name: string;
  status: number;
  cache: string | null;
  body: string;
  log: string[];
  threw: string | null;
}
const DOORS = fileURLToPath(new URL('../support/rounds/order-cancel-doors.scenarios.ts', import.meta.url));
let doors: DoorResult[] = [];
const door = (name: string): DoorResult => {
  const r = doors.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};

test.describe('the doors', () => {
  test.beforeAll(async () => {
    doors = await runScenario<DoorResult[]>(DOORS);
  });

  test('an issued (provisional) PIN reaches neither action, on either route - rule 5 at the door', () => {
    for (const name of ['staff cancel, provisional PIN', 'owner cancel, provisional PIN', 'owner photo, provisional PIN']) {
      const r = door(name);
      expect(r.threw, name).toBeNull();
      expect(r.status, name).toBe(403);
      expect(r.body, name).toContain('Choose your own PIN first');
      // Nothing past the identity check: no bill read, no rpc, no write.
      expect(r.log.filter((l) => !l.startsWith('staff')), name).toEqual([]);
    }
    expect(door('staff cancel, signed out').status).toBe(401);
    expect(door('staff cancel, no grants').status).toBe(403);
    expect(door('staff cancel, no grants').log.some((l) => l.startsWith('bill') || l.includes('rpc'))).toBe(false);
  });

  test('a takeaway photo answers 404, never cached, to everyone but signed-in staff with orders.view for its current URL', () => {
    for (const name of [
      'photo, signed out',
      'photo, provisional PIN',
      'photo, no orders.view',
      'photo, not this restaurant or not a takeaway',
      'photo, an old (replaced) URL',
    ]) {
      const r = door(name);
      expect(r.threw, name).toBeNull();
      expect(r.status, name).toBe(404);
      expect(r.cache, name).toBe('no-store');
      expect(r.log.includes('storage:media:download'), `${name}: no bytes read`).toBe(false);
    }
    // Signed out: no bill is even read.
    expect(door('photo, signed out').log.some((l) => l.startsWith('bill'))).toBe(false);
    const ok = door('photo, signed in with orders.view');
    expect(ok.status).toBe(200);
    expect(ok.cache).toBe('private, no-store');
    const dish = door('a dish photo stays public');
    expect(dish.status).toBe(200);
    expect(dish.cache).toContain('public');
  });
});

test('the rounds the person saw travel to the database; a payment request that lost a race writes nothing more (code review, 07-Oct-2026)', () => {
  expect(writes(by('cancel, with the rounds the person saw'))[0]!.body).toMatchObject({ p_expected_rounds: 1 });
  expect(writes(by('cancel'))[0]!.body).toMatchObject({ p_expected_rounds: null });
  const lost = writes(by('guest asks to pay, cancelled in between'));
  // The conditional write matched nothing: no notices, no "entered the closure queue".
  expect(lost.map((l) => `${l.table}:${l.op}`)).toEqual(['bill:update']);
  expect(lost[0]!.filters).toContain('eq:status="open"');
});
