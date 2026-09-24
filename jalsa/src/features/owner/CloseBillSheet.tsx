'use client';

import * as React from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip, FoodMark, SectionLabel } from '@/components/ui/atoms';
import { cn } from '@/lib/cn';
import { TotalsBlock } from '@/components/ui/bill';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { discountBothWays, rupees } from '@/lib/money';
import { CashChangeField, cashProblem, payableAtClose } from '@/components/ui/cash-change';
import {
  DiscountFields,
  NO_DISCOUNT,
  discountPayload,
  discountProblem,
  type DiscountEntry,
} from '@/components/ui/discount-fields';
import type { OwnerBillView } from '@/lib/db/owner-view';

/**
 * Screen 24 — recording a payment. The ONE closure dialog (Standard 10.4), used by Live orders
 * and by Payments, because there is exactly one way a bill is closed and a second dialog would
 * eventually disagree with the first about what a discount does.
 *
 * IT SHOWS THE PER-TABLE BREAKDOWN ON A GROUP BILL
 *   So the host can see who ate what — while it stays ONE bill and ONE payment. The design is
 *   explicit that this is a display, never a split.
 *
 * IT NAMES WHO IS CLOSING IT, in the footer note, before the button is pressed. The database
 * enforces that a closed bill has a closer; this sentence is how the person doing it knows their
 * name is going on it.
 *
 * IT SHOWS WHAT WAS ORDERED, ON THE LEFT, AND THE MONEY ON THE RIGHT (17-Sep-2026)
 *   Every figure in this dialog used to be a sum with nothing behind it: "Food ₹805" and a
 *   per-table breakdown that is also only amounts. A guest querying their bill at the counter
 *   asks about a DISH, and the one screen where the money is taken could not answer. The lines
 *   were already in `bill.kots[].items[]` and this component simply never read them - no query,
 *   no route and no migration were needed to put them on the screen.
 *
 *   The row is the same row `LiveOrders` draws - FoodMark, name, xqty, line amount, struck
 *   through when cancelled - because a second way to print a dish line is a second way for two
 *   screens to disagree about one round.
 */

const MODES = ['Cash', 'Digital / UPI', 'Card'] as const;

export function CloseBillSheet({
  bill,
  open,
  onOpenChange,
  send,
  runBusy,
  busy,
  canDiscount,
  closerName,
  onClosed,
}: {
  bill: OwnerBillView | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  send: <R>(path: string, payload: unknown) => Promise<R>;
  runBusy: (fn: () => Promise<void>) => void;
  busy: boolean;
  canDiscount: boolean;
  closerName: string;
  onClosed?: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = React.useState<string>(MODES[1]);
  const [reference, setReference] = React.useState('');
  /* ONE discount, two views, and which box was typed in. The pair is the same control the
     captain's Close sheet uses — see src/components/ui/discount-fields.tsx. */
  const [discount, setDiscount] = React.useState<DiscountEntry>(NO_DISCOUNT);
  /** Cash received, as typed. Only read when the mode is Cash (H3). */
  const [tendered, setTendered] = React.useState('');

  // Opening the dialog on a DIFFERENT bill clears the form, during render rather than in an
  // effect. A discount typed for one table must never be sitting in the box when the next one
  // opens - that is a wrong bill, not a cosmetic glitch.
  const openKey = open ? (bill?.id ?? '') : null;
  const [lastOpenKey, setLastOpenKey] = React.useState(openKey);
  if (lastOpenKey !== openKey) {
    setLastOpenKey(openKey);
    setMode(MODES[1]);
    setReference('');
    setDiscount(NO_DISCOUNT);
    setTendered('');
  }

  if (!bill) return null;

  /* Every round on this bill, in the order the payload carries them. Not filtered: a round
     whose lines were all cancelled still explains a gap between what the table remembers
     ordering and what the total says, and the counter is where that question gets asked. */
  const rounds = bill.kots;

  const payload = discountPayload(discount);
  const problem = discountProblem(discount, bill.subtotal);
  // The derived value, shown as it is typed (Standard 3.4). ONE discount — not the sum of two
  // boxes — because the two boxes are two views of the same figure.
  // Change is for cash only, against what is charged at this moment (H3).
  const payableNow = payableAtClose({ subtotal: bill.subtotal, taxRate: bill.taxRate, tip: bill.tip, discount });
  const tenderProblem = mode === 'Cash' ? cashProblem(payableNow, tendered) : null;
  const discountPreview = payload
    ? discountBothWays({ base: bill.subtotal, typed: payload.discountType, value: payload.discountValue }).amount
    : 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      posture="modal"
      title={`Record payment · ${bill.code}`}
      description={`${bill.tables.join(', ')} · ${bill.guests} guests · opened ${bill.openedAt}`}
      testId="owner-close-sheet"
      footer={
        <>
          <Button data-testid="owner-close-cancel" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="owner-close-confirm"
            disabled={busy || problem !== null || tenderProblem !== null}
            onClick={() =>
              runBusy(async () => {
                const res = await send<{ payable: number }>('/api/owner/action', {
                  action: 'close-bill',
                  billId: bill.id,
                  mode,
                  reference,
                  // Only the box that was typed in, and which one it was. The server derives
                  // the other from the subtotal and takes the discount once.
                  ...(payload ?? {}),
                });
                toast.show(
                  `${bill.code} closed as ${mode.toLowerCase()} — ${rupees(res.payable)}. ${
                    bill.tables.length > 1 ? `${bill.tables.length} tables freed.` : `Table ${bill.tables[0]} freed.`
                  }`,
                  { tone: 'success' }
                );
                onOpenChange(false);
                onClosed?.();
              })
            }
          >
            Record {mode.toLowerCase()} payment
          </Button>
        </>
      }
    >
      {/*
        TWO PANES ON A DESKTOP, ONE COLUMN ON A PHONE.

        `md:` is the right breakpoint rather than a guess: this Sheet is
        `w-[min(46rem,calc(100vw-2rem))]`, so at a 768px viewport it is already at its 736px
        cap and two columns are ~350px each - enough for a dish name beside a form. Below that
        the dialog is the viewport minus 2rem, and two panes at 360px would be ~160px each,
        which is a squeeze rather than a layout. `minmax(0,1fr)` twice, not `1fr 1fr`, because a
        grid track's default `min-width:auto` refuses to shrink below its longest unbroken word
        and a long dish name would push the form off the side.

        `grid-cols-1` at the base is NOT redundant with `grid`, and the render spec is what
        found that. With no explicit column a grid gets ONE `auto` track, `auto` sizes to
        max-content, and a dish name with no space in it therefore set the dialog's width: the
        panes spilled at 430px, 390px, 375px, 360px and 320px - every phone. Tailwind's
        `grid-cols-1` is `repeat(1, minmax(0, 1fr))`, which is the same floor the two-column
        rule states explicitly.

        The order details come FIRST in the DOM, so the single column reads the way a bill
        reads anywhere: the itemisation, then the total, then how it is being paid.
      */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className="flex flex-col gap-4" data-testid="owner-close-order-pane">
          {rounds.length ? (
            <div>
              <SectionLabel>What was ordered</SectionLabel>
              <ul className="m-0 mt-1 flex list-none flex-col gap-3 p-0" data-testid="owner-close-rounds">
                {rounds.map((k) => (
                  <li key={k.id}>
                    <p className="m-0 type-caption text-[var(--text-muted)]">
                      {k.code} · table {k.fromTable} · {k.placedAt}
                    </p>
                    <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
                      {k.items.map((i) => (
                        <li key={i.id} className="flex items-center gap-2.5 type-caption">
                          <FoodMark type={i.foodType} />
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate',
                              i.cancelled && 'text-[var(--text-muted)] line-through'
                            )}
                          >
                            {i.name}
                          </span>
                          <span className="tabular-nums text-[var(--text-muted)]">×{i.qty}</span>
                          <span className="w-16 text-right tabular-nums">{i.lineLabel}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* Not an empty box: a bill with no rounds on it is worth SAYING, on the screen
               where money is about to be taken against it. */
            <p className="m-0 type-caption text-[var(--text-muted)]" data-testid="owner-close-rounds-empty">
              No rounds on this bill.
            </p>
          )}

          {bill.perTable.length ? (
            <div>
              <SectionLabel>What each table ordered</SectionLabel>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {bill.perTable.map((t) => (
                  <li key={t.table} className="flex justify-between type-caption">
                    <span>Table {t.table}</span>
                    <span className="tabular-nums text-[var(--text-muted)]">{t.amountLabel}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-1.5 type-caption leading-relaxed text-[var(--text-muted)]">
                Shown so the host can see who ate what. It stays one bill and one payment.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4" data-testid="owner-close-money-pane">
        <TotalsBlock rows={bill.totals} testId="owner-close-totals" />

        {canDiscount ? (
          <DiscountFields
            base={bill.subtotal}
            taxRate={bill.taxRate}
            tip={bill.tip}
            entry={discount}
            onChange={setDiscount}
            disabled={busy}
            testIdPrefix="owner-discount"
          />
        ) : null}

        <div>
          <SectionLabel>Paid by</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Chip
                key={m}
                on={mode === m}
                onClick={() => setMode(m)}
                data-testid={`owner-mode-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              >
                {m}
              </Chip>
            ))}
          </div>
        </div>

        {mode === 'Cash' ? (
          <CashChangeField
            payable={payableNow}
            value={tendered}
            onChange={setTendered}
            disabled={busy}
            testIdPrefix="owner-close"
          />
        ) : null}

        <Field
          label="Reference"
          htmlFor="owner-close-ref"
          hint="Optional — a UPI reference, a card slip number, whatever you would want to find later."
        >
          <Input
            id="owner-close-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            data-testid="owner-close-reference"
          />
        </Field>

        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Recorded against <strong>{closerName}</strong> at the moment you press it. The tip posts to its own ledger
          and stays out of income, every table on this bill is freed at once, and the guest sees the receipt on their
          phone.
        </p>
        </div>
      </div>
    </Sheet>
  );
}
