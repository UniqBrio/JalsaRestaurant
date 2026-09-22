/**
 * The plain-text bill an owner sends, and the link that carries it.
 *
 * WHY THIS IS THE SPEC THAT MATTERS ON THIS FEATURE
 *   The screen can be looked at. The message cannot — it is composed, handed to WhatsApp, and
 *   read by a guest who has already left. Every way it can be wrong is invisible until then: a
 *   cancelled dish billed to somebody who did not eat it, a total that disagrees with the
 *   screen, an apostrophe in "Chef's Special" truncating the message at that character.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026): four deliberate defects, one per run, each reverted —
 * recorded in TEST_SUMMARY.md with the counts.
 */
import { test, expect } from '@playwright/test';
import type { RestaurantIdentity } from '../../src/lib/restaurant-identity';
import { billShareText, whatsAppShareUrl } from '../../src/lib/bill-share';
import type { OwnerBillView } from '../../src/lib/db/owner-view';

/**
 * A bill with the two things that break a share: a cancelled line, and punctuation that is
 * special to a URL. Built as a partial and cast once, here, rather than in every test — the
 * function reads eight fields and a full OwnerBillView would bury them.
 */
function aBill(over: Partial<OwnerBillView> = {}): OwnerBillView {
  return {
    code: 'B-1044',
    tables: ['N4'],
    guests: 2,
    openedAt: '11:47 am',
    totals: [
      { label: 'Food', value: '₹805' },
      { label: 'GST 5%', value: '₹40' },
      { label: 'Tip for Ramesh', value: '₹20' },
      { label: 'To pay', value: '₹865', emphasis: true },
    ],
    paymentMode: 'Digital / UPI',
    paymentReference: 'UPI#4471',
    kots: [
      {
        id: 'k1',
        items: [
          { id: 'i1', name: "Chef's Special", qty: 2, foodType: 'veg', lineLabel: '₹560', cancelled: false },
          { id: 'i2', name: 'Gulab Jamun', qty: 1, foodType: 'veg', lineLabel: '₹30', cancelled: true },
          { id: 'i3', name: 'Butter Naan', qty: 3, foodType: 'veg', lineLabel: '₹215', cancelled: false },
        ],
      },
    ],
    ...over,
  } as unknown as OwnerBillView;
}

/**
 * AMENDED 18-Sep-2026 — the second argument became a RestaurantIdentity.
 *
 * `billShareText` took a bare `restaurantName: string`, and the only caller passed
 * `data.restaurant.name` — a column that does not exist — so the hardcoded fallback
 * 'Jalsa Restaurant' was on every WhatsApp bill ever sent. The parameter is now the identity
 * read from `legal_name` / `display_name`.
 *
 * Every assertion below is UNCHANGED. This helper only reshapes the argument, so what these
 * cases prove about the message is exactly what they proved before.
 */
const ID = (name: string): RestaurantIdentity => ({
  legalName: name,
  displayName: name,
  address: '',
  phone: '',
  email: '',
  gstin: '',
});

test('the message opens with who and which bill', () => {
  const text = billShareText(aBill(), ID('Jalsa Restaurant'));
  expect(text.split('\n')[0]).toBe('Jalsa Restaurant');
  expect(text).toContain('Bill B-1044 · N4');
  expect(text).toContain('2 guests · opened 11:47 am');
});

test('one guest is a guest, not 1 guests', () => {
  expect(billShareText(aBill({ guests: 1 }), ID('Jalsa'))).toContain('1 guest · opened');
});

test('every dish the guest got is in the message, with quantity and amount', () => {
  const text = billShareText(aBill(), ID('Jalsa'));
  expect(text).toContain("Chef's Special ×2  ₹560");
  expect(text).toContain('Butter Naan ×3  ₹215');
});

test('a CANCELLED line is not billed to the guest', () => {
  // The screen strikes it through, because the screen is a record of what happened. A message
  // to a guest is a statement of what they are paying for.
  const text = billShareText(aBill(), ID('Jalsa'));
  expect(text, 'a dish they did not get must not appear').not.toContain('Gulab Jamun');
});

test('the totals are the screen\'s own rows — GST included, not recomputed', () => {
  const bill = aBill();
  const text = billShareText(bill, ID('Jalsa'));
  for (const row of bill.totals) {
    expect(text, `${row.label} must survive into the message`).toContain(`${row.label}: ${row.value}`);
  }
  // The specific thing the requester asked for, asserted by name rather than by implication.
  expect(text).toContain('GST 5%: ₹40');
  expect(text).toContain('To pay: ₹865');
});

test('a different tax rate travels with the bill', () => {
  // The label carries the rate, so an 18% bill must not say 5%. This is why the rows are reused
  // rather than re-rendered from a constant.
  const text = billShareText(
    aBill({ totals: [{ label: 'GST 18%', value: '₹144' }, { label: 'To pay', value: '₹944' }] }),
      ID('Jalsa')
  );
  expect(text).toContain('GST 18%: ₹144');
  expect(text).not.toContain('GST 5%');
});

test('how it was paid is in the message when the bill is closed', () => {
  expect(billShareText(aBill(), ID('Jalsa'))).toContain('Paid by digital / upi · UPI#4471');
});

test('an OPEN bill claims no payment', () => {
  const text = billShareText(aBill({ paymentMode: null, paymentReference: '' }), ID('Jalsa'));
  expect(text, 'never tell a guest a bill is paid when it is not').not.toContain('Paid by');
});

test('a closed bill with no reference does not print a dangling separator', () => {
  const text = billShareText(aBill({ paymentReference: '' }), ID('Jalsa'));
  expect(text).toContain('Paid by digital / upi');
  expect(text).not.toContain('digital / upi · \n');
  expect(text.trimEnd().endsWith('·'), 'no trailing separator').toBe(false);
});

test('the link survives an apostrophe, a hash and the newlines', () => {
  const text = billShareText(aBill(), ID('Jalsa'));
  const url = whatsAppShareUrl(text);

  expect(url.startsWith('https://wa.me/?text=')).toBe(true);
  // The two characters that would silently truncate the message: `#` starts a fragment and a
  // raw newline is not legal in a URL at all. Both must be escaped.
  expect(url, '# must not start a fragment').not.toContain('#');
  expect(url, 'a raw newline is not legal in a URL').not.toContain('\n');

  // The apostrophe is deliberately NOT asserted away, and this spec was corrected to say so:
  // `encodeURIComponent` leaves `'` alone because it is legal in a query string, and the first
  // draft of this test failed on that. A spec that has to be loosened is worth recording rather
  // than quietly widening the implementation to satisfy it — nothing truncates on an apostrophe,
  // and the round-trip below is the assertion that actually proves the message arrives whole.
  expect(url, "an apostrophe rides along unescaped, and that is correct").toContain("'");

  // THE ASSERTION THAT MATTERS: what WhatsApp receives is exactly what was composed.
  const decoded = decodeURIComponent(url.slice('https://wa.me/?text='.length));
  expect(decoded).toBe(text);
  expect(decoded).toContain("Chef's Special");
  expect(decoded).toContain('UPI#4471');
});

test('a bill with no rounds still produces a readable message', () => {
  const text = billShareText(aBill({ kots: [] }), ID('Jalsa'));
  expect(text).toContain('Bill B-1044');
  expect(text).toContain('To pay: ₹865');
  expect(text, 'no run of blank lines where the dishes would be').not.toContain('\n\n\n');
});
