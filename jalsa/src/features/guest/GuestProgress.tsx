'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { useToast } from '@/components/ui/toast';
import type { Tone } from '@/lib/status';
import { ActionBar, TotalReveal, type GuestScreenProps } from './GuestApp';

/**
 * Screens 6 and 7 — the round just placed, and every round on this bill.
 *
 * PLAIN WORDS, NEVER A CODE (Standard 7.1). The guest sees "In the kitchen" and "Ready"; the
 * captain sees "Cooking" and "Ready" for the same row. Both come from the one status vocabulary,
 * and the difference is deliberate: the guest is being reassured, the captain is being told what
 * to do.
 *
 * THE HEART UNLOCKS ON SERVED, AND ONLY ON SERVED. That tap is a person confirming the food is
 * on the table — the only moment at which "did you love it?" is a fair question.
 */

export function PlacedScreen({ data, go }: GuestScreenProps) {
  const last = data.rounds[data.rounds.length - 1];
  const summary = last?.items.map((i) => `${i.name} ×${i.qty}`).join(' · ') ?? '';

  return (
    <div className="flex flex-col items-center gap-5 pt-10 text-center" data-testid="guest-placed">
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-surface)] text-[26px]"
      >
        ✓
      </span>
      <div>
        <h2 className="text-[21px]">{data.copy.cookingLine ?? 'Your order is being cooked'}</h2>
        <p className="m-0 mt-1 text-[13px] text-[var(--text-muted)]">
          {(data.copy.cookingSub ?? '{captain} has it · usually 18–22 minutes').replace(
            '{captain}',
            data.captain || 'The kitchen'
          )}
        </p>
      </div>

      {last ? (
        <Card className="w-full text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-bold">{last.code}</span>
            <Pill tone={last.tone as Tone}>{last.statusWord}</Pill>
          </div>
          <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{summary}</p>
        </Card>
      ) : null}

      <ActionBar testId="guest-placed-bar">
        <Button data-testid="guest-see-my-order" size="lg" onClick={() => go('status')}>
          See my order
        </Button>
        <Button data-testid="guest-placed-order-more" variant="ghost" onClick={() => go('menu')}>
          Order more
        </Button>
      </ActionBar>
    </div>
  );
}

export function StatusScreen({
  data,
  go,
  openSheet,
  send,
  runBusy,
  busy,
  showTotal,
  setShowTotal,
}: GuestScreenProps) {
  const toast = useToast();
  const [loved, setLoved] = React.useState<Record<string, boolean>>({});
  const anyServed = data.rounds.some((r) => r.status === 'served');

  const requestPayment = () =>
    runBusy(async () => {
      await send('/api/guest/bill', { action: 'request-payment' });
      toast.show(data.captain ? `${data.captain} is bringing your bill` : 'Your captain is bringing the bill', {
        tone: 'success',
      });
      go('upsell');
    });

  if (data.rounds.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-8" data-testid="guest-status-empty">
        <h2 className="text-[19px]">Nothing ordered yet</h2>
        <p className="m-0 text-[13px] leading-relaxed text-[var(--text-muted)]">
          When you send a round to the kitchen it appears here, with where it has got to. Every round stays on one
          bill.
        </p>
        <Button data-testid="guest-status-open-menu" onClick={() => go('menu')}>
          Open the menu
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="guest-status">
      <div>
        <h2 className="text-[19px]">
          {anyServed ? (data.copy.servedHeading ?? 'On your table — enjoy') : 'Your order'}
        </h2>
        <p className="m-0 mt-0.5 text-[12.5px] text-[var(--text-muted)]">
          {anyServed && data.features.heart
            ? (data.copy.heartHint ?? 'Tap the heart on anything you loved')
            : 'The kitchen is working through it. Order more any time.'}
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {data.rounds.map((r) => (
          <li key={r.code}>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] font-bold">
                  {r.code} <span className="font-normal text-[var(--text-muted)]">· {r.placedAt}</span>
                </span>
                <Pill tone={r.tone as Tone}>{r.statusWord}</Pill>
              </div>
              <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
                {r.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2.5">
                    <FoodMark type={i.foodType} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{i.name}</span>
                    <span className="text-[12.5px] tabular-nums text-[var(--text-muted)]">×{i.qty}</span>
                    {data.features.heart ? (
                      <button
                        data-testid={`guest-heart-${i.id}`}
                        type="button"
                        disabled={!i.servable}
                        aria-label={i.servable ? `I loved the ${i.name}` : `${i.name} is not on your table yet`}

                        onClick={() => {
                          setLoved((cur) => ({ ...cur, [i.id]: !cur[i.id] }));
                          if (!loved[i.id] && data.features.takeaway) openSheet('loved', i.name);
                        }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[17px] leading-none transition-colors hover:bg-[var(--primary-surface)] disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                      >
                        <span className={loved[i.id] ? 'text-[var(--primary)]' : 'text-[var(--text-disabled)]'}>
                          {loved[i.id] ? '♥' : '♡'}
                        </span>
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>

      {/* "So far" moved into the bar behind the same tick box the ordering screens use. One
          control for the total, in one place, on every screen that has one — a guest who
          switched it on while ordering does not have to find a different switch here. */}
      <ActionBar testId="guest-status-bar">
        <TotalReveal
          checked={showTotal}
          onCheckedChange={setShowTotal}
          rows={[{ label: 'So far', value: data.runningTotalLabel }]}
          testId="guest-status-total-toggle"
        />
        {data.billStatus === 'payment_requested' ? (
          <>
            <p className="m-0 rounded-[var(--radius-md)] bg-[var(--primary-surface)] px-3 py-2 text-center text-[12.5px] font-semibold text-[var(--on-primary-surface)]">
              {data.captain ? `${data.captain} is bringing your bill` : 'Your bill is on its way'} ·{' '}
              {data.payableLabel}
            </p>
            <Button data-testid="guest-continue-closure" size="lg" onClick={() => go('upsell')}>
              Carry on to pay
            </Button>
          </>
        ) : (
          <>
            <Button data-testid="guest-request-payment" size="lg" onClick={requestPayment} disabled={busy}>
              {data.copy.payBtn ?? 'Request payment'}
            </Button>
            <Button data-testid="guest-order-more" variant="ghost" onClick={() => go('menu')}>
              Order more
            </Button>
          </>
        )}
      </ActionBar>
    </div>
  );
}
