'use client';

import * as React from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, Chip, FoodMark, Stepper } from '@/components/ui/atoms';
import { Input, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { FOOD_TYPE } from '@/lib/status';
import type { GuestPayload } from '@/lib/db/guest-view';

/**
 * The seven sheets behind the ⋯ button.
 *
 * WHY THEY ARE SHEETS AND NOT SCREENS
 *   Every one of them is a detour: a dish's description, a jug of water, when the kitchen shuts,
 *   a birthday. Making any of them a screen would put a second decision on the customer path,
 *   which is the one thing the design set rules out. A sheet keeps the journey visible behind it.
 *
 * WHICH ONES EXIST IS THE OWNER'S DECISION, not this component's. Each is gated on a feature
 * switch, and the design says why: "the owner chooses which of these appear, so this list can be
 * shorter on a busy night." A request the floor cannot honour is worse than a missing one,
 * because it makes a promise (Standard 2.4).
 */

export type SheetKind = 'help' | 'item' | 'hours' | 'occasion' | 'suggestion' | 'loved' | 'crew';

export function GuestSheets({
  sheet,
  onClose,
  openSheet,
  data,
  send,
  runBusy,
  busy,
}: {
  sheet: { kind: SheetKind; arg?: string } | null;
  onClose: () => void;
  /** Sheets open other sheets — "ask for a person" and "tell us what to fix" both live here. */
  openSheet: (kind: SheetKind, arg?: string) => void;
  data: GuestPayload;
  send: <T>(path: string, payload: unknown) => Promise<T>;
  runBusy: (fn: () => Promise<void>) => void;
  busy: boolean;
}) {
  const toast = useToast();
  const [occasion, setOccasion] = React.useState('');
  const [occasionName, setOccasionName] = React.useState('');
  const [suggestion, setSuggestion] = React.useState('');
  // The dish sheet's quantity resets to one whenever a DIFFERENT dish is opened - adjusted
  // during render rather than in an effect, so the stepper never shows the previous dish's
  // count for a frame.
  const [itemState, setItemState] = React.useState<{ arg: string | undefined; qty: number }>({
    arg: sheet?.arg,
    qty: 1,
  });
  if (itemState.arg !== sheet?.arg) setItemState({ arg: sheet?.arg, qty: 1 });
  const itemQty = itemState.qty;
  const setItemQty = (fn: (q: number) => number) => setItemState((s) => ({ ...s, qty: fn(s.qty) }));

  const open = sheet !== null;
  const kind = sheet?.kind;

  const ask = (kindLabel: string, note?: string) =>
    runBusy(async () => {
      await send('/api/guest/ask', { kind: kindLabel, ...(note ? { note } : {}) });
      onClose();
      toast.show(
        kindLabel === 'Call captain'
          ? `${data.captain || 'Your captain'} has been called to your table`
          : `${kindLabel} — someone is on the way`,
        { tone: 'success' }
      );
    });

  /* ── Ask for something ───────────────────────────────────────────────── */
  if (kind === 'help') {
    const actions = [
      data.features.water ? { label: 'Need water', note: 'Someone fills your jug' } : null,
      data.features.waterBottle ? { label: 'Water bottle', note: 'A sealed bottle, added to the bill' } : null,
      data.features.callCaptain
        ? { label: 'Call captain', note: `${data.captain || 'Your captain'} comes to the table` }
        : null,
      data.features.plates ? { label: 'Extra plates / cutlery', note: 'Plates, spoons or a serving spoon' } : null,
      data.features.parcelRest ? { label: 'Parcel what is left', note: 'We pack the rest to take home' } : null,
      data.features.askBill ? { label: 'Ask for the bill', note: 'Your captain brings it over' } : null,
    ].filter((a): a is { label: string; note: string } => a !== null);

    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={data.copy.askHeading ?? 'Ask for something'}
        description={
          data.waiter
            ? `No need to wave. ${data.waiter} sees these the moment you tap.`
            : 'No need to wave. The floor sees these the moment you tap.'
        }
        testId="guest-sheet-help"
      >
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {actions.map((a) => (
            <li key={a.label}>
              <button
                data-testid={`guest-ask-${a.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                type="button"
                disabled={busy}
                onClick={() => ask(a.label)}

                className="flex w-full min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 text-left transition-colors hover:bg-[var(--primary-surface)] disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              >
                <span className="min-w-0">
                  <span className="block type-body font-semibold">{a.label}</span>
                  <span className="block type-caption text-[var(--text-muted)]">{a.note}</span>
                </span>
                <span aria-hidden className="text-[var(--text-muted)]">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {data.features.askForPerson ? (
            <Chip on={false} onClick={() => openSheet('crew')} data-testid="guest-ask-person">
              Ask for a particular person
            </Chip>
          ) : null}
          {data.features.suggestion ? (
            <Chip on={false} onClick={() => openSheet('suggestion')} data-testid="guest-ask-suggest">
              {data.copy.suggestBtn ?? 'Tell us something'}
            </Chip>
          ) : null}
          {data.features.hoursBtn ? (
            <Chip on={false} onClick={() => openSheet('hours')} data-testid="guest-ask-hours">
              {data.copy.hoursBtn ?? 'Hours & holidays'}
            </Chip>
          ) : null}
          {data.features.occasion ? (
            <Chip on={false} onClick={() => openSheet('occasion')} data-testid="guest-ask-occasion">
              Celebrating?
            </Chip>
          ) : null}
        </div>

        <p className="m-0 mt-4 type-caption leading-relaxed text-[var(--text-muted)]">
          The owner chooses which of these appear, so this list can be shorter on a busy night.
        </p>
      </Sheet>
    );
  }

  /* ── About this dish ─────────────────────────────────────────────────── */
  if (kind === 'item') {
    const item = data.menu.find((m) => m.id === sheet?.arg);
    if (!item) return null;
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="About this dish"
        testId="guest-sheet-item"
        footer={
          item.available ? (
            <Button
              data-testid="guest-sheet-item-add"
              size="lg"
              disabled={busy}
              onClick={() =>
                runBusy(async () => {
                  await send('/api/guest/cart', { itemId: item.id, qty: item.inCart + itemQty });
                  onClose();
                  toast.show(`${item.name}${itemQty > 1 ? ` ×${itemQty}` : ''} added`);
                })
              }
            >
              Add · {`₹${(item.price * itemQty).toLocaleString('en-IN')}`}
            </Button>
          ) : (
            <p className="m-0 type-caption font-semibold text-[var(--text-muted)]">
              Sold out for now. Your captain will know when it is back.
            </p>
          )
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FoodMark type={item.foodType} size={16} />
            <span className="type-body font-semibold">{item.name}</span>
          </div>
          <p className="m-0 type-body leading-relaxed text-[var(--text-muted)]">{item.description}</p>
          <p className="m-0 type-caption text-[var(--text-muted)]">
            {FOOD_TYPE[item.foodType].label} · {item.category}
          </p>
          <div className="flex items-center justify-between">
            <span className="type-h3 font-bold">{item.priceLabel}</span>
            {item.available ? (
              <Stepper
                qty={itemQty}
                onDecrease={() => setItemQty((q) => Math.max(1, q - 1))}
                onIncrease={() => setItemQty((q) => q + 1)}
                testIdPrefix="guest-sheet-item"
                label={item.name}
              />
            ) : null}
          </div>
        </div>
      </Sheet>
    );
  }

  /* ── Hours and holidays ──────────────────────────────────────────────── */
  if (kind === 'hours') {
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={data.copy.hoursBtn ?? 'Hours and holidays'}
        description="Kitchen closes half an hour before we do."
        testId="guest-sheet-hours"
      >
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {data.hoursRows.map((h) => (
            <li
              key={h.day}
              className={`flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 type-caption ${
                h.today
                  ? 'bg-[var(--success-surface)] font-semibold text-[var(--on-success-surface)]'
                  : 'bg-[var(--surface-sunken)]'
              }`}
            >
              <span>
                {h.day}
                {h.today ? ' · today' : ''}
              </span>
              <span className="tabular-nums">{h.hours}</span>
            </li>
          ))}
        </ul>
        {data.holidayNote ? (
          <p className="m-0 mt-3 type-caption leading-relaxed text-[var(--text-muted)]">{data.holidayNote}</p>
        ) : null}
        {data.callNumber ? (
          <Button data-testid="guest-sheet-call" asChild variant="secondary" className="mt-4">
            <a data-testid="guest-sheet-call-link" href={`tel:${data.callNumber.replace(/\s+/g, '')}`}>
              {data.copy.callBtn ?? 'Call the restaurant'}
            </a>
          </Button>
        ) : null}
      </Sheet>
    );
  }

  /* ── Celebrating something? ──────────────────────────────────────────── */
  if (kind === 'occasion') {
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Celebrating something?"
        description="The team will know before the food comes out."
        testId="guest-sheet-occasion"
        footer={
          <Button
            data-testid="guest-sheet-occasion-save"
            disabled={busy || !occasion}
            onClick={() =>
              runBusy(async () => {
                await send('/api/guest/bill', { action: 'occasion', type: occasion, name: occasionName });
                onClose();
                toast.show(
                  occasionName
                    ? `${occasion} for ${occasionName} — the team knows`
                    : `${occasion} noted — the team knows`,
                  { tone: 'success' }
                );
              })
            }
          >
            Tell the team
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {['Birthday', 'Anniversary', 'Family celebration', 'Something else'].map((o) => (
            <Chip
              key={o}
              on={occasion === o}
              onClick={() => setOccasion(o)}
              data-testid={`guest-occasion-${o.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              {o}
            </Chip>
          ))}
        </div>
        <div className="mt-3">
          <label htmlFor="guest-occ-name" className="type-caption font-semibold">
            Whose is it?
          </label>
          <Input
            id="guest-occ-name"
            value={occasionName}
            onChange={(e) => setOccasionName(e.target.value)}
            placeholder="A name, if you would like it used"
            data-testid="guest-occasion-name"
            className="mt-1.5"
          />
        </div>
        <p className="m-0 mt-3 type-caption leading-relaxed text-[var(--text-muted)]">
          Nothing is added to your bill. The owner decides whether this is even asked.
        </p>
      </Sheet>
    );
  }

  /* ── Suggest an improvement ──────────────────────────────────────────── */
  if (kind === 'suggestion') {
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Tell us what to fix"
        description={data.copy.suggestPrompt ?? 'Tell us anything — we read every one'}
        testId="guest-sheet-suggestion"
        footer={
          <Button
            data-testid="guest-sheet-suggestion-send"
            disabled={busy || !suggestion.trim()}
            onClick={() =>
              runBusy(async () => {
                await send('/api/guest/ask', { suggestion });
                setSuggestion('');
                onClose();
                toast.show('Sent to the owner. Every suggestion gets a reply.', { tone: 'success' });
              })
            }
          >
            Send it
          </Button>
        }
      >
        <Textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          rows={4}
          placeholder="The raita was a little salty tonight…"
          aria-label="Your suggestion"
          data-testid="guest-suggestion-body"
        />
        <p className="m-0 mt-3 type-caption leading-relaxed text-[var(--text-muted)]">
          Suggestions land in the owner&rsquo;s dashboard, not on a public page.
        </p>
      </Sheet>
    );
  }

  /* ── Loved it → parcel offer ─────────────────────────────────────────── */
  if (kind === 'loved') {
    const dish = sheet?.arg ?? '';
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Glad you liked it"
        testId="guest-sheet-loved"
        footer={
          <>
            <Button data-testid="guest-loved-decline" variant="ghost" onClick={onClose}>
              Not this time
            </Button>
            <Button
              data-testid="guest-loved-parcel"
              disabled={busy}
              onClick={() =>
                runBusy(async () => {
                  await send('/api/guest/ask', { kind: 'Parcel a favourite', note: dish });
                  onClose();
                  toast.show(`${dish} parcel asked for — billed separately as a takeaway`, { tone: 'success' });
                })
              }
            >
              Add a parcel
            </Button>
          </>
        }
      >
        <Card className="bg-[var(--primary-surface)]">
          <p className="m-0 type-body leading-relaxed text-[var(--on-primary-surface)]">
            {(
              data.copy.parcelPitch ?? '{dish} is a favourite here too. Take a portion home for someone you love?'
            ).replace('{dish}', dish)}
          </p>
        </Card>
        <p className="m-0 mt-3 type-caption leading-relaxed text-[var(--text-muted)]">
          Billed separately as a takeaway, not added to your table bill.
        </p>
      </Sheet>
    );
  }

  /* ── Ask for a particular person ─────────────────────────────────────── */
  if (kind === 'crew') {
    const crew = [data.captain, data.waiter].filter(Boolean);
    return (
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Who would you like?"
        description="Any of them can take your order."
        testId="guest-sheet-crew"
      >
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {crew.map((name) => (
            <li key={name}>
              <button
                data-testid={`guest-crew-${name.toLowerCase()}`}
                type="button"
                disabled={busy}
                onClick={() => ask('Call captain', `They asked for ${name} by name`)}

                className="flex w-full min-h-11 items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 text-left transition-colors hover:bg-[var(--primary-surface)] disabled:opacity-45"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] type-body font-bold text-[var(--on-primary)]"
                >
                  {name.charAt(0)}
                </span>
                <span className="type-body font-semibold">{name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    );
  }

  return null;
}
