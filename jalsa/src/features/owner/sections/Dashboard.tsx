'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, Pill, SectionLabel } from '@/components/ui/atoms';
import { Input, Textarea } from '@/components/ui/field';
import { FirstRunState } from '@/components/ui/states';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import type { OwnerPayload } from '@/lib/db/owner-view';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';
import { WelcomeDrinksOffer } from '@/components/ui/welcome-drinks';
import { NewDishOffer } from '@/components/ui/new-dish';
import { afterDishSaved, canAddDish, type NewDishSaved } from '@/lib/new-dish';
import { readWelcomeDrinks, welcomeDrinksToOffer, type WelcomeDrinksConfig } from '@/lib/welcome-drinks';

/**
 * Screen 22 — the dashboard, and the landing screen.
 *
 * EVERY FIGURE IS A LINK, AND NAVIGATING PRE-APPLIES ITS FILTER (Standard 1.4)
 *   A number with no route to its detail invites a support question. The link is one line and
 *   removes the question entirely — and because every figure here is computed from the same read
 *   as the section it opens, the detail always reconciles with the number that was clicked.
 *
 * REQUESTS AND SUGGESTIONS ARE ON THE LANDING SCREEN ON PURPOSE
 *   Both are people waiting on a human answer, and both are invisible everywhere else in the
 *   building. A request older than five minutes turns red here at the same moment it turns red
 *   on the captain's phone — neither can assume the other has it (Standard 8.2).
 */
export function Dashboard({ data, go, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState('');
  /* Freeing a table by hand is irreversible from the floor's point of view — the phone attached
     to it loses its cart — so it asks first, and the sheet names the table it is about to act on.
     `tables.free` is a GRANT, not a role: the owner holds it and hands it to whoever they trust
     with it, which is the whole of what was asked for. */
  const [freeing, setFreeing] = React.useState<(typeof data.floor)[number] | null>(null);
  const canFree = data.grants.includes('tables.free');

  /* Starting a round from here is for the walk-in nobody is on the floor for. Offered only
     where the grant is held, for the same reason Mark free is: a control that is offered and
     then refused is worse than one that was never there (Standard 5.6). The server checks it
     again inside `placeRound`, which is where the rule actually lives. */
  const [seating, setSeating] = React.useState<(typeof data.floor)[number] | null>(null);
  const canOrder = data.grants.includes('orders.add_items');

  const replies = ((data.settings.replies ?? {}) as { items?: Array<{ name: string; text: string }> }).items ?? [];
  const unanswered = data.suggestions.filter((s) => !s.repliedAt);

  /* The one setup nudge on the dashboard (23-Sep-2026): until a printing computer is connected
     nothing physically prints, and that is discovered mid-service by paper that never arrives.
     Shown only to somebody who can act on it, and gone the moment one computer connects. */
  const noPrintingComputer = data.grants.includes('set.printer') && data.printComputers.length === 0;

  return (
    <div className="flex flex-col gap-5" data-testid="owner-dashboard">
      {noPrintingComputer ? (
        <button
          type="button"
          data-testid="owner-dashboard-connect-printer"
          onClick={() => go('printers')}
          className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--warning-surface)] px-4 py-3 text-left text-[var(--on-warning-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          <span className="min-w-0 flex-1">
            <span className="block type-body font-semibold">Connect your printing computer</span>
            <span className="block type-caption leading-relaxed">
              Kitchen tickets wait in the queue until the computer with the thermal printer is connected. Open Printers to set it up.
            </span>
          </span>
          <span className="type-body font-semibold">Printers →</span>
        </button>
      ) : null}

      <section>
        <SectionLabel>Today</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <MetricTile
            label="Sales recorded"
            value={data.today.salesLabel}
            note={`${data.closedToday.length} bills closed · excludes tips`}
            onClick={() => go('reports')}
            testId="owner-kpi-sales"
          />
          <MetricTile
            label="Open bills"
            value={String(data.today.openBills)}
            note={data.today.coversLabel}
            onClick={() => go('orders')}
            testId="owner-kpi-open"
          />
          <MetricTile
            label="Awaiting closure"
            value={String(data.today.awaitingClosure)}
            note="Guests have asked for the bill"
            onClick={() => go('payments')}
            testId="owner-kpi-closure"
            tone={data.today.awaitingClosure > 0 ? 'primary' : 'neutral'}
          />
          <MetricTile
            label="Tips collected"
            value={data.today.tipsLabel}
            note="Staff money — not income"
            onClick={() => go('tips')}
            testId="owner-kpi-tips"
          />
          <MetricTile
            label="Print failures"
            value={String(data.today.printFailures)}
            note={
              data.today.printFailures
                ? 'Orders are safe — tickets are not'
                : data.today.printWaiting
                  ? `${data.today.printWaiting} still waiting to print`
                  : 'Every ticket printed'
            }
            onClick={() => go('orders')}
            testId="owner-kpi-print"
            tone={data.today.printFailures > 0 ? 'error' : 'neutral'}
          />
        </div>
      </section>

      {data.today.paymentMix.length ? (
        <section>
          <SectionLabel>Payment mix today</SectionLabel>
          <Card className="flex flex-wrap gap-x-6 gap-y-2">
            {data.today.paymentMix.map((p) => (
              <span key={p.mode} className="type-body">
                <span className="font-semibold">{p.mode}</span>{' '}
                <span className="tabular-nums text-[var(--text-muted)]">
                  {p.amountLabel} · {p.count === 1 ? '1 bill' : `${p.count} bills`}
                </span>
              </span>
            ))}
          </Card>
        </section>
      ) : null}

      {/* FIRST on this screen, above the floor grid.
          A table request is the only thing on the Dashboard with a clock running on it — it
          turns red after five minutes — and it used to sit underneath twenty-two table cards,
          off the bottom of the screen. The most time-critical thing on a page belongs where the
          eye lands, not where the layout happened to leave room. */}
      <section data-testid="owner-requests">
        <SectionLabel>Table requests</SectionLabel>
        {data.requests.length === 0 ? (
          <Card>
            <p className="m-0 type-caption text-[var(--text-muted)]">
              Nothing waiting. Requests appear here the moment a guest taps, and turn red after five minutes.
            </p>
          </Card>
        ) : (
          /* Three rows tall, and the rest scroll INSIDE this box rather than pushing the
             floor grid down the page. A "show more" button would be a tap between the owner and
             something with a clock running on it; letting the page grow is what this section was
             moved to the top to stop. `--layout-owner-requests-max-height` is three rows plus a
             sliver of the fourth, so there is always something visibly cut off when there is
             more — a scroll box that ends flush looks finished. */
          <ul
            data-testid="owner-requests-list"
            className="m-0 flex max-h-[var(--layout-owner-requests-max-height)] list-none flex-col gap-2 overflow-y-auto p-0"
          >
            {data.requests.map((r) => (
              <li key={r.id}>
                <Card
                  className={cn(
                    'flex flex-wrap items-center gap-3 p-3',
                    r.urgent && 'bg-[var(--error-surface)] text-[var(--on-error-surface)]'
                  )}
                >
                  <span className="type-body font-bold">Table {r.tableName}</span>
                  {/* Whose notification it is (item 37): a payment request raises one for the
                      bill counter and one for the captain. */}
                  {r.forCounter ? (
                    <Pill tone="primary" data-testid={`owner-request-counter-${r.id}`}>
                      Bill counter
                    </Pill>
                  ) : null}
                  <span className="min-w-0 flex-1 type-body">
                    {r.kind}
                    {r.note ? <span className="opacity-75"> — {r.note}</span> : null}
                  </span>
                  <span className="type-caption text-[var(--text-muted)]">{r.captain}</span>
                  <span className="type-caption font-bold tabular-nums">{r.ageMinutes} min</span>
                  <Button
                    data-testid={`owner-request-done-${r.id}`}
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      runBusy(async () => {
                        await send('/api/owner/action', { action: 'complete-request', requestId: r.id });
                        toast.show(`${r.kind} at ${r.tableName} marked done`, { tone: 'success' });
                      })
                    }
                  >
                    Done
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
          Captains see the same list — either of you can clear it, and it clears for both. Rows marked Bill counter are
          yours alone: when a guest asks to pay, the captain is told separately to see to the table.
        </p>
      </section>

      {/* Keyed by the table, so choosing a different one remounts the sheet and its cart starts
          empty. A cart left over from a table the owner decided against would otherwise be sent
          to the next one — and resetting it in an effect is a render that fixes a render. */}
      <NewRoundSheet
        key={seating?.id ?? 'none'}
        table={seating}
        onClose={() => setSeating(null)}
        menu={data.menu}
        categories={data.categories}
        grants={data.grants}
        welcomeDrinks={readWelcomeDrinks(data.settings.welcomeDrinks)}
        send={send}
        runBusy={runBusy}
        busy={busy}
        go={go}
      />

      <section>
        <SectionLabel>Floor right now</SectionLabel>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-6">
          {data.floor.map((t) => (
            <li key={t.id}>
              <button
                data-testid={`owner-floor-${t.name}`}
                type="button"
                /* Seated: open its bill. Free and orderable: start a round on it. Otherwise
                   inert, which is what an off-duty table should be. */
                disabled={!t.billId && !(canOrder && t.active && t.clearing === null)}
                onClick={() => (t.billId ? go('orders', t.billId) : setSeating(t))}

                className={cn(
                  'w-full rounded-[var(--radius-md)] p-3 text-left shadow-[var(--shadow-card)] transition-colors',
                  'disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                  t.tone === 'success'
                    ? 'bg-[var(--success-surface)] text-[var(--on-success-surface)]'
                    : t.tone === 'warning'
                      ? 'bg-[var(--warning-surface)] text-[var(--on-warning-surface)]'
                      : t.tone === 'primary'
                        ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                        : 'bg-[var(--surface)]'
                )}
              >
                <span className="block type-body font-bold">{t.name}</span>
                <span className="block type-caption font-semibold">{t.stateLabel}</span>
                <span className="block type-caption opacity-75">{t.line}</span>
              </button>

              {/* Only where the person holds the grant, and only on a table that is actually
                  holding something. The rule that decides whether it can be DONE lives in
                  freeTable, on the server; this only decides whether to offer it, because a
                  control that is offered and then refused is worse than one that was never
                  there (Standard 5.6). */}
              {canFree && t.freeable ? (
                <Button
                  data-testid={`owner-free-table-${t.name}`}
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="mt-1 w-full"
                  onClick={() => setFreeing(t)}
                >
                  Mark free
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <Sheet
        open={freeing !== null}
        onOpenChange={(v) => !v && setFreeing(null)}
        posture="modal"
        title={freeing ? `Mark table ${freeing.name} free?` : 'Mark this table free?'}
        description="For a table the party has left without ordering — a wrong table, a change of mind, a phone that walked out with a cart on it."
        testId="owner-free-table-sheet"
        footer={
          <>
            <Button data-testid="owner-free-table-cancel" variant="ghost" onClick={() => setFreeing(null)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-free-table-confirm"
              disabled={busy}
              onClick={() => {
                const t = freeing;
                if (!t) return;
                runBusy(async () => {
                  await send('/api/owner/action', { action: 'free-table', tableId: t.id });
                  toast.show(`Table ${t.name} is free — recorded against your name`, { tone: 'success' });
                  setFreeing(null);
                });
              }}
            >
              Mark it free
            </Button>
          </>
        }
      >
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
          Anything that phone had chosen and not sent is discarded, and the next scan of this table starts fresh. If a
          round has already gone to the kitchen this will be refused — that is a payment or a void, not a floor
          operation.
        </p>
      </Sheet>

      <section>
        <SectionLabel>Suggestions from guests</SectionLabel>
        {data.suggestions.length === 0 ? (
          <FirstRunState
            title="Nothing yet tonight"
            note="Anything a guest writes on their phone lands here, privately, for you to acknowledge with a reply."
            testId="owner-suggestions-empty"
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.suggestions.map((s) => (
              <li key={s.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="type-caption font-bold">Table {s.tableName ?? '—'}</span>
                    <span className="type-caption text-[var(--text-muted)]">
                      {new Date(s.createdAt).toLocaleTimeString('en-IN', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                    {!s.repliedAt ? <Pill tone="primary">New</Pill> : null}
                  </div>
                  <p className="m-0 mt-1.5 type-body leading-relaxed">{s.body}</p>

                  {s.repliedAt ? (
                    <p className="m-0 mt-2 rounded-[var(--radius-md)] bg-[var(--success-surface)] px-3 py-2 type-caption leading-relaxed text-[var(--on-success-surface)]">
                      <strong>Your reply</strong> · {s.repliedBy} — {s.reply}
                    </p>
                  ) : replyTo === s.id ? (
                    <div className="mt-2.5 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {replies.map((r) => (
                          <button
                            data-testid={`owner-canned-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            key={r.name}
                            type="button"
                            onClick={() => setReply(r.text)}

                            className="min-h-11 rounded-full border border-[var(--border-strong)]/25 px-3 type-caption font-semibold text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={3}
                        aria-label="Your reply"
                        data-testid="owner-reply-body"
                      />
                      <div className="flex gap-2">
                        <Button
                          data-testid="owner-reply-send"
                          size="sm"
                          disabled={busy || !reply.trim()}
                          onClick={() =>
                            runBusy(async () => {
                              await send('/api/owner/action', {
                                action: 'reply-suggestion',
                                suggestionId: s.id,
                                reply,
                              });
                              setReplyTo(null);
                              setReply('');
                              toast.show('Acknowledgement sent to the phone that wrote it', { tone: 'success' });
                            })
                          }
                        >
                          Send acknowledgement
                        </Button>
                        <Button
                          data-testid="owner-reply-cancel"
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyTo(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      data-testid={`owner-reply-${s.id}`}
                      size="sm"
                      variant="secondary"
                      className="mt-2.5"
                      onClick={() => {
                        setReplyTo(s.id);
                        setReply(replies[0]?.text ?? '');
                      }}
                    >
                      Send thanks
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
        {unanswered.length ? (
          <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
            {unanswered.length === 1 ? 'One guest is' : `${unanswered.length} guests are`} still waiting to hear back.
            They see the reply as a message from Jalsa, not from a system.
          </p>
        ) : null}
      </section>
    </div>
  );
}

/* ── Starting a round from the owner's floor ───────────────────────────── */

/**
 * NewRoundSheet — the owner seats a walk-in and sends its first round.
 *
 * WHY A SHEET AND NOT A SCREEN
 *   The captain's phone has a whole ordering screen because ordering is what that phone is for.
 *   The owner does this rarely, for the table nobody is on the floor for, and leaving the
 *   dashboard to do it would lose the floor they were looking at. A sheet keeps the answer to
 *   "which table am I seating" on screen the whole time.
 *
 * WHY IT SENDS ONE REQUEST AND NOT TWO
 *   There is no "open the bill" step. `add-round` opens it, because a bill opened by a separate
 *   call is a bill that can be left open by a cart nobody sends — an empty tab on a table nobody
 *   is sitting at, which someone then has to notice and free. Nothing exists until food is
 *   ordered, and then everything does.
 *
 * SOLD-OUT ITEMS ARE SHOWN, NOT HIDDEN
 *   The same choice the captain's screen makes. An owner looking for a dish needs to learn that
 *   it is off tonight; a dish that silently vanishes reads as a bug in the menu.
 */
function NewRoundSheet({
  table,
  onClose,
  menu,
  categories,
  grants,
  welcomeDrinks,
  send,
  runBusy,
  busy,
  go,
}: {
  table: OwnerPayload['floor'][number] | null;
  onClose: () => void;
  menu: OwnerPayload['menu'];
  categories: OwnerPayload['categories'];
  grants: OwnerPayload['grants'];
  welcomeDrinks: WelcomeDrinksConfig;
  send: OwnerSectionProps['send'];
  runBusy: OwnerSectionProps['runBusy'];
  busy: boolean;
  go: OwnerSectionProps['go'];
}) {
  const toast = useToast();
  const [query, setQuery] = React.useState('');
  const [cart, setCart] = React.useState<Record<string, number>>({});

  const filtered = menu.filter((m) => {
    const q = query.trim().toLowerCase();
    return !q || `${m.name} ${m.category}`.toLowerCase().includes(q);
  });

  // This sheet only ever opens a free table, so every round from it is a first order (D1).
  const welcome = welcomeDrinksToOffer(welcomeDrinks, true, menu);
  const lines = Object.entries(cart).filter(([, n]) => n > 0);
  const count = lines.reduce((a, [, n]) => a + n, 0);
  const value = lines.reduce((a, [id, n]) => a + (menu.find((m) => m.id === id)?.price ?? 0) * n, 0);

  return (
    <Sheet
      open={table !== null}
      onOpenChange={(open) => !open && onClose()}
      title={table ? `New round · ${table.name}` : 'New round'}
      description={
        table
          ? `Seats ${table.seats} · the bill opens when this round is sent, and the round goes to the kitchen.`
          : ''
      }
      testId="owner-new-round"
      footer={
        <Button
          data-testid="owner-new-round-send"
          size="lg"
          disabled={busy || count === 0 || !table}
          onClick={() =>
            runBusy(async () => {
              if (!table) return;
              const res = await send<{ kotCode: string; refused: string[]; billId: string }>('/api/owner/action', {
                action: 'add-round',
                tableId: table.id,
                lines: lines.map(([menuItemId, qty]) => ({ menuItemId, qty })),
              });
              onClose();
              toast.show(`${res.kotCode} sent to the kitchen · ${table.name}`, { tone: 'success' });
              // Straight to the bill this just opened, so the next thing the owner does — a
              // second round, the closure — is one tap away rather than a hunt on the floor.
              go('orders', res.billId);
            })
          }
        >
          {count === 0 ? 'Pick something first' : `Send · ${count === 1 ? '1 item' : `${count} items`} · ${rupees(value)}`}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {/* A walk-in's party size is not known yet: one of each, adjustable on the rows below. */}
        <WelcomeDrinksOffer drinks={welcome} guests={1} cart={cart} onCart={setCart} testIdPrefix="owner-new-round" />
        <Input
          data-testid="owner-new-round-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the menu"
          aria-label="Search the menu"
        />
        {/* A dish the menu does not list yet (E1) - only for someone who may add one. */}
        {canAddDish(grants) ? (
          <NewDishOffer
            query={query}
            menu={menu}
            categories={categories}
            disabled={busy}
            testIdPrefix="owner-new-round"
            onCreate={(dish) => send<NewDishSaved>('/api/owner/action', { action: 'add-dish', ...dish })}
            onAdded={(saved, dish) => {
              const next = afterDishSaved(cart, saved, dish.name);
              setCart(next.cart);
              setQuery(dish.name);
              toast.show(next.message, { tone: next.tone });
            }}
          />
        ) : null}
        <ul className="m-0 flex max-h-[50vh] list-none flex-col gap-2 overflow-y-auto p-0">
          {filtered.map((m) => {
            const qty = cart[m.id] ?? 0;
            return (
              <li key={m.id}>
                <Card className={cn('flex items-center gap-3 p-3', !m.available && 'opacity-60')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-body font-semibold">{m.name}</span>
                    <span className="block type-caption text-[var(--text-muted)]">
                      {m.available ? `${m.category} · ${m.priceLabel}` : 'Out of stock — off the menu tonight'}
                    </span>
                  </span>
                  {m.available ? (
                    <span className="flex items-center gap-2">
                      {qty > 0 ? (
                        <Button
                          data-testid={`owner-new-round-less-${m.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => setCart((c) => ({ ...c, [m.id]: Math.max(0, qty - 1) }))}
                          aria-label={`One less ${m.name}`}
                        >
                          −
                        </Button>
                      ) : null}
                      {qty > 0 ? <span className="type-body font-semibold tabular-nums">{qty}</span> : null}
                      <Button
                        data-testid={`owner-new-round-add-${m.id}`}
                        size="icon"
                        onClick={() => setCart((c) => ({ ...c, [m.id]: qty + 1 }))}
                        aria-label={`Add ${m.name}`}
                      >
                        +
                      </Button>
                    </span>
                  ) : (
                    <Pill tone="neutral">Sold out</Pill>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
            Nothing on the menu matches that.
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
