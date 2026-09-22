'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { guestSteps, type Tone } from '@/lib/status';
import type { GuestRound } from '@/lib/db/guest-view';
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

/**
 * Where this round has got to — the reference design's timeline, one row per step.
 *
 * WHY THE TIMELINE AND NOT THE COMPACT STEPPER
 *   The design set draws both and annotates them: the stepper is "sits above the menu so ordering
 *   continues", the timeline is "full history, good for multiple rounds". This screen IS the
 *   multiple-rounds screen, so it gets the timeline. The stepper's own labels — Placed, Kitchen —
 *   are deliberately NOT introduced here: they are synonyms for words the status vocabulary
 *   already owns, and `src/lib/status.ts` exists precisely to stop a screen inventing one.
 *
 * WHY IT IS FOUR ROWS AND NOT FIVE
 *   `picked_up` is a real floor state but it is still "Ready" to the guest — their food is up.
 *   `guestSteps` folds it into the Ready step, which is why that mapping lives beside the
 *   vocabulary rather than in this file.
 *
 * READ-ONLY BY CONSTRUCTION. There is no control here and no handler — the guest cannot move a
 * round, and the server would refuse them anyway.
 */
function RoundTimeline({ round }: { round: GuestRound }) {
  const steps = guestSteps(round.status);
  const timeFor: Record<string, string> = {
    new: round.placedAt,
    preparing: round.startedAt,
    ready: round.readyAt,
    served: round.servedAt,
  };

  return (
    <ol
      className="m-0 mt-3 flex list-none flex-col p-0"
      data-testid={`guest-timeline-${round.code}`}
      aria-label={`Progress for ${round.code}`}
    >
      {steps.map((step, i) => {
        const time = timeFor[step.key] ?? '';
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3" data-testid={`guest-step-${step.key}`} data-state={step.state}>
            {/* The dot and the line under it. The line is skipped on the last row so the
                timeline ends rather than trailing off. */}
            <span className="flex flex-col items-center" aria-hidden>
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full type-caption font-bold leading-none',
                  step.state === 'done' && 'bg-[var(--success)] text-[var(--on-success)]',
                  step.state === 'current' && 'bg-[var(--primary)] text-[var(--on-primary)]',
                  step.state === 'todo' && 'bg-[var(--skeleton)] text-[var(--text-muted)]'
                )}
              >
                {step.state === 'done' ? '✓' : step.state === 'current' ? '●' : ''}
              </span>
              {last ? null : (
                <span
                  className={cn(
                    'w-0.5 flex-1',
                    step.state === 'done' ? 'bg-[var(--success)]' : 'bg-[var(--skeleton)]'
                  )}
                />
              )}
            </span>

            <span className={cn('flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2', last ? 'pb-0' : 'pb-3')}>
              <span
                className={cn(
                  'type-body',
                  step.state === 'todo' ? 'text-[var(--text-muted)]' : 'font-semibold'
                )}
              >
                {step.label}
              </span>
              {time ? <span className="type-caption text-[var(--text-muted)]">{time}</span> : null}
              {/* The one line of reassurance the design calls for, and only while it is true. */}
              {step.state === 'current' && step.key === 'ready' ? (
                <span className="type-caption w-full text-[var(--text-muted)]">Your captain is bringing it</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function PlacedScreen({ data, go }: GuestScreenProps) {
  const last = data.rounds[data.rounds.length - 1];
  const summary = last?.items.map((i) => `${i.name} ×${i.qty}`).join(' · ') ?? '';

  return (
    <div className="flex flex-col items-center gap-5 pt-10 text-center" data-testid="guest-placed">
      <span
        aria-hidden
        /* INTENTIONAL EXCEPTION — a glyph sized to its 64px circle, not to the reading
           scale. See the exception list in scripts/check-typography.mjs. */
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-surface)] text-[26px]"
      >
        ✓
      </span>
      <div>
        <h2 className="type-h2">{data.copy.cookingLine ?? 'Your order is being cooked'}</h2>
        <p className="m-0 mt-1 type-body text-[var(--text-muted)]">
          {(data.copy.cookingSub ?? '{captain} has it · usually 18–22 minutes').replace(
            '{captain}',
            data.captain || 'The kitchen'
          )}
        </p>
      </div>

      {last ? (
        <Card className="w-full text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="type-body font-bold">{last.code}</span>
            <Pill tone={last.tone as Tone}>{last.statusWord}</Pill>
          </div>
          <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">{summary}</p>
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

  /** Withdraw the request and go straight back to the menu. One tap, two jobs. */
  const continueOrdering = () =>
    runBusy(async () => {
      await send('/api/guest/bill', { action: 'resume-ordering' });
      toast.show('Payment request paused. Order away.', { tone: 'success' });
      go('menu');
    });

  /* Withdraw and STAY. The difference between this and Continue Ordering is only where the
     guest ends up, and that difference is the whole reason both exist: one is for "actually,
     dinner is not finished", the other for "we asked too early". */
  const cancelRequest = () =>
    runBusy(async () => {
      await send('/api/guest/bill', { action: 'resume-ordering' });
      toast.show('Payment request paused.', { tone: 'success' });
    });

  if (data.rounds.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-8" data-testid="guest-status-empty">
        <h2 className="type-h3">Nothing ordered yet</h2>
        <p className="m-0 type-body leading-relaxed text-[var(--text-muted)]">
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
        <h2 className="type-h3">
          {anyServed ? (data.copy.servedHeading ?? 'On your table — enjoy') : 'Your order'}
        </h2>
        <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]">
          {anyServed && data.features.heart
            ? (data.copy.heartHint ?? 'Tap the heart on anything you loved')
            : 'The kitchen is working through it. Order more any time.'}
        </p>
      </div>

      {/* 4f — "The owner replies, and the guest sees they were heard". The columns have existed
          since the schema was written and the owner's Dashboard has been filling them; nothing
          ever read them back to the phone that asked. A reply nobody receives is a note the
          restaurant wrote to itself. Only ANSWERED suggestions appear: the guest wrote the
          question, they do not need it read back. */}
      {data.replies.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="guest-replies">
          {data.replies.map((r) => (
            <li key={r.id}>
              <Card className="bg-[var(--success-surface)] text-[var(--on-success-surface)]">
                <SectionLabel>You said</SectionLabel>
                <p className="m-0 type-caption leading-relaxed opacity-90">{r.body}</p>
                <p className="m-0 mt-2.5 type-body leading-relaxed">
                  <strong>{r.repliedBy || 'The owner'}</strong> replied — {r.reply}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {data.rounds.map((r) => (
          <li key={r.code}>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <span className="type-caption font-bold">
                  {r.code} <span className="font-normal text-[var(--text-muted)]">· {r.placedAt}</span>
                </span>
                <Pill tone={r.tone as Tone}>{r.statusWord}</Pill>
              </div>

              {/* WHERE IT HAS GOT TO (screen 7 of the design set).
                  The pill above says the state in one word; the timeline says the journey, which
                  is what stops somebody walking over to ask. The pill stays: it is what the round
                  is, glanceable, and the round list is scanned before it is read. */}
              <RoundTimeline round={r} />

              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {r.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2.5">
                    <FoodMark type={i.foodType} />
                    <span className="min-w-0 flex-1 truncate type-body">{i.name}</span>
                    <span className="type-caption tabular-nums text-[var(--text-muted)]">×{i.qty}</span>
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
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full type-h3 leading-none transition-colors hover:bg-[var(--primary-surface)] disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
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
            <p className="m-0 rounded-[var(--radius-md)] bg-[var(--primary-surface)] px-3 py-2 text-center type-caption font-semibold text-[var(--on-primary-surface)]">
              {data.captain ? `${data.captain} is bringing your bill` : 'Your bill is on its way'} ·{' '}
              {data.payableLabel}
            </p>
            {/* THE BIG ONE, and deliberately above "Carry on to pay".
                A table that decides on one more round after asking for the bill should not have
                to work out that the way to order is to CANCEL something first. The mental model
                is "I want to add something → Continue Ordering"; the payment request is the
                application's problem, not theirs, and it is withdrawn quietly on the way past. */}
            <Button data-testid="guest-continue-ordering" size="lg" onClick={continueOrdering} disabled={busy}>
              ＋ Continue Ordering
            </Button>
            <Button data-testid="guest-continue-closure" variant="secondary" onClick={() => go('upsell')}>
              Carry on to pay
            </Button>
            <Button
              data-testid="guest-cancel-payment-request"
              variant="ghost"
              onClick={cancelRequest}
              disabled={busy}
            >
              Cancel payment request
            </Button>
          </>
        ) : (
          <>
            {data.paymentPaused ? (
              <p
                data-testid="guest-payment-paused"
                className="m-0 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2 text-center type-caption font-semibold text-[var(--text-muted)]"
              >
                Payment request paused. You can continue ordering.
              </p>
            ) : null}
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
