'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Chip, FoodMark, SectionLabel, Skeleton } from '@/components/ui/atoms';
import { TotalsBlock } from '@/components/ui/bill';
import { SuccessNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import { ActionBar, type GuestScreenProps } from './GuestApp';

/**
 * Screens 8 to 13 — the closure path: upsell, tip, pay, the failure, the receipt and the bill.
 *
 * THE PART OF THIS FILE THAT MATTERS MOST IS THE FAILURE SCREEN
 *   Payment is the one step in the journey where a stranger's system can let the guest down, and
 *   it is the moment they are most likely to think they have been charged twice. So the failed
 *   state says three things in order: nothing was charged, the bill is still open at this exact
 *   amount, and the table is still theirs — then offers the two routes onward. Never a dead end
 *   (Standard 1.6), never an unexplained total (7.2).
 *
 * THE TIP IS INSIDE WHAT THEY PAY AND OUTSIDE WHAT THE RESTAURANT EARNS, and the screen says so
 * in a sentence rather than leaving it to be inferred (7.3).
 */

/* ── 9. Dessert and beverage upsell ────────────────────────────────────── */

export function UpsellScreen({ data, go, send, runBusy, busy }: GuestScreenProps) {
  const toast = useToast();

  const offers = React.useMemo(
    () => data.menu.filter((m) => m.available && (m.category === 'Desserts' || m.category === 'Drinks')).slice(0, 3),
    [data.menu]
  );

  if (!data.features.upsell || offers.length === 0) {
    // Nothing to offer is not a screen. Standard 5.6: withhold the step rather than showing an
    // empty version of it.
    return <TipScreen data={data} go={go} openSheet={() => {}} send={send} busy={busy} runBusy={runBusy} />;
  }

  const add = (id: string, name: string) =>
    runBusy(async () => {
      await send('/api/guest/cart', { itemId: id, qty: 1 });
      const res = await send<{ kotCode: string }>('/api/guest/round', {});
      toast.show(`${name} added as ${res.kotCode} — the kitchen still has time`, { tone: 'success' });
      go('tip');
    });

  return (
    <div className="flex flex-col gap-4 pt-2" data-testid="guest-upsell">
      <SuccessNotice testId="guest-upsell-confirm">
        {data.captain ? `${data.captain} is bringing your bill.` : 'Your bill is on its way.'} It comes to{' '}
        <strong>{data.payableLabel}</strong> including GST.
      </SuccessNotice>

      <div>
        <h2 className="text-[19px]">One last thing?</h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-[var(--text-muted)]">
          Added as a fresh round — the kitchen still has time.
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {offers.map((o) => (
          <li key={o.id}>
            <Card className="flex items-center gap-3 p-3">
              <FoodMark type={o.foodType} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{o.name}</span>
                <span className="block text-[11.5px] text-[var(--text-muted)]">{o.description}</span>
              </span>
              <span className="text-[13px] font-bold tabular-nums">{o.priceLabel}</span>
              <Button
                data-testid={`guest-upsell-add-${o.id}`}
                size="icon"
                onClick={() => add(o.id, o.name)}
                disabled={busy}
                aria-label={`Add ${o.name}`}
              >
                +
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <ActionBar testId="guest-upsell-bar">
        <Button data-testid="guest-upsell-skip" size="lg" onClick={() => go('tip')}>
          No thanks, carry on
        </Button>
      </ActionBar>
    </div>
  );
}

/* ── 10. Tip ───────────────────────────────────────────────────────────── */

export function TipScreen({ data, go, send, runBusy, busy }: GuestScreenProps) {
  const [chosen, setChosen] = React.useState<number>(data.tipChosen);

  const choose = (amount: number) => {
    setChosen(amount);
    runBusy(async () => {
      await send('/api/guest/bill', { action: 'tip', amount });
    });
  };

  if (!data.features.tip) {
    return <PayingGate data={data} go={go} send={send} runBusy={runBusy} busy={busy} />;
  }

  return (
    <div className="flex flex-col gap-4 pt-2" data-testid="guest-tip">
      <div>
        <h2 className="text-[19px]">
          {(data.copy.tipPrompt ?? 'Add a tip for {captain}?').replace('{captain}', data.captain || 'the team')}
        </h2>
        <p className="m-0 mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          Goes to {data.captain ? `${data.captain} and ` : ''}the floor team, tracked apart from the
          restaurant&rsquo;s own takings.
        </p>
      </div>

      <div className="flex gap-2">
        {data.tipOptions.map((t) => (
          <Chip key={t} on={chosen === t} className="flex-1" onClick={() => choose(t)} data-testid={`guest-tip-${t}`}>
            {t === 0 ? 'No tip' : `+ ${rupees(t)}`}
          </Chip>
        ))}
      </div>

      <Card>
        <TotalsBlock rows={data.totals} testId="guest-tip-totals" />
      </Card>

      <ActionBar testId="guest-tip-bar">
        <Button data-testid="guest-pay" size="lg" onClick={() => go('paying')} disabled={busy}>
          Pay {data.payableLabel}
        </Button>
        <Button data-testid="guest-pay-at-table" variant="ghost" onClick={() => go('status')}>
          I will pay {data.captain || 'the captain'} directly
        </Button>
      </ActionBar>
    </div>
  );
}

function PayingGate(props: Omit<GuestScreenProps, 'openSheet'>) {
  return (
    <div className="flex flex-col gap-4 pt-2" data-testid="guest-pay-direct">
      <Card>
        <TotalsBlock rows={props.data.totals} testId="guest-direct-totals" />
      </Card>
      <ActionBar testId="guest-direct-bar">
        <Button data-testid="guest-pay" size="lg" onClick={() => props.go('paying')}>
          Pay {props.data.payableLabel}
        </Button>
      </ActionBar>
    </div>
  );
}

/* ── 11. Paying, and the two ways it ends ──────────────────────────────── */

export function PayingScreen({ data, go, send, runBusy, busy }: GuestScreenProps) {
  const report = (outcome: 'succeeded' | 'failed') =>
    runBusy(async () => {
      await send('/api/guest/bill', { action: 'pay', outcome });
      go(outcome === 'failed' ? 'failed' : 'paid');
    });

  return (
    <div className="flex flex-col items-center gap-5 pt-10 text-center" data-testid="guest-paying">
      <Skeleton className="h-16 w-16 rounded-full" />
      <div>
        <h2 className="text-[21px]">Waiting for your bank</h2>
        <p className="m-0 mt-1 text-[13px] text-[var(--text-muted)]">
          Approve the request in your UPI app. This page updates itself.
        </p>
      </div>
      <p className="m-0 max-w-[24em] rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 text-[12px] leading-relaxed text-[var(--on-warning-surface)]">
        Do not close this page. If the payment fails, nothing is charged and your bill stays open.
      </p>

      {/*
        No payment provider has been chosen yet (Product Plan §8), so the pay step is a single
        swappable stage with its own states. Until one is wired, the two buttons below are the
        HONEST version of that: they are the two answers a real gateway will send back, and both
        paths are fully built. They are labelled as a stand-in rather than dressed up as a
        gateway, because a fake "Pay now" that always succeeds is the one thing that would let a
        broken failure path ship unnoticed.
      */}
      <div className="w-full max-w-[22rem] rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)]/45 p-4">
        <SectionLabel>Payment provider not yet chosen</SectionLabel>
        <p className="m-0 mb-3 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          These two buttons stand in for the gateway&rsquo;s answer. Everything either one leads to is real.
        </p>
        <div className="flex flex-col gap-2">
          <Button data-testid="guest-pay-succeed" onClick={() => report('succeeded')} disabled={busy}>
            The bank approved it
          </Button>
          <Button data-testid="guest-pay-fail" variant="secondary" onClick={() => report('failed')} disabled={busy}>
            The payment failed
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FailedScreen({ data, go }: GuestScreenProps) {
  return (
    <div className="flex flex-col items-center gap-5 pt-10 text-center" data-testid="guest-failed">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--error-surface)] text-[26px] font-bold text-[var(--on-error-surface)]"
      >
        !
      </span>
      <div>
        <h2 className="text-[21px]">That payment did not go through</h2>
        <p className="m-0 mt-1 max-w-[26em] text-[13px] leading-relaxed text-[var(--text-muted)]">
          Nothing was charged. Your bill is still open at <strong>{data.payableLabel}</strong> and your table is still
          yours.
        </p>
      </div>

      <ActionBar testId="guest-failed-bar">
        <Button data-testid="guest-failed-retry" size="lg" onClick={() => go('paying')}>
          Try again
        </Button>
        <Button data-testid="guest-failed-pay-captain" variant="ghost" onClick={() => go('status')}>
          Pay {data.captain || 'the captain'} instead
        </Button>
      </ActionBar>
    </div>
  );
}

/* ── 12-13. Receipt, invoice and the review prompt ─────────────────────── */

export function PaidScreen({ data, go, send, runBusy, busy }: GuestScreenProps) {
  const toast = useToast();
  const settled = data.billStatus === 'closed';

  return (
    <div className="flex flex-col items-center gap-5 pt-8 text-center" data-testid="guest-paid">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-surface)] text-[26px]"
      >
        ✓
      </span>

      <div>
        <h2 className="text-[21px]">
          {settled ? `${data.copy.paidHeading ?? 'Paid'} · ${data.payableLabel}` : 'Thank you'}
        </h2>
        <p className="m-0 mt-1 max-w-[26em] text-[13px] leading-relaxed text-[var(--text-muted)]">
          {settled
            ? `${data.paymentMode ?? 'Payment'} at ${data.paidAt ?? 'closing'}${
                data.tipChosen > 0 ? ` · ${rupees(data.tipChosen)} tip to ${data.captain || 'the floor team'}` : ''
              }`
            : // The honest in-between state: the guest's bank said yes, and a member of staff
              // has not yet recorded the closure. Claiming "Paid" here would be the app making
              // a promise only a person can keep.
              `Your bank approved it. ${data.captain || 'Your captain'} records the closure at the counter — you will see the receipt here the moment they do.`}
        </p>
      </div>

      {data.features.whatsapp ? (
        <Button
          data-testid="guest-whatsapp"
          variant="secondary"
          onClick={() => toast.show('Ask your captain for the bill on WhatsApp — the provider is not connected yet.')}
        >
          Send the bill to WhatsApp
        </Button>
      ) : null}

      <Button data-testid="guest-see-bill" variant="ghost" onClick={() => go('invoice')}>
        See the full bill
      </Button>

      {data.features.review && data.reviewUrl ? (
        <Card className="w-full text-left">
          <SectionLabel>{data.copy.reviewHeading ?? 'Loved it? Tell Google'}</SectionLabel>
          <p className="m-0 mb-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            {data.copy.reviewSub ?? 'A photo from tonight helps more than words'}
          </p>
          <Button data-testid="guest-review" asChild>
            <a data-testid="guest-review-link" href={data.reviewUrl} target="_blank" rel="noopener noreferrer">
              Write a review
            </a>
          </Button>
        </Card>
      ) : null}

      {!settled ? (
        <Button
          data-testid="guest-remind-captain"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            runBusy(async () => {
              await send('/api/guest/bill', { action: 'request-payment' });
              toast.show('Your captain has been reminded');
            })
          }
        >
          Remind {data.captain || 'the captain'}
        </Button>
      ) : null}
    </div>
  );
}

export function InvoiceScreen({ data }: GuestScreenProps) {
  const lines = data.rounds.flatMap((r) => r.items.map((i) => ({ ...i, code: r.code })));

  return (
    <div className="flex flex-col gap-4 pb-6" data-testid="guest-invoice">
      <div className="text-center">
        <h2 className="text-[19px]">{data.restaurantName}</h2>
        <p className="m-0 mt-0.5 text-[11.5px] text-[var(--text-muted)]">
          Table {data.table.name} · {data.billCode ?? '—'}
          {data.paidAt ? ` · ${data.paidAt}` : ''}
          {data.captain ? ` · ${data.captain}` : ''}
        </p>
      </div>

      <Card>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-2.5 text-[12.5px]">
              <FoodMark type={l.foodType} size={11} />
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="tabular-nums text-[var(--text-muted)]">×{l.qty}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <TotalsBlock rows={data.totals} testId="guest-invoice-totals" />
        </div>
      </Card>

      <p className="m-0 px-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
        GST is charged at {data.taxRate}% and shown as its own line. A tip is not restaurant income and is paid to the
        floor team in full.
      </p>
    </div>
  );
}
