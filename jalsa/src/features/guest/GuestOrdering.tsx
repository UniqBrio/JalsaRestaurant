'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Chip, FoodMark, Pill, SectionLabel, Stepper } from '@/components/ui/atoms';
import { NoMatchesState } from '@/components/ui/states';
import { Sheet } from '@/components/ui/sheet';
import { SearchField, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import { FOOD_TYPE, type FoodType } from '@/lib/status';
import type { GuestMenuItem } from '@/lib/db/guest-view';
import { ActionBar, TotalReveal, type GuestScreenProps } from './GuestApp';

/**
 * Welcome, menu and cart — screens 1 to 5 of the design set.
 *
 * The menu is where every design decision on this surface is visible at once: the diet filter
 * is a real filter and not a badge, the category chips carry counts, the promoted strips are
 * the four the OWNER configures, and the cart is always reachable without leaving the list.
 */

/* ── 1. Welcome ────────────────────────────────────────────────────────── */

export function WelcomeScreen({ data, go, openSheet }: GuestScreenProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? (data.copy.greetMorning ?? 'Good morning')
      : hour < 16
        ? (data.copy.greetAfternoon ?? 'Good afternoon')
        : hour < 21
          ? (data.copy.greetEvening ?? 'Good evening')
          : (data.copy.greetLate ?? 'Still open — welcome in');

  const crew = [
    data.captain
      ? {
          name: data.captain,
          role: (data.copy.captainLine ?? '{captain} is your captain').replace('{captain}', data.captain),
        }
      : null,
    data.waiter
      ? {
          name: data.waiter,
          role: (data.copy.waiterLine ?? '{waiter} is serving your table').replace('{waiter}', data.waiter),
        }
      : null,
  ].filter((c): c is { name: string; role: string } => c !== null);

  return (
    <div className="flex flex-col gap-5 pt-6" data-testid="guest-welcome">
      <div>
        {/* The greeting follows the DEVICE clock, and the design says so. Software that says
            "good evening" at breakfast reads as broken (Standard 7.5). */}
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">{greeting}</p>
        <h1 className="mt-1 text-[26px] leading-tight">{data.restaurantName}</h1>
        <p className="m-0 mt-0.5 text-[12.5px] text-[var(--text-muted)]">{data.copy.subline}</p>
      </div>

      <Card className="bg-[var(--primary-surface)]">
        <p className="m-0 text-[13.5px] font-semibold text-[var(--on-primary-surface)]">
          You are at table {data.table.name}.
        </p>
        <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          {data.copy.welcome ??
            'The full menu is on your phone. Order as many rounds as you like — one bill at the end.'}
        </p>
      </Card>

      {crew.length ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Looking after you</SectionLabel>
          {crew.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-[13px] font-bold text-[var(--on-primary)]"
              >
                {c.name.charAt(0)}
              </span>
              <span className="text-[13px]">{c.role}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {data.features.hoursBtn ? (
          <Chip on={false} onClick={() => openSheet('hours')} data-testid="guest-welcome-hours">
            {data.copy.hoursBtn ?? 'Hours & holidays'}
          </Chip>
        ) : null}
        {data.features.occasion ? (
          <Chip on={false} onClick={() => openSheet('occasion')} data-testid="guest-welcome-occasion">
            Celebrating?
          </Chip>
        ) : null}
      </div>

      <ActionBar testId="guest-welcome-bar">
        <Button data-testid="guest-start-ordering" size="lg" onClick={() => go('menu')}>
          {data.copy.startBtn ?? 'Start ordering'}
        </Button>
        <p className="m-0 text-center text-[11px] text-[var(--text-muted)]">
          Nothing is charged now. You pay at the end, all rounds on one bill.
        </p>
      </ActionBar>
    </div>
  );
}

/* ── 2-4. Menu, item sheet, persistent cart ────────────────────────────── */

const DIETS: Array<{ key: FoodType; label: string }> = [
  { key: 'veg', label: 'Veg' },
  { key: 'non_veg', label: 'Non-veg' },
  { key: 'egg', label: 'Egg' },
];

export function MenuScreen({ data, go, openSheet, send, runBusy, busy, showTotal, setShowTotal }: GuestScreenProps) {
  const toast = useToast();
  const [query, setQuery] = React.useState('');
  const [diets, setDiets] = React.useState<FoodType[]>([]);
  const [category, setCategory] = React.useState('All');
  const [catSheet, setCatSheet] = React.useState(false);

  const dietPool = React.useMemo(
    () => (diets.length ? data.menu.filter((m) => diets.includes(m.foodType)) : data.menu),
    [data.menu, diets]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return dietPool.filter((m) => {
      if (category !== 'All' && m.category !== category) return false;
      if (q && !`${m.name} ${m.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dietPool, category, query]);

  const setQty = (item: GuestMenuItem, qty: number) =>
    runBusy(async () => {
      await send('/api/guest/cart', { itemId: item.id, qty });
      if (qty === 0) {
        toast.show(`${item.name} removed`, {
          undo: () => runBusy(async () => void (await send('/api/guest/cart', { itemId: item.id, qty: 1 }))),
        });
      } else if (item.inCart === 0) {
        toast.show(`${item.name} added`);
      }
    });

  const dietPhrase = diets.map((d) => FOOD_TYPE[d].label).join(' and ');
  /* Built from the LIVE category list, not a list typed here: a category the owner adds tonight
     has to appear in the sheet tonight, and a hard-coded list is a sheet that quietly goes stale.
     Categories with nothing in them under the current diet filter are kept and shown as 0 rather
     than dropped — a category that vanishes reads as a bug, a category showing 0 explains itself. */
  const cats = ['All', ...data.categories];
  const catCount = (c: string) => (c === 'All' ? dietPool.length : dietPool.filter((m) => m.category === c).length);

  return (
    <div className="flex flex-col gap-4" data-testid="guest-menu">
      {/* Frozen under the header for the length of the list.
          Fifty-seven dishes is four or five screens of scrolling, and a filter that has
          scrolled off the top is a filter the guest has to scroll BACK to before they can
          change their mind — so in practice they do not change their mind, they give up and
          scroll. The block stays under the header instead. `top` is the header's own height
          token, not a number typed here: two places holding the same measurement is how a
          sticky row ends up half-hidden behind a header that grew a line. */}
      <div
        data-testid="guest-menu-filters"
        className="sticky z-20 -mx-4 flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 pb-3 pt-3"
        style={{ top: 'var(--layout-guest-header-height)' }}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search the menu"
          resultCount={filtered.length}
          testId="guest-menu-search"
        />

        <div>
          <SectionLabel>Preferred menu type</SectionLabel>
          <div className="flex gap-2">
            {DIETS.map((d) => {
              const on = diets.includes(d.key);
              const count = data.menu.filter((m) => m.foodType === d.key).length;
              return (
                <Chip
                  key={d.key}
                  on={on}
                  className="flex-1"
                  onClick={() => {
                    const next = on ? diets.filter((x) => x !== d.key) : [...diets, d.key];
                    setDiets(next);
                    // A category that no longer has anything in it under the new filter would
                    // strand the guest on an empty list they did not ask for.
                    const stillThere =
                      next.length === 0 ||
                      data.menu.some((m) => m.category === category && next.includes(m.foodType));
                    if (!stillThere) setCategory('All');
                  }}
                  data-testid={`guest-diet-${d.key}`}
                >
                  <FoodMark type={d.key} size={12} />
                  {on ? `✓ ${d.label}` : d.label}
                  <span className="opacity-60">{count}</span>
                </Chip>
              );
            })}
          </div>
          <p className="m-0 mt-1.5 text-[11.5px] text-[var(--text-muted)]">
            {diets.length
              ? `Showing ${dietPhrase.toLowerCase()} only · tap again to remove`
              : 'Pick one or more. Leave it alone to see everything.'}
          </p>
        </div>

        {/* Categories were a row of chips that scrolled sideways. Ten of them, three visible, and
            the other seven discoverable only by a guest who happened to swipe a row that gives no
            sign there is anything to its right. A category nobody can see is a category nobody
            orders from. One button, one sheet, all ten at once, one thumb. */}
        <div className="flex items-center gap-2">
          <Button
            data-testid="guest-open-categories"
            variant={category === 'All' ? 'secondary' : 'primary'}
            size="md"
            onClick={() => setCatSheet(true)}
            aria-haspopup="dialog"
            className="flex-1 justify-between"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden>☰</span>
              <span className="truncate">{category === 'All' ? 'Categories' : category}</span>
            </span>
            <span className="text-[12px] font-normal opacity-75">{catCount(category)}</span>
          </Button>
          {category !== 'All' ? (
            <Button
              data-testid="guest-cat-clear"
              variant="ghost"
              size="md"
              onClick={() => setCategory('All')}
              className="shrink-0"
            >
              Show all
            </Button>
          ) : null}
        </div>
      </div>

      <Sheet
        open={catSheet}
        onOpenChange={setCatSheet}
        title="Categories"
        description="Tap one to jump straight to it. Tap Everything to come back."
        testId="guest-categories-sheet"
      >
        {/* A grid, not a list: ten short names in two columns is one screen and no scrolling,
            which is the whole difference between this and the row it replaces. The counts are the
            ones already filtered by Veg/Non-veg/Egg, so a category that is empty under the
            guest's current diet says so before they tap it. */}
        <div className="grid grid-cols-2 gap-2">
          {cats.map((c) => {
            const n = catCount(c);
            return (
              <Button
                key={c}
                data-testid={`guest-cat-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                variant={category === c ? 'primary' : 'quiet'}
                size="md"
                disabled={n === 0 && c !== 'All'}
                onClick={() => {
                  setCategory(c);
                  setCatSheet(false);
                }}
                className="min-h-[52px] justify-between text-left"
              >
                <span className="min-w-0 truncate">{c === 'All' ? 'Everything' : c}</span>
                <span className="text-[12px] font-normal opacity-70">{n}</span>
              </Button>
            );
          })}
        </div>
      </Sheet>

      {filtered.length === 0 ? (
        <NoMatchesState
          query={query}
          filters={diets.map((d) => FOOD_TYPE[d].label)}
          onClear={() => {
            setQuery('');
            setDiets([]);
            setCategory('All');
          }}
          testId="guest-menu-nomatch"
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {filtered.map((item) => (
            <li key={item.id}>
              <MenuRow
                item={item}
                busy={busy}
                onOpen={() => openSheet('item', item.id)}
                onAdd={() => setQty(item, item.inCart + 1)}
                onRemove={() => setQty(item, item.inCart - 1)}
              />
            </li>
          ))}
        </ul>
      )}

      {data.cartCount > 0 ? (
        <ActionBar testId="guest-cart-bar">
          <TotalReveal
            checked={showTotal}
            onCheckedChange={setShowTotal}
            rows={[{ label: 'This round', value: data.cartSubtotalLabel }]}
            testId="guest-menu-total-toggle"
          />
          <Button data-testid="guest-review-order" size="lg" onClick={() => go('cart')}>
            <span className="flex w-full items-center justify-between gap-3">
              <span>Review order</span>
              <span className="text-[12.5px] font-normal opacity-90">
                {data.cartCount === 1 ? '1 item' : `${data.cartCount} items`}
              </span>
            </span>
          </Button>
        </ActionBar>
      ) : null}
    </div>
  );
}

function MenuRow({
  item,
  onOpen,
  onAdd,
  onRemove,
  busy,
}: {
  item: GuestMenuItem;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <Card className="flex items-start gap-3 p-3">
      <button
        data-testid={`guest-item-${item.id}`}
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-[var(--radius-sm)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        {/* The space a photograph will occupy, held open before there is one.
            The menu carries no images today. Adding them later into rows that never reserved the
            space re-flows all 57 at once — every name moves, every price moves, and a guest
            mid-scroll loses their place. Held open now, the day the photographs arrive is the day
            they simply appear.
            Decorative, so aria-hidden: a screen reader announcing an empty tile between the veg
            mark and the dish name is noise, and the row reads perfectly without it. */}
        <span
          aria-hidden
          data-testid={`guest-item-image-${item.id}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--text-disabled)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <circle cx="8.5" cy="9.5" r="1.6" />
            <path d="M3.5 17l4.8-4.8a1.6 1.6 0 0 1 2.3 0L15 16.5l1.9-1.9a1.6 1.6 0 0 1 2.3 0l1.3 1.3" />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <FoodMark type={item.foodType} />
            <span className="min-w-0 truncate text-[13.5px] font-semibold">{item.name}</span>
          </span>
          <span className="mt-0.5 block text-[11.5px] text-[var(--text-muted)]">
            {FOOD_TYPE[item.foodType].label} · {item.category}
          </span>
          <span className="mt-1 block text-[13.5px] font-bold">{item.priceLabel}</span>
        </span>
      </button>

      <div className="shrink-0 pt-1">
        {!item.available ? (
          // Standard 5.6: show the capability, withhold the action. A disabled + that does
          // nothing is worse than no + at all.
          <Pill tone="neutral">Sold out</Pill>
        ) : item.inCart > 0 ? (
          <Stepper
            qty={item.inCart}
            onDecrease={onRemove}
            onIncrease={onAdd}
            testIdPrefix={`guest-qty-${item.id}`}
            label={item.name}
            disabled={busy}
          />
        ) : (
          <Button
            data-testid={`guest-add-${item.id}`}
            size="icon"
            onClick={onAdd}
            disabled={busy}
            aria-label={`Add ${item.name}`}
          >
            +
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ── 5. Order review ───────────────────────────────────────────────────── */

export function CartScreen({ data, go, send, runBusy, busy, showTotal, setShowTotal }: GuestScreenProps) {
  const toast = useToast();
  const [note, setNote] = React.useState('');

  const lines = data.menu.filter((m) => m.inCart > 0);
  const subtotal = lines.reduce((a, l) => a + l.price * l.inCart, 0);

  const setQty = (item: GuestMenuItem, qty: number) =>
    runBusy(async () => {
      await send('/api/guest/cart', { itemId: item.id, qty });
    });

  const place = () =>
    runBusy(async () => {
      const res = await send<{ kotCode: string; refused: string[] }>('/api/guest/round', { note });
      setNote('');
      if (res.refused.length) {
        toast.show(
          `${res.refused.join(' and ')} had just sold out and ${res.refused.length === 1 ? 'was' : 'were'} not sent. Everything else is with the kitchen.`,
          { tone: 'error' }
        );
      } else {
        toast.show(`${res.kotCode} sent to the kitchen`, { tone: 'success' });
      }
      go('placed');
    });

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-6" data-testid="guest-cart-empty">
        <h2 className="text-[19px]">Nothing here yet</h2>
        <p className="m-0 text-[13px] leading-relaxed text-[var(--text-muted)]">
          Add something from the menu and it will show up here before it goes anywhere near the kitchen.
        </p>
        <Button data-testid="guest-cart-back-to-menu" variant="secondary" onClick={() => go('menu')}>
          Back to the menu
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="guest-cart">
      <div>
        <h2 className="text-[19px]">Check your order</h2>
        <p className="m-0 mt-0.5 text-[12px] text-[var(--text-muted)]">
          {data.cartCount === 1 ? '1 item' : `${data.cartCount} items`} · nothing sent to the kitchen yet
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((l) => (
          <li key={l.id}>
            <Card className="flex items-center gap-3 p-3">
              <FoodMark type={l.foodType} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{l.name}</span>
                <span className="block text-[11.5px] text-[var(--text-muted)]">{rupees(l.price)} each</span>
              </span>
              <Stepper
                qty={l.inCart}
                onDecrease={() => setQty(l, l.inCart - 1)}
                onIncrease={() => setQty(l, l.inCart + 1)}
                testIdPrefix={`guest-cart-qty-${l.id}`}
                label={l.name}
                disabled={busy}
              />
              <span className="w-16 shrink-0 text-right text-[13px] font-bold tabular-nums">
                {rupees(l.price * l.inCart)}
              </span>
            </Card>
          </li>
        ))}
      </ul>

      <div>
        <label htmlFor="guest-note" className="text-[12px] font-semibold">
          Anything the kitchen should know?
        </label>
        <Textarea
          id="guest-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Less spice, no onion, extra raita…"
          data-testid="guest-note"
          className="mt-1.5"
        />
      </div>

      {/* The two totals used to sit HERE, in a card directly above the bar — and the bar, being
          two rows tall and fixed, covered them. They now live inside the bar itself, behind the
          tick box, where nothing can be on top of them. */}
      <ActionBar testId="guest-cart-actions">
        <TotalReveal
          checked={showTotal}
          onCheckedChange={setShowTotal}
          rows={[
            { label: 'This round', value: rupees(subtotal) },
            { label: 'Already ordered', value: data.runningTotalLabel.replace(' before tax', '') },
          ]}
          testId="guest-cart-total-toggle"
        />
        <div className="flex items-center gap-2">
          <Button
            data-testid="guest-send-to-kitchen"
            size="lg"
            onClick={place}
            disabled={busy}
            className="w-auto flex-1"
          >
            Send to the kitchen
          </Button>
          {/* "Add something else", as an icon beside the commitment rather than a second row
              under it. The words survive as the accessible name — a + with no name is a
              mystery to a screen reader and to anyone who has not seen this screen before. */}
          <Button
            data-testid="guest-add-something-else"
            size="icon"
            variant="secondary"
            onClick={() => go('menu')}
            disabled={busy}
            aria-label="Add something else"
            title="Add something else"
            className="h-12 w-12 shrink-0 text-[20px]"
          >
            +
          </Button>
        </div>
      </ActionBar>
    </div>
  );
}
