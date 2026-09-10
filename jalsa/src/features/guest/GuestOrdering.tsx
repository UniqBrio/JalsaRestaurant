'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Chip, ChipRow, FoodMark, Pill, SectionLabel, Stepper } from '@/components/ui/atoms';
import { NoMatchesState } from '@/components/ui/states';
import { SearchField, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import { FOOD_TYPE, type FoodType } from '@/lib/status';
import type { GuestMenuItem } from '@/lib/db/guest-view';
import { ActionBar, type GuestScreenProps } from './GuestApp';

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

export function MenuScreen({ data, go, openSheet, send, runBusy, busy }: GuestScreenProps) {
  const toast = useToast();
  const [query, setQuery] = React.useState('');
  const [diets, setDiets] = React.useState<FoodType[]>([]);
  const [category, setCategory] = React.useState('All');

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
  const cats = ['All', ...data.categories.filter((c) => dietPool.some((m) => m.category === c))];

  return (
    <div className="flex flex-col gap-4" data-testid="guest-menu">
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
                    next.length === 0 || data.menu.some((m) => m.category === category && next.includes(m.foodType));
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

      <ChipRow>
        {cats.map((c) => {
          const n = c === 'All' ? dietPool.length : dietPool.filter((m) => m.category === c).length;
          return (
            <Chip
              key={c}
              on={category === c}
              onClick={() => setCategory(c)}
              data-testid={`guest-cat-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              {c} <span className="opacity-60">{n}</span>
            </Chip>
          );
        })}
      </ChipRow>

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
          <Button data-testid="guest-review-order" size="lg" onClick={() => go('cart')}>
            <span className="flex w-full items-center justify-between gap-3">
              <span>Review order</span>
              <span className="text-[12.5px] font-normal opacity-90">
                {data.cartCount === 1 ? '1 item' : `${data.cartCount} items`} · {data.cartSubtotalLabel}
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

        className="min-w-0 flex-1 rounded-[var(--radius-sm)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        <span className="flex items-center gap-2">
          <FoodMark type={item.foodType} />
          <span className="min-w-0 truncate text-[13.5px] font-semibold">{item.name}</span>
        </span>
        <span className="mt-0.5 block text-[11.5px] text-[var(--text-muted)]">
          {FOOD_TYPE[item.foodType].label} · {item.category}
        </span>
        <span className="mt-1 block text-[13.5px] font-bold">{item.priceLabel}</span>
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

export function CartScreen({ data, go, send, runBusy, busy }: GuestScreenProps) {
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

      <Card className="bg-[var(--surface-sunken)]">
        <div className="flex items-baseline justify-between text-[12.5px] text-[var(--text-muted)]">
          <span>This round</span>
          <span className="tabular-nums">{rupees(subtotal)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between text-[12.5px] text-[var(--text-muted)]">
          <span>Already ordered</span>
          <span className="tabular-nums">{data.runningTotalLabel.replace(' before tax', '')}</span>
        </div>
      </Card>

      <ActionBar testId="guest-cart-actions">
        <Button data-testid="guest-send-to-kitchen" size="lg" onClick={place} disabled={busy}>
          Send to the kitchen · {rupees(subtotal)}
        </Button>
        <Button data-testid="guest-add-something-else" variant="ghost" onClick={() => go('menu')}>
          Add something else
        </Button>
      </ActionBar>
    </div>
  );
}
