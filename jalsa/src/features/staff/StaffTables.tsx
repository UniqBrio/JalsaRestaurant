'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, Chip, ChipRow, FoodMark, Pill, SectionLabel, Stepper } from '@/components/ui/atoms';
import { IdentitySpine, TotalsBlock } from '@/components/ui/bill';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { FirstRunState } from '@/components/ui/states';
import { Field, Input, SearchField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import { tableIsFreeable } from '@/lib/status';
import type { Tone } from '@/lib/status';
import type { StaffScreenProps } from './StaffApp';

/**
 * The floor, one bill, and adding a round to it — screens 15 to 20 of the design set.
 *
 * THE FIVE IDENTIFIERS ARE THE FIRST THING ON THE BILL SCREEN, always, in the same order. Staff
 * cross-reference between screens constantly; a spine that moves is a spine nobody trusts
 * (Standard 6.3).
 *
 * THE CANCEL GATE IS THE KITCHEN, NOT THE PERSON. Before the kitchen starts, a captain cancels.
 * After it starts, the same tap becomes a request to the owner — and the sheet says which, in
 * words, before it is tapped.
 */

const CANCEL_REASONS = [
  'Guest changed their mind',
  'Ordered by mistake',
  'Taking too long',
  'Wrong item',
  'Out of stock',
] as const;

const PAYMENT_MODES = ['Cash', 'Digital / UPI', 'Card'] as const;

/* ── 15. The floor ─────────────────────────────────────────────────────── */

export function FloorScreen({ data, go, send, runBusy, busy }: StaffScreenProps) {
  const toast = useToast();
  const live = data.tables.filter((t) => t.billId !== null);
  const free = data.tables.filter((t) => t.billId === null && t.active);

  /* The same grant the owner holds, doing the same thing on the captain's floor. `tables.free`
     is not a role — the owner hands it to whoever they trust with it, and this screen simply
     asks whether this person has it. A table is offered only where the server would allow it
     (no rounds, something actually attached): offering an action that is then refused is worse
     than never offering it (Standard 5.6). */
  const canFree = data.grants.includes('tables.free');
  const [freeing, setFreeing] = React.useState<(typeof data.tables)[number] | null>(null);

  return (
    <div className="flex flex-col gap-4" data-testid="staff-floor">
      {live.length === 0 ? (
        <FirstRunState
          title="Nothing open yet"
          note="When a table scans its code and sends a round, it appears here with what it is waiting for."
          testId="staff-floor-empty"
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
          {live.map((t) => (
            <li key={t.id}>
              <button
                data-testid={`staff-table-${t.name}`}
                type="button"
                onClick={() => t.billId && go('table', t.billId)}

                className={cn(
                  'flex h-full w-full flex-col gap-1 rounded-[var(--radius-lg)] p-3.5 text-left shadow-[var(--shadow-card)] transition-transform',
                  'hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                  toneSurface(t.tone)
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[17px] font-bold">{t.name}</span>
                  <span aria-hidden className="text-[13px]">
                    {t.openRequests > 0 ? '🔔' : t.hasOccasion ? '🎂' : t.groupCode ? '◆' : ''}
                  </span>
                </span>
                <span className="text-[11.5px] font-semibold">{t.stateLabel}</span>
                <span className="text-[11px] opacity-80">
                  {t.groupCode
                    ? `${t.groupCode} · ${t.guests} guests`
                    : `${t.guests} guests · ${t.roundCount === 1 ? '1 round' : `${t.roundCount} rounds`}`}
                </span>
                <span className="mt-auto pt-1 text-[13px] font-bold tabular-nums">
                  {data.isWaiter
                    ? t.readyCount > 0
                      ? `${t.readyCount} to run`
                      : 'nothing to run'
                    : (t.totalLabel ?? '—')}
                </span>
              </button>

              {canFree && tableIsFreeable(t) ? (
                <Button
                  data-testid={`staff-free-table-${t.name}`}
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
      )}

      <Sheet
        open={freeing !== null}
        onOpenChange={(v) => !v && setFreeing(null)}
        title={freeing ? `Mark table ${freeing.name} free?` : 'Mark this table free?'}
        description="For a party that left without ordering — a wrong table, a change of mind, a phone that walked out with a cart on it."
        testId="staff-free-table-sheet"
        footer={
          <>
            <Button data-testid="staff-free-table-cancel" variant="ghost" onClick={() => setFreeing(null)}>
              Cancel
            </Button>
            <Button
              data-testid="staff-free-table-confirm"
              disabled={busy}
              onClick={() => {
                const t = freeing;
                if (!t) return;
                runBusy(async () => {
                  await send('/api/staff/action', { action: 'free-table', tableId: t.id });
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
        <p className="m-0 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          Anything that phone had chosen and not sent is discarded, and the next scan starts fresh. If a round has
          already gone to the kitchen this will be refused — that is a payment or a void, not a floor operation.
        </p>
      </Sheet>

      <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        Amber means the kitchen has work, green means a round is ready. A bell is an unanswered request, ◆ a grouped
        bill, 🎂 an occasion.
      </p>

      {free.length ? (
        <div>
          <SectionLabel>Free right now</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {free.map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-muted)] shadow-[var(--shadow-card)]"
              >
                {t.name} · {t.seats}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toneSurface(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'bg-[var(--success-surface)] text-[var(--on-success-surface)]';
    case 'warning':
      return 'bg-[var(--warning-surface)] text-[var(--on-warning-surface)]';
    case 'primary':
      return 'bg-[var(--primary)] text-[var(--on-primary)]';
    case 'info':
      return 'bg-[var(--info-surface)] text-[var(--on-info-surface)]';
    case 'error':
      return 'bg-[var(--error-surface)] text-[var(--on-error-surface)]';
    default:
      return 'bg-[var(--surface)] text-[var(--text-body)]';
  }
}

/* ── 16-19. One bill: rounds, quantities, cancellations, closure ───────── */

export function TableScreen({ data, go, selectedBillId, send, runBusy, busy }: StaffScreenProps) {
  const toast = useToast();
  const bill = data.bills.find((b) => b.id === selectedBillId) ?? null;

  const [qtyTarget, setQtyTarget] = React.useState<{
    id: string;
    name: string;
    qty: number;
    was: number;
    started: boolean;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<{
    id: string;
    name: string;
    qty: number;
    started: boolean;
  } | null>(null);
  const [cancelReason, setCancelReason] = React.useState<string>(CANCEL_REASONS[0]);
  const [closing, setClosing] = React.useState(false);
  const [mode, setMode] = React.useState<string>(PAYMENT_MODES[1]);
  const [reference, setReference] = React.useState('');
  const [discountPct, setDiscountPct] = React.useState('');

  if (!bill) {
    return (
      <FirstRunState
        title="That bill is no longer open"
        note="It has been closed, or moved to another table. Your floor is one tap away."
        action={{ label: 'Back to my tables', onClick: () => go('floor'), testId: 'staff-table-back' }}
        testId="staff-table-missing"
      />
    );
  }

  const canEdit = data.grants.includes('orders.qty_change');
  const canAdd = data.grants.includes('orders.add_items');
  const canReprint = data.grants.includes('orders.reprint');
  const canClose = data.grants.includes('bill.record_payment');
  const canServe = data.grants.includes('orders.status');

  return (
    <div className="flex flex-col gap-4" data-testid="staff-table">
      <IdentitySpine fields={bill.spine} />

      {bill.groupCode ? (
        <p className="m-0 rounded-[var(--radius-md)] bg-[var(--info-surface)] px-4 py-2.5 text-[12px] leading-relaxed text-[var(--on-info-surface)]">
          One bill across {bill.tables.length} tables — {bill.tables.join(', ')} · host {bill.hostTable}. Every round
          is still its own ticket, tagged with the table it came from.
        </p>
      ) : null}

      {bill.occasion ? (
        <p className="m-0 rounded-[var(--radius-md)] bg-[var(--primary-surface)] px-4 py-2.5 text-[12px] font-semibold text-[var(--on-primary-surface)]">
          🎂 {bill.occasion} — bring the dessert with a candle at the end
        </p>
      ) : null}

      <div>
        <SectionLabel>Rounds sent to the kitchen</SectionLabel>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {bill.kots.map((k) => (
            <li key={k.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12.5px] font-bold">
                    {k.code} <span className="font-normal text-[var(--text-muted)]">· {k.placedAt}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {k.printStatus === 'failed' ? (
                      // Standard 5.7: the order exists, the failure is on the record, and the
                      // retry is right here — not in a log nobody opens.
                      <Pill tone="error">Print failed</Pill>
                    ) : null}
                    {k.reprintCount > 0 ? <Pill tone="neutral">Reprinted ×{k.reprintCount}</Pill> : null}
                    <Pill tone={k.tone}>{k.statusWord}</Pill>
                  </div>
                </div>
                <p className="m-0 mt-1 text-[11px] text-[var(--text-muted)]">
                  {bill.groupCode ? `from Table ${k.fromTable} · ` : ''}
                  {k.source === 'guest' ? 'guest phone' : k.placedBy} ·{' '}
                  {k.printStatus === 'printed' ? 'printed to kitchen' : 'not printed'}
                </p>

                <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
                  {k.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2.5">
                      <FoodMark type={i.foodType} />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13px]',
                          i.cancelled && 'text-[var(--text-muted)] line-through'
                        )}
                      >
                        {i.name}
                        {i.cancelled ? (
                          <span className="ml-1.5 text-[11px] no-underline">— {i.cancelReason.toLowerCase()}</span>
                        ) : null}
                      </span>
                      <span className="text-[12.5px] tabular-nums text-[var(--text-muted)]">
                        ×{i.qty}
                        {i.qtyBefore !== null && i.qtyBefore !== i.qty ? (
                          <span className="ml-1 text-[10.5px]">(was {i.qtyBefore})</span>
                        ) : null}
                      </span>
                      {!i.cancelled && canEdit ? (
                        <>
                          <Button
                            data-testid={`staff-qty-${i.id}`}
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setQtyTarget({
                                id: i.id,
                                name: i.name,
                                qty: i.qty,
                                was: i.qty,
                                started: k.kitchenStarted,
                              })
                            }
                          >
                            Qty
                          </Button>
                          <Button
                            data-testid={`staff-cancel-${i.id}`}
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setCancelTarget({ id: i.id, name: i.name, qty: i.qty, started: k.kitchenStarted })
                            }
                          >
                            Cancel
                          </Button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canServe && (k.status === 'ready' || k.status === 'picked_up') ? (
                    <Button
                      data-testid={`staff-serve-${k.id}`}
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        runBusy(async () => {
                          await send('/api/staff/action', { action: 'advance-kot', kotId: k.id, to: 'served' });
                          toast.show(`${k.code} served at ${k.fromTable} · ${data.me.name}`, { tone: 'success' });
                        })
                      }
                    >
                      Mark served
                    </Button>
                  ) : null}
                  {canReprint ? (
                    <Button
                      data-testid={`staff-reprint-${k.id}`}
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        runBusy(async () => {
                          await send('/api/staff/action', { action: 'reprint', kotId: k.id });
                          toast.show(`${k.code} reprinted — stamped REPRINT · ${data.me.name}`);
                        })
                      }
                    >
                      Reprint
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      {bill.totals ? (
        <Card>
          <TotalsBlock rows={bill.totals} testId="staff-bill-totals" />
        </Card>
      ) : (
        <p
          className="m-0 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 text-[12px] leading-relaxed text-[var(--text-muted)]"
          data-testid="staff-money-hidden"
        >
          Bill amounts are hidden for waiters. {bill.spine.captain} or Javeed closes the bill.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {canAdd ? (
          <Button data-testid="staff-add-items" onClick={() => go('menu', bill.id)}>
            Add items for this table
          </Button>
        ) : null}
        {canClose ? (
          <Button data-testid="staff-open-close" variant="secondary" onClick={() => setClosing(true)}>
            {bill.groupCode ? 'Close group bill' : 'Close bill'}
          </Button>
        ) : null}
      </div>

      {/* Quantity */}
      <Sheet
        open={qtyTarget !== null}
        onOpenChange={(o) => !o && setQtyTarget(null)}
        title="Change quantity"
        description={qtyTarget ? `${qtyTarget.name} · was ${qtyTarget.was}` : ''}
        testId="staff-qty-sheet"
        footer={
          <>
            <Button data-testid="staff-qty-cancel" variant="ghost" onClick={() => setQtyTarget(null)}>
              Cancel
            </Button>
            <Button
              data-testid="staff-qty-save"
              disabled={busy || !qtyTarget}
              onClick={() =>
                qtyTarget &&
                runBusy(async () => {
                  await send('/api/staff/action', {
                    action: 'change-qty',
                    kotItemId: qtyTarget.id,
                    qty: qtyTarget.qty,
                  });
                  toast.show(`${qtyTarget.name} → ${qtyTarget.qty}${qtyTarget.started ? ' · ticket reprinted' : ''}`);
                  setQtyTarget(null);
                })
              }
            >
              {qtyTarget?.started ? 'Save and reprint' : 'Save'}
            </Button>
          </>
        }
      >
        {qtyTarget ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <Stepper
              qty={qtyTarget.qty}
              onDecrease={() => setQtyTarget((t) => (t ? { ...t, qty: Math.max(1, t.qty - 1) } : t))}
              onIncrease={() => setQtyTarget((t) => (t ? { ...t, qty: t.qty + 1 } : t))}
              testIdPrefix="staff-qty-step"
              label={qtyTarget.name}
            />
            <p className="m-0 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
              {qtyTarget.started
                ? 'The kitchen has started this round. Changing it reprints the ticket with the change marked, and Javeed sees it in the audit log.'
                : 'The kitchen has not started. The ticket reprints cleanly with your name on the change.'}
            </p>
          </div>
        ) : null}
      </Sheet>

      {/* Cancel */}
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title={cancelTarget?.started ? 'Ask Javeed to cancel' : 'Cancel this item'}
        confirmLabel={cancelTarget?.started ? 'Ask Javeed to cancel' : 'Cancel the item'}
        reasons={CANCEL_REASONS}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        busy={busy}
        testId="staff-cancel-sheet"
        consequence={
          cancelTarget ? (
            <>
              <p className="m-0 font-semibold">
                {cancelTarget.name} ×{cancelTarget.qty}
              </p>
              <p
                className={cn(
                  'm-0 mt-2 rounded-[var(--radius-md)] px-3 py-2.5 text-[12.5px] leading-relaxed',
                  cancelTarget.started
                    ? 'bg-[var(--warning-surface)] text-[var(--on-warning-surface)]'
                    : 'bg-[var(--success-surface)] text-[var(--on-success-surface)]'
                )}
              >
                {cancelTarget.started
                  ? 'Cooking has started. You do not have permission to cancel now — this sends a request to Javeed and he decides.'
                  : 'The kitchen has not started this dish. You can cancel it yourself, and it comes off the bill immediately.'}
              </p>
            </>
          ) : null
        }
        onConfirm={() =>
          cancelTarget &&
          runBusy(async () => {
            const res = await send<{ outcome: 'cancelled' | 'escalated' }>('/api/staff/action', {
              action: 'cancel-item',
              kotItemId: cancelTarget.id,
              reason: cancelReason,
            });
            toast.show(
              res.outcome === 'escalated'
                ? `Sent to Javeed — ${cancelReason.toLowerCase()}`
                : `${cancelTarget.name} cancelled — ${cancelReason.toLowerCase()} · ${data.me.name}`,
              { tone: res.outcome === 'escalated' ? 'neutral' : 'success' }
            );
            setCancelTarget(null);
          })
        }
      />

      {/* Closure */}
      <Sheet
        open={closing}
        onOpenChange={setClosing}
        title={bill.groupCode ? `Close group ${bill.groupCode}` : `Close ${bill.code}`}
        description={`${bill.tables.join(', ')} · recorded against your name`}
        testId="staff-close-sheet"
        footer={
          <>
            <Button data-testid="staff-close-cancel" variant="ghost" onClick={() => setClosing(false)}>
              Cancel
            </Button>
            <Button
              data-testid="staff-close-confirm"
              disabled={busy}
              onClick={() =>
                runBusy(async () => {
                  const pct = Number(discountPct);
                  const res = await send<{ payable: number }>('/api/staff/action', {
                    action: 'close-bill',
                    billId: bill.id,
                    mode,
                    reference,
                    ...(Number.isFinite(pct) && pct > 0 ? { discountPct: pct } : {}),
                  });
                  toast.show(
                    `${bill.code} closed · ${rupees(res.payable)} ${mode.toLowerCase()} · ${bill.tables.length > 1 ? `${bill.tables.length} tables` : `Table ${bill.tables[0]}`} to be cleared`,
                    { tone: 'success' }
                  );
                  setClosing(false);
                  go('floor');
                })
              }
            >
              Record {mode.toLowerCase()} payment
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {bill.totals ? <TotalsBlock rows={bill.totals} testId="staff-close-totals" /> : null}

          <div>
            <SectionLabel>Paid by</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.map((m) => (
                <Chip
                  key={m}
                  on={mode === m}
                  onClick={() => setMode(m)}
                  data-testid={`staff-mode-${m.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                >
                  {m}
                </Chip>
              ))}
            </div>
          </div>

          {data.grants.includes('bill.disc_pct') ? (
            <Field label="Discount %" htmlFor="staff-discount" hint="Recorded with your name and the time.">
              <Input
                id="staff-discount"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                data-testid="staff-discount"
              />
            </Field>
          ) : null}

          <Field label="Reference" htmlFor="staff-reference" hint="Optional — a UPI reference or a receipt number.">
            <Input
              id="staff-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              data-testid="staff-reference"
            />
          </Field>

          <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
            Recorded against your name. Javeed sees it on his dashboard immediately, the tip posts to its own ledger,
            and every table on this bill is freed at once.
          </p>
        </div>
      </Sheet>
    </div>
  );
}

/* ── 17. Add items for a table ─────────────────────────────────────────── */

export function AddItemsScreen({ data, go, selectedBillId, send, runBusy, busy }: StaffScreenProps) {
  const toast = useToast();
  const bill = data.bills.find((b) => b.id === selectedBillId) ?? null;
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('All');
  const [cart, setCart] = React.useState<Record<string, number>>({});

  if (!bill) {
    return (
      <FirstRunState
        title="No bill selected"
        note="Open a table first — a round has to belong to a bill."
        action={{ label: 'My tables', onClick: () => go('floor'), testId: 'staff-add-back' }}
        testId="staff-add-missing"
      />
    );
  }

  const tableId =
    data.tables.find((t) => t.name === bill.hostTable)?.id ?? data.tables.find((t) => t.billId === bill.id)?.id;

  const filtered = data.menu.filter((m) => {
    if (category !== 'All' && m.category !== category) return false;
    const q = query.trim().toLowerCase();
    return !q || `${m.name} ${m.category}`.toLowerCase().includes(q);
  });

  const count = Object.values(cart).reduce((a, n) => a + n, 0);
  const value = Object.entries(cart).reduce((a, [id, n]) => {
    const item = data.menu.find((m) => m.id === id);
    return a + (item ? item.price * n : 0);
  }, 0);

  return (
    <div className="flex flex-col gap-3" data-testid="staff-add-items">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search the menu"
        resultCount={filtered.length}
        testId="staff-menu-search"
      />

      <ChipRow>
        {['All', ...data.categories].map((c) => (
          <Chip
            key={c}
            on={category === c}
            onClick={() => setCategory(c)}
            data-testid={`staff-cat-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          >
            {c}
          </Chip>
        ))}
      </ChipRow>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {filtered.map((m) => {
          const qty = cart[m.id] ?? 0;
          return (
            <li key={m.id}>
              <Card className={cn('flex items-center gap-3 p-3', !m.available && 'opacity-60')}>
                <FoodMark type={m.foodType} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{m.name}</span>
                  <span className="block text-[11.5px] text-[var(--text-muted)]">
                    {m.available ? `${m.category} · ${m.priceLabel}` : 'Out of stock — off the customer menu'}
                  </span>
                </span>
                {m.available ? (
                  qty > 0 ? (
                    <Stepper
                      qty={qty}
                      onDecrease={() => setCart((c) => ({ ...c, [m.id]: Math.max(0, qty - 1) }))}
                      onIncrease={() => setCart((c) => ({ ...c, [m.id]: qty + 1 }))}
                      testIdPrefix={`staff-add-qty-${m.id}`}
                      label={m.name}
                    />
                  ) : (
                    <Button
                      data-testid={`staff-add-${m.id}`}
                      size="icon"
                      onClick={() => setCart((c) => ({ ...c, [m.id]: 1 }))}
                      aria-label={`Add ${m.name}`}
                    >
                      +
                    </Button>
                  )
                ) : (
                  <Pill tone="neutral">Sold out</Pill>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {count > 0 && tableId ? (
        <div
          className="fixed inset-x-0 bottom-[var(--layout-bottom-chrome-height)] z-30 mx-auto max-w-[38rem] border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          data-testid="staff-add-bar"
        >
          <Button
            data-testid="staff-send-round"
            size="lg"
            disabled={busy}
            onClick={() =>
              runBusy(async () => {
                const lines = Object.entries(cart)
                  .filter(([, n]) => n > 0)
                  .map(([menuItemId, qty]) => ({ menuItemId, qty }));
                const res = await send<{ kotCode: string; refused: string[] }>('/api/staff/action', {
                  action: 'add-round',
                  tableId,
                  billId: bill.id,
                  lines,
                });
                setCart({});
                toast.show(
                  `${res.kotCode} sent to the kitchen · ${lines.length === 1 ? '1 line' : `${lines.length} lines`}`,
                  { tone: 'success' }
                );
                go('table', bill.id);
              })
            }
          >
            Send · {count === 1 ? '1 item' : `${count} items`} · {rupees(value)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
