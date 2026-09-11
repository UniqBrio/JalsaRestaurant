'use client';

import * as React from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip, SectionLabel } from '@/components/ui/atoms';
import { TotalsBlock } from '@/components/ui/bill';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
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
  const [pct, setPct] = React.useState('');
  const [flat, setFlat] = React.useState('');

  // Opening the dialog on a DIFFERENT bill clears the form, during render rather than in an
  // effect. A discount typed for one table must never be sitting in the box when the next one
  // opens - that is a wrong bill, not a cosmetic glitch.
  const openKey = open ? (bill?.id ?? '') : null;
  const [lastOpenKey, setLastOpenKey] = React.useState(openKey);
  if (lastOpenKey !== openKey) {
    setLastOpenKey(openKey);
    setMode(MODES[1]);
    setReference('');
    setPct('');
    setFlat('');
  }

  if (!bill) return null;

  const pctNum = Number(pct);
  const flatNum = Number(flat);
  // The derived value, shown as it is typed (Standard 3.4). A percentage nobody can convert in
  // their head is a percentage somebody eventually applies twice.
  const discountPreview =
    (Number.isFinite(pctNum) && pctNum > 0 ? Math.round((bill.payable * pctNum) / 100) : 0) +
    (Number.isFinite(flatNum) && flatNum > 0 ? Math.round(flatNum) : 0);

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
            disabled={busy}
            onClick={() =>
              runBusy(async () => {
                const res = await send<{ payable: number }>('/api/owner/action', {
                  action: 'close-bill',
                  billId: bill.id,
                  mode,
                  reference,
                  ...(Number.isFinite(pctNum) && pctNum > 0 ? { discountPct: pctNum } : {}),
                  ...(Number.isFinite(flatNum) && flatNum > 0 ? { discountAmount: flatNum } : {}),
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
      <div className="flex flex-col gap-4">
        <TotalsBlock rows={bill.totals} testId="owner-close-totals" />

        {bill.perTable.length ? (
          <div>
            <SectionLabel>What each table ordered</SectionLabel>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {bill.perTable.map((t) => (
                <li key={t.table} className="flex justify-between text-[12.5px]">
                  <span>Table {t.table}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">{t.amountLabel}</span>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
              Shown so the host can see who ate what. It stays one bill and one payment.
            </p>
          </div>
        ) : null}

        {canDiscount ? (
          <div className="flex flex-wrap gap-3">
            <Field label="Discount %" htmlFor="owner-disc-pct" className="min-w-[8rem] flex-1">
              <Input
                id="owner-disc-pct"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                data-testid="owner-discount-pct"
              />
            </Field>
            <Field label="or flat ₹" htmlFor="owner-disc-flat" className="min-w-[8rem] flex-1">
              <Input
                id="owner-disc-flat"
                type="number"
                inputMode="numeric"
                min={0}
                value={flat}
                onChange={(e) => setFlat(e.target.value)}
                data-testid="owner-discount-flat"
              />
            </Field>
            <p className="basis-full text-[11.5px] leading-relaxed text-[var(--text-muted)]">
              {discountPreview > 0
                ? `Takes ${rupees(discountPreview)} off — the payable becomes about ${rupees(Math.max(0, bill.payable - discountPreview))}. Recorded against your name.`
                : 'Both are optional. A percentage is applied first, then any flat amount.'}
            </p>
          </div>
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

        <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          Recorded against <strong>{closerName}</strong> at the moment you press it. The tip posts to its own ledger
          and stays out of income, every table on this bill is freed at once, and the guest sees the receipt on their
          phone.
        </p>
      </div>
    </Sheet>
  );
}
