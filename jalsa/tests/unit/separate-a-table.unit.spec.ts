/**
 * Separating a table from a group bill mid-service — the rule, and the three refusals.
 *
 * THE CASE THIS CLOSES
 *   `Jalsa Product Plan.dc.html` names four group cases that "have to be designed, not
 *   discovered". Three were built. This is the second — *"removing a table mid-service (its
 *   lines move to a fresh bill)"* — and the hole it left was a party of four who joined a table
 *   of eight, ate, and wanted to pay separately: the only route was closing one bill for
 *   everybody and settling it by hand at the counter.
 *
 * FAIL-FIRST EVIDENCE: observed on 16-Sep-2026. Against the pre-change tree `billSeparability`
 * did not exist and the whole file failed to collect. Two deliberate defects were then put into
 * the finished predicate and the suite re-run:
 *
 *   1. The `payment_requested` branch removed — **2 failed, 9 passed**: "the refusal for a
 *      payment request names the thing to do instead" and "the four refusals say four different
 *      things". Worth recording exactly: "A TABLE THAT HAS ASKED TO PAY CANNOT BE SEPARATED"
 *      still PASSED, because the table is still refused by the generic not-open branch below
 *      it. The behaviour survived; the useful sentence did not. That is precisely why the
 *      wording is asserted separately — a refusal that tells a guest's bill it is "closed" when
 *      they are waiting to pay sends the host looking for a closure that never happened,
 *      instead of at Withdraw, which is one tap away.
 *   2. The host-table branch removed — **3 failed, 8 passed**: "THE HOST TABLE CANNOT LEAVE ITS
 *      OWN BILL", "the host refusal points at the other tables", and "every refusal carries a
 *      sentence". `host_table_id` anchors the bill's code; detaching it leaves a bill whose host
 *      table belongs to a different bill — the same table claimed twice, which is what the
 *      partial unique index exists to prevent.
 *
 * Both were reverted and the suite returned to 11 passed.
 */
import { test, expect } from '@playwright/test';
import { billSeparability } from '../../src/lib/status';

const group = (over: Partial<Parameters<typeof billSeparability>[0]> = {}) =>
  billSeparability({ status: 'open', tableCount: 3, isHostTable: false, ...over });

test('a non-host table on an open group bill can be separated', () => {
  expect(group().can).toBe(true);
  expect(group().reason).toBe('');
});

test('a bill on ONE table has nothing to separate, and says so rather than offering', () => {
  const v = group({ tableCount: 1 });
  expect(v.can).toBe(false);
  expect(v.reason).toContain('only one table');
});

test('THE HOST TABLE CANNOT LEAVE ITS OWN BILL', () => {
  expect(group({ isHostTable: true }).can).toBe(false);
});

test('the host refusal points at the other tables — the next step is obvious', () => {
  expect(group({ isHostTable: true }).reason).toContain('Separate one of the others');
});

test('A TABLE THAT HAS ASKED TO PAY CANNOT BE SEPARATED', () => {
  expect(group({ status: 'payment_requested' }).can).toBe(false);
});

test('the refusal for a payment request names the thing to do instead', () => {
  // Withdrawing the request is already a verb this application has, so the refusal is a
  // redirection rather than a dead end.
  expect(group({ status: 'payment_requested' }).reason).toContain('Withdraw the payment request');
});

test('a CLOSED bill is a record and is never re-split', () => {
  const v = group({ status: 'closed' });
  expect(v.can).toBe(false);
  expect(v.reason).toContain('records are not re-split');
});

test('a voided bill is refused for the same reason a closed one is', () => {
  expect(group({ status: 'void' }).can).toBe(false);
});

test('THE ONE-TABLE CHECK COMES FIRST — a single-table bill is not told it is the host', () => {
  // On a bill of one, the only table IS the host, and both refusals are true. The useful
  // sentence is the one about there being nothing to separate; "separate one of the others"
  // names others that do not exist.
  expect(group({ tableCount: 1, isHostTable: true }).reason).toContain('only one table');
});

test('every refusal carries a sentence — a disabled control with no reason is a broken screen', () => {
  const refusals = [
    group({ tableCount: 1 }),
    group({ isHostTable: true }),
    group({ status: 'payment_requested' }),
    group({ status: 'closed' }),
  ];
  refusals.forEach((r) => {
    expect(r.can).toBe(false);
    expect(r.reason.length).toBeGreaterThan(20);
  });
});

test('the four refusals say four different things, so none is a catch-all', () => {
  const said = new Set([
    group({ tableCount: 1 }).reason,
    group({ isHostTable: true }).reason,
    group({ status: 'payment_requested' }).reason,
    group({ status: 'closed' }).reason,
  ]);
  expect(said.size).toBe(4);
});
