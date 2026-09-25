'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '@/lib/cn';
import { ACTION_BAR_STACK } from '@/lib/action-bar';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { OfflineBanner, PartialNotice } from '@/components/ui/states';
import type { GuestPayload } from '@/lib/db/guest-view';
import { useLiveData } from '@/hooks/useLiveData';
import { draftedCount, effectiveQty, withDraft, withoutDraft, type CartDraft } from '@/lib/cart-draft';
import { WelcomeScreen, MenuScreen, CartScreen } from './GuestOrdering';
import { PlacedScreen, StatusScreen } from './GuestProgress';
import { UpsellScreen, TipScreen, PayingScreen, FailedScreen, PaidScreen, InvoiceScreen } from './GuestClosure';
import { GuestSheets, type SheetKind } from './GuestSheets';
import { factsOf, reconcilePhase, startingPhase, type Phase } from './phase';

/**
 * GuestApp — the eleven screens of the guest journey, and the seven sheets behind them.
 *
 * WHY ONE COMPONENT HOLDS THE JOURNEY RATHER THAN ELEVEN ROUTES
 *   The journey is one straight line with three places to leave it and come back, on one bill,
 *   on a phone that must survive a locked screen and a dead spot. As routes, every step would
 *   be a navigation that can fail mid-order and a back button that means something different at
 *   each stop. As one screen with a phase, "where was I" is answered by the SERVER on the next
 *   poll — which is exactly the resumability the design set asks for (Standard 6.5).
 *
 * ONE DECISION PER SCREEN, on the customer path. Every tap that is not ordering, paying or
 * tipping is a tap the design removed, and this component keeps it removed: there is a single
 * primary action pinned at the bottom of each phase, and everything optional lives behind ⋯.
 */

/* Re-exported so the screen files keep importing their prop types from one place. The rule that
 * decides a phase lives in ./phase, which has no React in it and can therefore be tested. */
export type { Phase };

export interface GuestScreenProps {
  data: GuestPayload;
  go: (phase: Phase) => void;
  openSheet: (kind: SheetKind, arg?: string) => void;
  send: <T>(path: string, payload: unknown) => Promise<T>;
  busy: boolean;
  runBusy: (fn: () => Promise<void>) => void;
  /** Whether this phone is currently showing the order total. See TotalReveal. */
  showTotal: boolean;
  setShowTotal: (v: boolean) => void;
  /** What to show for one row right now — the phone's own intention until the server confirms. */
  qtyOf: (item: { id: string; inCart: number }) => number;
  /** Change a quantity. Returns immediately; the write follows. */
  setCartQty: (itemId: string, qty: number) => void;
  /** Items in the cart, counting anything not yet confirmed. */
  cartCount: number;
  /** Await before anything that reads the STORED cart — Send to the kitchen, above all. */
  flushCart: () => Promise<void>;
}

export function GuestApp({ table, initial }: { table: string; initial: GuestPayload }) {
  const { data, staleReason, send } = useLiveData<GuestPayload>(
    `/api/guest/state?table=${encodeURIComponent(table)}`,
    initial,
    6000,
    // Ask "changed?" every 6 s; read in full at least every 5 minutes, for what moves with the
    // clock alone — the receipt giving way to the welcome screen (change-check.ts).
    { fullEveryMs: 5 * 60_000 }
  );
  const toast = useToast();

  const [phase, setPhase] = React.useState<Phase>(() => startingPhase(factsOf(initial)));
  const [sheet, setSheet] = React.useState<{ kind: SheetKind; arg?: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  /** The measured height of whichever fixed bar is on screen. See `BottomBarSpace`. */
  const [barSpace, setBarSpace] = React.useState<number | null>(null);

  /**
   * Whether the running total is on screen — the guest's own choice, seeded from the owner's.
   *
   * The owner's switch is a DEFAULT, not a lock: `features.orderTotal` decides what the phone
   * shows before anyone touches anything, and the tick box in the bottom bar decides it after.
   * A guest is never refused the figure they are about to be charged; they are only spared it
   * until they ask. Held here rather than in each screen so walking menu -> order -> menu does
   * not silently re-hide a total the guest switched on.
   */
  const [showTotal, setShowTotal] = React.useState(() => initial.features.orderTotal);

  /**
   * WHAT THE PHONE BELIEVES IS IN THE CART, before the server has confirmed it.
   *
   * The menu screen used to be a pure function of the server payload, so a tap changed nothing
   * on screen until a round trip to another region completed — and `runBusy` disabled all
   * fifty-seven rows while it waited, SILENTLY DROPPING any tap made in the meantime. That is
   * the whole of "for adding an item, it is taking time" (12-Sep-2026): the number under the
   * guest's thumb was the last thing to move, and some of their taps were never anywhere.
   *
   * The draft is an overlay, never a source. It is dropped the moment the write answers — on
   * failure too, so a row that could not be saved snaps back to the truth rather than leaving
   * a phantom item on someone's bill.
   */
  const [draft, setDraft] = React.useState<CartDraft>({});
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    };
  }, []);

  /**
   * The server decides the phase whenever it knows better than the phone does.
   *
   * A guest who reopens the link mid-service must land where their bill actually is, not where
   * this tab last was — that is the difference between "restored" and "a stale page that looks
   * restored". The phone keeps control only of the steps the server cannot see: which closure
   * step they are on.
   *
   * Adjusted DURING RENDER rather than in an effect. React re-runs this component before it
   * paints, so the guest never sees the old screen flash; an effect would commit the wrong phase
   * first and correct it a frame later, which on a slow handset is visible.
   */
  const serverKey = `${data.phase}|${data.billStatus ?? ''}|${data.rounds.length}`;
  const [lastServerKey, setLastServerKey] = React.useState(serverKey);
  if (lastServerKey !== serverKey) {
    setLastServerKey(serverKey);
    setPhase(reconcilePhase(phase, factsOf(data)));
  }

  const runBusy = React.useCallback(
    (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      void fn()
        .catch((err: unknown) => {
          toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' });
        })
        .finally(() => setBusy(false));
    },
    [busy, toast]
  );

  /** Writes that have left, so anything needing the server to be up to date can wait for them. */
  const inFlight = React.useRef(new Set<Promise<void>>());
  /** Quantities chosen but not yet sent, keyed by item — one entry per row, the latest wins. */
  const unsent = React.useRef(new Map<string, number>());

  const commit = React.useCallback(
    (itemId: string, qty: number): Promise<void> => {
      const p = send('/api/guest/cart', { itemId, qty })
        .catch((err: unknown) => {
          // Back to what the server says, and say why. A draft that outlived its failed write is
          // an item the guest never ordered sitting on their bill.
          toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' });
        })
        .then(() => {
          setDraft((d) => withoutDraft(d, itemId));
          inFlight.current.delete(p);
        });
      inFlight.current.add(p);
      return p;
    },
    [send, toast]
  );

  /**
   * One tap: the screen moves now, the write goes a moment later.
   *
   * The short delay is not a throttle, it is a COLLAPSE — three taps of + become one request for
   * three rather than three requests racing each other to decide the same row. Deliberately not
   * `runBusy`: blocking the screen for the duration is the defect, and each write carries the
   * absolute quantity, so the last one to arrive is simply right.
   */
  const setCartQty = React.useCallback(
    (itemId: string, qty: number) => {
      const next = Math.max(0, Math.floor(qty));
      setDraft((d) => withDraft(d, itemId, next));
      unsent.current.set(itemId, next);

      const running = timers.current.get(itemId);
      if (running) clearTimeout(running);
      timers.current.set(
        itemId,
        setTimeout(() => {
          timers.current.delete(itemId);
          unsent.current.delete(itemId);
          void commit(itemId, next);
        }, 200)
      );
    },
    [commit]
  );

  /**
   * Everything the phone has decided, on the server, before we go on.
   *
   * The collapse above buys responsiveness at the cost of a window where the screen is ahead of
   * the database — and "Send to the kitchen" reads the CART FROM THE SERVER. Without this, the
   * dish tapped a moment before Send would not be in the round: the guest would watch it vanish
   * and be right to be angry. Awaited before anything that acts on the stored cart.
   */
  const flushCart = React.useCallback(async (): Promise<void> => {
    const sending: Array<Promise<void>> = [];
    for (const [itemId, qty] of unsent.current) {
      const running = timers.current.get(itemId);
      if (running) clearTimeout(running);
      timers.current.delete(itemId);
      sending.push(commit(itemId, qty));
    }
    unsent.current.clear();
    await Promise.all([...inFlight.current, ...sending]);
  }, [commit]);

  const qtyOf = React.useCallback(
    (item: { id: string; inCart: number }) => effectiveQty(draft, item.id, item.inCart),
    [draft]
  );

  const shared: GuestScreenProps = {
    data,
    go: setPhase,
    openSheet: (kind, arg) => setSheet(arg === undefined ? { kind } : { kind, arg }),
    send,
    busy,
    runBusy,
    showTotal,
    setShowTotal,
    qtyOf,
    setCartQty,
    cartCount: draftedCount(draft, data.menu),
    flushCart,
  };

  if (data.phase === 'table_inactive') {
    return <TableInactive table={data.table.name} callNumber={data.callNumber} />;
  }

  const back = backTarget(phase);

  return (
    <BottomBarSpace.Provider value={setBarSpace}>
    <div
      className="mx-auto flex min-h-dvh w-full flex-col"
      style={{ maxWidth: 'var(--layout-guest-max-width)' }}
      data-testid="guest-app"
      data-phase={phase}
    >
      <OfflineBanner />

      {phase !== 'welcome' ? (
        <GuestHeader
          title={headerTitle(phase, data)}
          sub={headerSub(data)}
          onMore={() => setSheet({ kind: 'help' })}
          {...(back ? { onBack: () => setPhase(back) } : {})}
        />
      ) : null}

      <main className="flex-1 px-4 pb-4 pt-3">
        {staleReason ? (
          <PartialNotice testId="guest-stale">
            {staleReason} What you can see below is the last thing we heard — your order is safe on our side.
          </PartialNotice>
        ) : null}

        {phase === 'welcome' ? <WelcomeScreen {...shared} /> : null}
        {phase === 'menu' ? <MenuScreen {...shared} /> : null}
        {phase === 'cart' ? <CartScreen {...shared} /> : null}
        {phase === 'placed' ? <PlacedScreen {...shared} /> : null}
        {phase === 'status' ? <StatusScreen {...shared} /> : null}
        {phase === 'upsell' ? <UpsellScreen {...shared} /> : null}
        {phase === 'tip' ? <TipScreen {...shared} /> : null}
        {phase === 'paying' ? <PayingScreen {...shared} /> : null}
        {phase === 'failed' ? <FailedScreen {...shared} /> : null}
        {phase === 'paid' ? <PaidScreen {...shared} /> : null}
        {phase === 'invoice' ? <InvoiceScreen {...shared} /> : null}
      </main>

      {/* The room the fixed bar needs, held open OUTSIDE `main` so that `main` ends where the
          guest's content ends. `barSpace` is the bar's own measured height; the token is the
          first-paint fallback, and 0 is a screen that has no bar. */}
      <div
        aria-hidden
        data-testid="guest-bottom-bar-space"
        style={{ height: barSpace ?? 'var(--layout-bottom-chrome-clearance)' }}
      />

      <GuestSheets
        sheet={sheet}
        onClose={() => setSheet(null)}
        openSheet={(kind, arg) => setSheet(arg === undefined ? { kind } : { kind, arg })}
        data={data}
        send={send}
        runBusy={runBusy}
        busy={busy}
      />
    </div>
    </BottomBarSpace.Provider>
  );
}

function headerTitle(phase: Phase, data: GuestPayload): string {
  if (phase === 'menu') return data.restaurantName;
  if (phase === 'cart') return 'Your order';
  if (phase === 'invoice') return 'Bill';
  if (phase === 'status') return `Table ${data.table.name}`;
  return data.restaurantName;
}

function headerSub(data: GuestPayload): string {
  const people = [data.captain, data.waiter].filter(Boolean);
  if (data.rounds.length) {
    const rounds = data.rounds.length === 1 ? '1 round' : `${data.rounds.length} rounds`;
    return people.length ? `${rounds} · ${people.join(' and ')}` : rounds;
  }
  if (people.length === 2) return `${people[0]} and ${people[1]} look after this table`;
  if (people.length === 1) return `${people[0]} looks after this table`;
  return `Table ${data.table.name}`;
}

/** Back goes UP the journey, never off it. A phase with no honest parent gets no back button. */
function backTarget(phase: Phase): Phase | null {
  if (phase === 'cart') return 'menu';
  if (phase === 'menu') return 'status';
  if (phase === 'invoice') return 'paid';
  if (phase === 'tip') return 'upsell';
  if (phase === 'upsell') return 'status';
  return null;
}

function GuestHeader({
  title,
  sub,
  onMore,
  onBack,
}: {
  title: string;
  sub: string;
  onMore: () => void;
  onBack?: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--primary)] px-3 py-3 text-[var(--on-primary)]"
      data-testid="guest-header"
    >
      {onBack ? (
        <button
          data-testid="guest-back"
          type="button"
          onClick={onBack}
          aria-label="Back"

          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full type-h3 leading-none transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-primary)]"
        >
          ‹
        </button>
      ) : (
        <span className="w-2" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate type-body font-semibold">{title}</p>
        <p className="m-0 truncate type-caption opacity-85">{sub}</p>
      </div>
      <button
        data-testid="guest-more"
        type="button"
        onClick={onMore}
        aria-label="Ask for something"

        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full type-h3 leading-none transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-primary)]"
      >
        ⋯
      </button>
    </header>
  );
}

/**
 * A code on a table that is not in service.
 *
 * NOT A DEAD END (Standard 1.6). It states the situation, gives the fact needed next, and
 * offers the two things that still work: a person, and a phone number.
 */
function TableInactive({ table, callNumber }: { table: string; callNumber: string }) {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-4 px-6 text-center"
      data-testid="guest-table-inactive"
    >
      <h1 className="type-h2 font-semibold">Table {table} is not in service</h1>
      <p className="m-0 type-body leading-relaxed text-[var(--text-muted)]">
        This code is on a table we are not seating at the moment. Any of the team will move you to one that is — you
        have not lost your place by scanning it.
      </p>
      {callNumber ? (
        <Button data-testid="guest-inactive-call" asChild>
          <a data-testid="guest-inactive-call-link" href={`tel:${callNumber.replace(/\s+/g, '')}`}>
            Call the restaurant
          </a>
        </Button>
      ) : null}
    </main>
  );
}

/** The pinned bottom bar every phase uses for its ONE primary action. */
export function ActionBar({
  children,
  className,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  testId: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | null>(null);

  /**
   * THE SPACER IS THE POINT, AND IT IS MEASURED RATHER THAN GUESSED.
   *
   * The bar is fixed, so it occupies no space in the flow, so whatever the page ends with sits
   * UNDERNEATH it. A constant clearance token used to stand in for the bar's height — and the
   * day a bar grew a second row (Send to the kitchen, then Add something else under it) the
   * constant was fifty pixels short and the order totals vanished behind the button. Reported
   * from a real phone on 12-Sep-2026.
   *
   * A guessed clearance is only ever right for the bar it was measured against; every bar
   * added afterwards is a new chance for it to be wrong, silently, on someone else's screen.
   * The bar's own height cannot be wrong. The token stays as the pre-measurement fallback for
   * the first paint and for anything without a ResizeObserver.
   */
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') {
      setHeight(el.offsetHeight);
      return;
    }
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  /**
   * THE SPACER IS PUBLISHED, NOT RENDERED HERE — AND THAT IS THE WHOLE FIX.
   *
   * It used to be this component's own first child, which put it INSIDE `<main>`, because every
   * bar is called from within a screen. A spacer inside `main` stretches `main`'s box down to
   * the end of the document, so at full scroll `main`'s bottom edge IS the bottom of the
   * viewport — and the fixed bar, by definition, starts one bar-height above that. The content
   * the spacer was meant to protect was therefore still underneath the bar, and the measurement
   * that proves it (`bar.top - main.bottom`) could never come out right, however tall the spacer
   * grew. Making the spacer taller moved both edges together.
   *
   * So the height goes up to the shell, which renders the spacer AFTER `</main>`. `main` now ends
   * where the guest's content ends, the spacer holds open exactly the strip the bar covers, and
   * nothing real is ever behind it — on the runner and on a phone alike.
   */
  const publish = React.useContext(BottomBarSpace);
  React.useEffect(() => {
    publish(height);
    return () => publish(0);
  }, [publish, height]);

  return (
    <div
      ref={ref}
      data-testid={testId}
      className={cn(ACTION_BAR_STACK, className)}
      style={{ maxWidth: 'var(--layout-guest-max-width)' }}
    >
      {children}
    </div>
  );
}

/**
 * How much room the screen must leave below `<main>` for whatever fixed bar is on it.
 *
 * `null` means "no bar has measured itself yet" — the shell falls back to the clearance token for
 * that first paint. `0` means a screen with no bar at all, which must not keep the last screen's
 * gap. The default is a no-op so an ActionBar rendered outside the shell (a test harness, a
 * future surface) still works, it simply reserves nothing.
 */
const BottomBarSpace = React.createContext<(height: number | null) => void>(() => {});

/**
 * TotalReveal — the tick box that decides whether this phone shows the order total, and the
 * total itself when it does.
 *
 * WHY A TICK BOX AND NOT JUST A NUMBER
 *   A table watching a running total climb orders differently from a table reading a menu, and
 *   the restaurant asked for the quieter default. But a guest who wants to know what they are
 *   spending must never have to ask a waiter for it, so the control is in the bottom bar on
 *   every screen that has a total — always in the same corner, never behind a menu.
 *
 *   Per-dish prices are NOT governed by this. Ordering without prices is ordering blind; this
 *   hides the sum, not the menu.
 *
 * The label is the touch target, at the 44px floor, so a thumb does not have to find an 18px
 * square in a moving car of a restaurant.
 */
export function TotalReveal({
  checked,
  onCheckedChange,
  rows,
  testId,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  rows: Array<{ label: string; value: string }>;
  testId: string;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer select-none items-center gap-2 self-start type-caption font-semibold text-[var(--text-muted)]"
      >
        <CheckboxPrimitive.Root
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          data-testid={testId}
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
            'border-[var(--border-strong)] bg-[var(--surface)]',
            'data-[state=checked]:border-[var(--primary)] data-[state=checked]:bg-[var(--primary)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]'
          )}
        >
          <CheckboxPrimitive.Indicator className="type-caption leading-none text-[var(--on-primary)]">
            ✓
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        Show total
      </label>

      {checked ? (
        <div data-testid={`${testId}-amount`} className="flex flex-col gap-0.5 pb-1">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 type-caption text-[var(--text-muted)]"
            >
              <span>{r.label}</span>
              <span className="font-semibold tabular-nums text-[var(--text-body)]">{r.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
