'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { guestSteps, type Tone } from '@/lib/status';
import type { GuestRound } from '@/lib/db/guest-view';
import {
  cravingRoute as routeOf,
  orderTargets,
  phaseForRound,
  shouldOfferCraving,
  type CravingPhase,
} from '@/lib/craving';
import { CravingGame } from './CravingGame';
import { HeardPrompt } from './HeardPrompt';
import { shownLoved } from '@/lib/favourites';
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

/**
 * Catch Your Craving on the order-placed screen (03-Oct-2026).
 *
 * WHY HERE AND NOT ON "SEE MY ORDER"
 *   It used to sit at the foot of the order list, offered for whichever round was furthest
 *   along (`activeCravingRound`) - so it was about "the table's wait", not about the order the
 *   guest had just sent, and it shared a screen whose job is status. The owner moved it: the
 *   game is part of placing an order, and "See my order" is for the order.
 *
 * WHICH ROUND
 *   `placedCode` - the code the kitchen answered THIS phone's Send with. Not "the last round":
 *   another phone at the table may send one a second later, and the game must not jump to food
 *   this guest did not order. With no such round (a reload, everything sold out) there is no
 *   game, rather than a game about something else.
 */
function PlacedCraving({
  data,
  placedCode,
  cravingDismissed,
  dismissCraving,
  cravingPlays,
  setCravingPlays,
  qtyOf,
  setCartQty,
}: GuestScreenProps) {
  const toast = useToast();
  const round = placedCode ? data.rounds.find((r) => r.code === placedCode) : undefined;
  const targets = React.useMemo(() => (round ? orderTargets(round.items) : []), [round]);
  const route = round ? routeOf(round.items.map((i) => i.foodType)) : null;
  /* This screen's own phase, for one round. Local, so leaving mid-game and coming back lands on
     the offer rather than in a game that started itself; only a dismissal is kept above. */
  const [local, setLocal] = React.useState<{ code: string; phase: CravingPhase } | null>(null);
  const phase = round ? phaseForRound(round.code, cravingDismissed, local) : 'offer';
  /* STABLE across live-data refreshes, because the game's timer effect depends on it - a new
     function per poll would restart the 24 s stop. The round is fixed by `placedCode`. */
  const setPhase = React.useCallback(
    (next: CravingPhase) => {
      if (!placedCode) return;
      if (next === 'dismissed') dismissCraving(placedCode);
      setLocal({ code: placedCode, phase: next });
    },
    [dismissCraving, placedCode]
  );
  // Round lines carry the KOT line's id, not the dish's, so "already ordered" is matched by name.
  const orderedNames = new Set(data.rounds.flatMap((r) => r.items.map((i) => i.name)));
  const orderedIds = data.menu.filter((m) => orderedNames.has(m.name)).map((m) => m.id);
  const addSuggestion = (itemId: string) => {
    const item = data.menu.find((m) => m.id === itemId);
    if (!item) return;
    // The ordinary cart path - the same one the menu's + button takes.
    setCartQty(itemId, qtyOf(item) + 1);
    // Said, because nothing else on this screen shows a cart: without it the tap looked like
    // nothing, or like an order. The menu's own words, and the cart's.
    toast.show(`${item.name} added · nothing sent to the kitchen yet`);
  };

  if (!round || !route || targets.length === 0) return null;
  if (!shouldOfferCraving({ enabled: data.features.craving, hasWaitingRound: true, plays: cravingPlays, phase })) {
    return null;
  }
  return (
    <CravingGame
      key={round.code}
      route={route}
      targets={targets}
      menu={data.menu}
      orderedIds={orderedIds}
      phase={phase}
      setPhase={setPhase}
      plays={cravingPlays}
      setPlays={setCravingPlays}
      onAdd={addSuggestion}
    />
  );
}

export function PlacedScreen(props: GuestScreenProps) {
  const { data, go, placedCode } = props;
  const last = (placedCode ? data.rounds.find((r) => r.code === placedCode) : undefined) ?? data.rounds[data.rounds.length - 1];
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

      {/* Below the order it is about, so the confirmation is read first. Always skippable; the
          owner can switch it off (features.craving). */}
      <PlacedCraving {...props} />

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
  joinedLate,
}: GuestScreenProps) {
  const toast = useToast();
  /*
   * THE HEART IS KEPT (03-Oct-2026). It was `useState` here and nothing else - no route, no
   * table, no payload field - so a trip to the menu, a new round, a reload or a second phone
   * reset every heart. Now the server's `lovedItemIds` (guest_favourite, per party and dish) is
   * the truth; `pendingLove` is only the answer the phone is waiting for, shown at once and
   * dropped when the write answers - on failure too, so a heart that was not saved never stays
   * filled.
   */
  const [pendingLove, setPendingLove] = React.useState<Record<string, boolean>>({});
  const toggleLove = async (menuItemId: string, name: string) => {
    if (menuItemId in pendingLove) return;
    const next = !shownLoved(menuItemId, data.lovedItemIds, pendingLove);
    setPendingLove((cur) => ({ ...cur, [menuItemId]: next }));
    try {
      await send('/api/guest/favourite', { menuItemId, loved: next });
      // The parcel offer, as before - now only once the heart is actually kept.
      if (next && data.features.takeaway) openSheet('loved', name);
    } catch (err) {
      /* The server's own sentence when it gave one - it already says what to do next. A fetch
         that never reached it throws a TypeError whose text is the browser's ("Failed to
         fetch"), never shown to a guest (copy review, 03-Oct-2026). */
      toast.show(
        err instanceof Error && !(err instanceof TypeError)
          ? err.message
          : `Your heart on ${name} was not saved. Check your connection, then tap it again.`,
        { tone: 'error' }
      );
    } finally {
      setPendingLove((cur) => {
        const rest = { ...cur };
        delete rest[menuItemId];
        return rest;
      });
    }
  };
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
                    {data.features.heart ? (() => {
                      const loved = shownLoved(i.menuItemId, data.lovedItemIds, pendingLove);
                      const saving = !!i.menuItemId && i.menuItemId in pendingLove;
                      return (
                        <button
                          data-testid={`guest-heart-${i.id}`}
                          type="button"
                          disabled={!i.servable || !i.menuItemId}
                          aria-pressed={loved}
                          aria-busy={saving}
                          aria-label={i.servable ? `I loved the ${i.name}` : `${i.name} is not on your table yet`}
                          onClick={() => {
                            if (i.menuItemId) void toggleLove(i.menuItemId, i.name);
                          }}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full type-h3 leading-none transition-colors hover:bg-[var(--primary-surface)] disabled:opacity-30 aria-busy:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                        >
                          <span className={loved ? 'text-[var(--primary)]' : 'text-[var(--text-disabled)]'}>
                            {loved ? '♥' : '♡'}
                          </span>
                        </button>
                      );
                    })() : null}
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>

      {/* Asked once of a phone that never saw the welcome screen (02-Oct-2026). */}
      {joinedLate && !data.heardAbout && !data.heardDismissed ? <HeardPrompt data={data} send={send} /> : null}

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
