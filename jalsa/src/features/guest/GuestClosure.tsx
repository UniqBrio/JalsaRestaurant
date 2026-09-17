'use client';

import * as React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { Card, Chip, FoodMark, Pill, SectionLabel, Skeleton } from '@/components/ui/atoms';
import { Input } from '@/components/ui/field';
import { TotalsBlock } from '@/components/ui/bill';
import { SuccessNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import { parseCustomTip } from '@/lib/write-echo';
import type { GuestMenuItem } from '@/lib/db/guest-view';
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

type UpsellTab = 'desserts' | 'beverages' | 'share';

/** What each tab offers, drawn from the LIVE menu by category — never a typed list of dishes. */
const UPSELL_TABS: Array<{
  key: UpsellTab;
  emoji: string;
  label: string;
  heading: string;
  sub: string;
  /** Categories in the order they should be drawn from. */
  from: string[];
  /** Whether these are meant to leave the building. */
  packed: boolean;
}> = [
  {
    key: 'desserts',
    emoji: '🍰',
    label: 'Desserts',
    heading: 'Something sweet?',
    sub: 'Straight from the kitchen, while you settle up.',
    from: ['Desserts'],
    packed: false,
  },
  {
    key: 'beverages',
    emoji: '🥤',
    label: 'Beverages',
    heading: 'Something refreshing?',
    // "Beverages" is this screen's word for the menu's "Drinks" category. A label, not a rename.
    sub: 'Cold, quick, and on the same bill.',
    from: ['Drinks'],
    packed: false,
  },
  {
    key: 'share',
    emoji: '❤️',
    label: 'Share the Love',
    heading: 'Share the Love ❤️',
    sub: 'Let them enjoy what you loved.',
    // Curated, not the whole menu: the things worth carrying home, in the order they are worth it.
    from: ['Biryani', 'Combo', 'Indian Curry', 'Desserts'],
    packed: true,
  },
];

const OFFERS_PER_TAB = 4;

/* ── 9. One last thing — the three-way upsell ──────────────────────────── */

export function UpsellScreen(props: GuestScreenProps) {
  const { data, go, send, busy } = props;
  const toast = useToast();
  const [tab, setTab] = React.useState<UpsellTab>('desserts');
  const [adding, setAdding] = React.useState<string | null>(null);

  /* "Share the Love" is an offer to parcel food, so it is shown only where the owner has that
     switch on. A tab that cannot be honoured is worse than a missing one (Standard 2.4). */
  const tabs = React.useMemo(
    () => UPSELL_TABS.filter((t) => t.key !== 'share' || data.features.takeaway),
    [data.features.takeaway]
  );

  const offersFor = React.useCallback(
    (key: UpsellTab): GuestMenuItem[] => {
      const spec = UPSELL_TABS.find((t) => t.key === key);
      if (!spec) return [];
      const picked: GuestMenuItem[] = [];
      for (const category of spec.from) {
        for (const m of data.menu) {
          if (picked.length >= OFFERS_PER_TAB) break;
          if (m.available && m.category === category) picked.push(m);
        }
      }
      return picked;
    },
    [data.menu]
  );

  const anything = tabs.some((t) => offersFor(t.key).length > 0);
  if (!data.features.upsell || !anything) {
    // Nothing to offer is not a screen. Standard 5.6: withhold the step rather than showing an
    // empty version of it.
    return <TipScreen {...props} openSheet={() => {}} />;
  }

  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  if (!active) return <TipScreen {...props} openSheet={() => {}} />;
  const offers = offersFor(active.key);

  /**
   * Add, and STAY.
   *
   * The screen this replaced sent the guest to the tip step the instant they added one thing,
   * so "a dessert, then a drink, then something for home" was impossible — there was no second
   * tap to be had. Now the round is placed, the total moves, and the guest is still here.
   * `runBusy` is not used: it freezes every + on the screen, and the one thing this screen must
   * not do is make the next add wait for the last one.
   */
  const add = (item: GuestMenuItem) => {
    if (adding) return;
    setAdding(item.id);
    void send('/api/guest/cart', { itemId: item.id, qty: 1 })
      .then(() => send<{ kotCode: string }>('/api/guest/round', {}))
      .then(() => {
        toast.show(`${item.name} — added ✓`, { tone: 'success' });
      })
      .catch((err: unknown) => {
        toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' });
      })
      .finally(() => setAdding(null));
  };

  return (
    <div className="flex flex-col gap-4 pt-2" data-testid="guest-upsell">
      <SuccessNotice testId="guest-upsell-confirm">
        {data.captain ? `${data.captain} is bringing your bill.` : 'Your bill is on its way.'} It comes to{' '}
        <strong>{data.payableLabel}</strong> including GST.
      </SuccessNotice>

      <div>
        <h2 className="type-h3">One last thing?</h2>
        <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]">
          Your bill is ready. Add a little something before you pay.
        </p>
      </div>

      {/* Three at once, on one row, in one grid. Not a scrolling strip and not a carousel: an
          option a guest has to swipe to discover is an option most of them never see, and the
          third one here is the one the restaurant most wants seen. */}
      <div
        role="tablist"
        aria-label="What else?"
        data-testid="guest-upsell-tabs"
        className="grid gap-1.5 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)] p-1.5"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
          const on = t.key === active.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid={`guest-upsell-tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] px-1 type-caption font-semibold leading-tight transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                on
                  ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-body)]'
              )}
            >
              <span aria-hidden className="type-button leading-none">
                {t.emoji}
              </span>
              <span className="text-center">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div>
        <h3 className="m-0 type-body font-semibold">{active.heading}</h3>
        <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]">{active.sub}</p>
      </div>

      {offers.length === 0 ? (
        <p data-testid="guest-upsell-empty" className="m-0 type-caption text-[var(--text-muted)]">
          Nothing here tonight — try the other {tabs.length === 3 ? 'two' : 'one'}.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid={`guest-upsell-list-${active.key}`}>
          {offers.map((o) => (
            <li key={o.id}>
              <Card className="flex items-center gap-3 p-3">
                {/* The space a photograph will occupy — the same tile the menu rows hold open. */}
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-disabled)]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="4" width="18" height="16" rx="2.5" />
                    <circle cx="8.5" cy="9.5" r="1.6" />
                    <path d="M3.5 17l4.8-4.8a1.6 1.6 0 0 1 2.3 0L15 16.5l1.9-1.9a1.6 1.6 0 0 1 2.3 0l1.3 1.3" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <FoodMark type={o.foodType} />
                    <span className="min-w-0 truncate type-body font-semibold">{o.name}</span>
                  </span>
                  <span className="mt-0.5 block type-caption leading-snug text-[var(--text-muted)]">
                    {o.description}
                  </span>
                  {active.packed ? (
                    <span className="mt-1 inline-block">
                      <Pill tone="neutral">Packed for home</Pill>
                    </span>
                  ) : null}
                </span>
                <span className="type-body font-bold tabular-nums">{o.priceLabel}</span>
                <Button
                  data-testid={`guest-upsell-add-${o.id}`}
                  size="icon"
                  onClick={() => add(o)}
                  disabled={adding !== null}
                  aria-label={`Add ${o.name}`}
                >
                  {adding === o.id ? '·' : '+'}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/*
        TWO STACKED FULL-WIDTH BUTTONS — THE SHAPE, NOT JUST THE LABELS, IS THE CHANGE.

        What this replaced was a `size="lg"` pay button above a `flex items-center gap-2` row
        holding a `flex-1` secondary button beside an unconstrained ghost one. That row had no
        wrap rule, so its width was the sum of its contents and "No thanks, continue to payment"
        set the floor: there is no viewport narrow enough for it to be safe and none wide enough
        to make it right. It is the JP-22 shape, and a column cannot overflow sideways at all.

        `ActionBar` is already `flex flex-col`, whose children stretch, so both buttons are full
        width at every width without one measurement between them — the same bar `guest-tip-bar`
        eight lines down has always used.

        THE LOUD ACTION IS ORDERING AGAIN, AND THE SCREEN NOW AGREES WITH ITSELF
        This screen exists to offer one more thing. Its biggest button used to be the way out of
        it. The live payable has not left the screen: it is in `guest-upsell-confirm` at the top,
        re-rendered from the same write echo the button label used to carry.

        THE ROUTE TO PAYMENT SURVIVES, ONCE INSTEAD OF TWICE (Standard 1.6, never a dead end)
        Both removed buttons did the identical thing — `go('tip')`. The tip step still ends in
        Pay, and its first chip is "No tip", so the guest who wants to settle up and leave is one
        tap further on than before and is never asked to tip to get there.
      */}
      <ActionBar testId="guest-upsell-bar">
        {/* The tabs above are the curated shortcut; this is "show me everything". It pauses the
            payment request on the way past — the guest never has to cancel anything to order
            again. The write and its notice are unchanged; only the label and the weight moved. */}
        <Button
          data-testid="guest-upsell-continue-ordering"
          size="lg"
          disabled={busy}
          onClick={() =>
            props.runBusy(async () => {
              await send('/api/guest/bill', { action: 'resume-ordering' });
              toast.show('Payment request paused. Order away.', { tone: 'success' });
              go('menu');
            })
          }
        >
          Continue ordering
        </Button>
        <Button
          data-testid="guest-upsell-tip"
          variant="secondary"
          disabled={busy}
          onClick={() => go('tip')}
        >
          Add a tip
        </Button>
      </ActionBar>
    </div>
  );
}

/* ── 10. Tip ───────────────────────────────────────────────────────────── */

export function TipScreen(props: GuestScreenProps) {
  const { data, go, send, busy } = props;
  const toast = useToast();
  const [chosen, setChosen] = React.useState<number>(data.tipChosen);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [problem, setProblem] = React.useState<string | null>(null);

  const presets = data.tipOptions;
  /* A tip that is not one of the presets is a custom one — including one the guest set on an
     earlier visit to this screen. Derived from the DATA rather than remembered in a flag, so
     leaving the screen and coming back shows the same thing the bill says. */
  const custom = chosen > 0 && !presets.includes(chosen) ? chosen : null;

  /**
   * Writing the tip, WITHOUT freezing the screen.
   *
   * Deliberately not `runBusy`. Setting a tip is idempotent and last-write-wins: tapping +₹10
   * then +₹20 must leave ₹20 on the bill, and it does, because each tap sends the absolute
   * amount rather than a delta. Blocking the row until the write lands bought nothing and cost
   * the guest a frozen screen for the whole round trip — which, with the route now answering
   * with the new state, is one trip rather than three.
   */
  const choose = (amount: number) => {
    setChosen(amount);
    setProblem(null);
    void send('/api/guest/bill', { action: 'tip', amount }).catch((err: unknown) => {
      toast.show(err instanceof Error ? err.message : 'That tip did not go through.', { tone: 'error' });
      setChosen(data.tipChosen);
    });
  };

  const openCustom = () => {
    setDraft(custom ? String(custom) : '');
    setProblem(null);
    setEditing(true);
  };

  const applyCustom = () => {
    // The reading of the field lives in src/lib/write-echo.ts, where it can be tested without a
    // browser. This function does what the reading says, and nothing else.
    const entry = parseCustomTip(draft);
    if (!entry.ok) {
      setProblem(entry.problem);
      return;
    }
    setEditing(false);
    setProblem(null);
    choose(entry.amount);
  };

  if (!data.features.tip) {
    return <PayingGate {...props} />;
  }

  return (
    <div className="flex flex-col gap-4 pt-2" data-testid="guest-tip">
      <div>
        <h2 className="type-h3">
          {(data.copy.tipPrompt ?? 'Add a tip for {captain}?').replace('{captain}', data.captain || 'the team')}
        </h2>
        <p className="m-0 mt-0.5 type-caption leading-relaxed text-[var(--text-muted)]">
          Goes to {data.captain ? `${data.captain} and ` : ''}the floor team, tracked apart from the
          restaurant&rsquo;s own takings.
        </p>
      </div>

      {/* Five options on one row, and the fifth is a door rather than an amount. A permanent
          input would put a keyboard between the guest and the bill for the 90% who tap a preset;
          five more preset buttons would be five more decisions for the 10% who do not. One tap
          for a common tip, one tap and a number for any other. */}
      <div className="flex gap-2">
        {presets.map((t) => (
          <Chip
            key={t}
            on={chosen === t}
            className="flex-1"
            onClick={() => {
              setEditing(false);
              choose(t);
            }}
            data-testid={`guest-tip-${t}`}
          >
            {t === 0 ? 'No tip' : `+ ${rupees(t)}`}
          </Chip>
        ))}
        <Chip on={custom !== null} className="flex-1" onClick={openCustom} data-testid="guest-tip-custom">
          {custom !== null ? `✓ ${rupees(custom)}` : 'Custom'}
        </Chip>
      </div>

      {editing ? (
        <div data-testid="guest-tip-custom-panel" className="flex flex-col gap-1.5">
          <label htmlFor="guest-tip-custom-input" className="type-caption font-semibold">
            Custom tip
          </label>
          <div className="flex items-start gap-2">
            <div className="relative flex-1">
              <span
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 type-body font-semibold text-[var(--text-muted)]"
              >
                ₹
              </span>
              <Input
                id="guest-tip-custom-input"
                data-testid="guest-tip-custom-input"
                // A phone keyboard with letters on it is a keyboard the guest has to get past.
                inputMode="numeric"
                type="text"
                autoFocus
                value={draft}
                maxLength={6}
                aria-label="Custom tip amount in rupees"
                {...(problem ? { 'aria-invalid': true } : {})}
                onChange={(e) => {
                  // Filtered at the keystroke, not judged at Apply: a character that can never
                  // be valid should never appear in the field in the first place.
                  setDraft(e.target.value.replace(/\D/g, ''));
                  setProblem(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCustom();
                  }
                }}
                className="pl-8"
              />
            </div>
            <Button data-testid="guest-tip-custom-apply" onClick={applyCustom} className="shrink-0">
              Apply
            </Button>
          </div>
          {problem ? (
            <p data-testid="guest-tip-custom-problem" className="m-0 type-caption text-[var(--error)]" role="alert">
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}

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
        <h2 className="type-h2">Waiting for your bank</h2>
        <p className="m-0 mt-1 type-body text-[var(--text-muted)]">
          Approve the request in your UPI app. This page updates itself.
        </p>
      </div>
      <p className="m-0 max-w-[24em] rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]">
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
        <p className="m-0 mb-3 type-caption leading-relaxed text-[var(--text-muted)]">
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
        /* INTENTIONAL EXCEPTION — a glyph sized to its 64px circle, not to the reading
           scale. See the exception list in scripts/check-typography.mjs. */
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--error-surface)] text-[26px] font-bold text-[var(--on-error-surface)]"
      >
        !
      </span>
      <div>
        <h2 className="type-h2">That payment did not go through</h2>
        <p className="m-0 mt-1 max-w-[26em] type-body leading-relaxed text-[var(--text-muted)]">
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

  /* The last dish that actually reached the table, priced from the live menu rather than from
     the bill line — a parcel is a NEW order at today's price, and quoting the historic one
     would under- or over-charge by exactly the amount the menu moved. */
  const lovedDish = React.useMemo(() => {
    const served = data.rounds.flatMap((r) => r.items).filter((i) => i.servable);
    const last = served[served.length - 1];
    if (!last) return null;
    const onMenu = data.menu.find((m) => m.name === last.name && m.available);
    return { name: last.name, priceLabel: onMenu?.priceLabel ?? '' };
  }, [data.rounds, data.menu]);

  return (
    <div className="flex flex-col items-center gap-5 pt-8 text-center" data-testid="guest-paid">
      <span
        aria-hidden
        /* INTENTIONAL EXCEPTION — a glyph sized to its 64px circle, not to the reading
           scale. See the exception list in scripts/check-typography.mjs. */
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-surface)] text-[26px]"
      >
        ✓
      </span>

      <div>
        <h2 className="type-h2">
          {settled ? `${data.copy.paidHeading ?? 'Paid'} · ${data.payableLabel}` : 'Thank you'}
        </h2>
        <p className="m-0 mt-1 max-w-[26em] type-body leading-relaxed text-[var(--text-muted)]">
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

      {/* "Take the one you loved home" — the design set's parcel card, on the screen where the
          meal is over and the guest is still at the table. It offers a dish from THIS bill: the
          heart on the order list is component state and is gone by now, so "the one you loved"
          cannot be recovered, and inventing a favourite would be a guess presented as memory.
          The last thing served is the honest stand-in — it is the taste still in their mouth.
          Gated on `takeaway`, the same switch the Share the Love upsell tab answers to: an
          offer the kitchen cannot honour is worse than no offer (Standard 2.4). */}
      {data.features.takeaway && lovedDish ? (
        <Card className="w-full text-left" data-testid="guest-loved-card">
          <SectionLabel>Take the one you loved home</SectionLabel>
          <p className="m-0 mb-3 type-body">
            <span className="font-semibold">{lovedDish.name}</span> · parcel
            {lovedDish.priceLabel ? (
              <span className="block type-caption text-[var(--text-muted)]">
                {lovedDish.priceLabel} · billed separately as a takeaway
              </span>
            ) : null}
          </p>
          <Button
            data-testid="guest-loved-add"
            disabled={busy}
            onClick={() =>
              runBusy(async () => {
                await send('/api/guest/ask', { kind: 'Parcel a favourite', note: lovedDish.name });
                toast.show(`${lovedDish.name} parcel asked for — billed separately as a takeaway`, {
                  tone: 'success',
                });
              })
            }
          >
            Add a parcel
          </Button>
        </Card>
      ) : null}

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
          <p className="m-0 mb-3 type-caption leading-relaxed text-[var(--text-muted)]">
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
  const toast = useToast();
  const lines = data.rounds.flatMap((r) => r.items.map((i) => ({ ...i, code: r.code })));

  return (
    <div className="flex flex-col gap-4 pb-6" data-testid="guest-invoice">
      {/* The badge heads the bill, as it does on the design set's invoice artboard and on every
          printed document. It is the same authoritative mark as the root page — see the note in
          src/app/page.tsx — and it carries its own maroon field, so it needs no theme pair. */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/brand/jalsa-badge.png"
          alt=""
          aria-hidden
          width={44}
          height={44}
          className="mb-2 rounded-[var(--radius-md)]"
        />
        <h2 className="type-h3">{data.restaurantName}</h2>
        <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]">
          Table {data.table.name} · {data.billCode ?? '—'}
          {data.paidAt ? ` · ${data.paidAt}` : ''}
          {data.captain ? ` · ${data.captain}` : ''}
        </p>
      </div>

      <Card>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-2.5 type-caption">
              <FoodMark type={l.foodType} size={11} />
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="shrink-0 tabular-nums text-[var(--text-muted)]">×{l.qty}</span>
              {/* The amount. Without it this screen could be read but not CHECKED, which is the
                  one thing a guest opens a bill to do. */}
              <span className="w-[4.5rem] shrink-0 text-right tabular-nums font-semibold">{l.lineLabel}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <TotalsBlock rows={data.totals} testId="guest-invoice-totals" />
        </div>
      </Card>

      <p className="m-0 px-1 type-caption leading-relaxed text-[var(--text-muted)]">
        GST is charged at {data.taxRate}% and shown as its own line. A tip is not restaurant income and is paid to the
        floor team in full.
      </p>

      {/* The design puts Send to WhatsApp and Back under the invoice. Back is already the
          header's ‹ on this phase (backTarget: invoice -> paid), and a second one would be a
          second idiom for the same move, so only the send action is added here. The string is
          the one PaidScreen already ships — the freeze rule: a new surface adopts the existing
          words rather than inventing a synonym. */}
      {data.features.whatsapp ? (
        <Button
          data-testid="guest-invoice-whatsapp"
          variant="secondary"
          onClick={() => toast.show('Ask your captain for the bill on WhatsApp — the provider is not connected yet.')}
        >
          Send the bill to WhatsApp
        </Button>
      ) : null}
    </div>
  );
}
