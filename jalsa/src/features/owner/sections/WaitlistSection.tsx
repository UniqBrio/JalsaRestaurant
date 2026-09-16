'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Pill, SectionLabel } from '@/components/ui/atoms';
import { Sheet, ConfirmDialog } from '@/components/ui/sheet';
import { Field, Input, Select } from '@/components/ui/field';
import { FirstRunState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';

/**
 * The entrance queue — the one screen in Jalsa with a person physically standing in front of it.
 *
 * WHY THE ORDER IS NOT NEGOTIABLE AND NOT LOCAL
 *   Position comes from the server, computed from joined_at, and so does the wait in minutes.
 *   Both could trivially be worked out in the browser, and both would then be wrong on the one
 *   device whose clock is four minutes fast — which is how a calm queue becomes an argument at
 *   the door. One clock, one order, every screen agreeing.
 *
 * THE TOKEN, THE PAIR AND THE CODE ARE THREE DIFFERENT HANDLES FOR ONE PARTY
 *   W-18 is what the host writes down. "Amber Lotus" is what gets CALLED across a full room,
 *   because 4821 and 4831 sound identical at twenty feet and a surname is neither ours to ask
 *   for nor pleasant to shout. 4821 is what the guest reads back to claim their turn. All three
 *   are on the row because all three are used, by different people, seconds apart.
 *
 * SEATING DOES NOT OPEN A BILL
 *   It stamps this row and stops. The captain opens the bill when they take the first order —
 *   there is exactly one way that happens, and a queue that could do it too would eventually
 *   disagree with it about a table that already has a party on it.
 */
export function WaitlistSection({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [adding, setAdding] = React.useState(false);
  const [partySize, setPartySize] = React.useState('2');
  const [pair, setPair] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [source, setSource] = React.useState<'walk_in' | 'scanned'>('walk_in');
  const [seating, setSeating] = React.useState<{ id: string; token: string; partySize: number } | null>(null);
  const [removing, setRemoving] = React.useState<{ id: string; token: string } | null>(null);
  const [removeReason, setRemoveReason] = React.useState('They left');

  const queue = data.waitlist;
  const canSeat = data.grants.includes('queue.seat');
  const canNotify = data.grants.includes('queue.notify');
  const canClear = data.grants.includes('queue.clear');
  const canAdd = data.grants.includes('queue.walkin');

  // Seatable now: on the floor plan, no open bill, and not waiting to be wiped. Ordered by seat
  // count so the host's eye lands on the tables that actually fit.
  const free = data.floor
    .filter((t) => t.active && !t.billId && t.clearing === null)
    .sort((a, b) => b.seats - a.seats);

  const heads = queue.reduce((a, w) => a + w.partySize, 0);
  const longest = queue.length ? Math.max(...queue.map((w) => w.waitedMinutes)) : 0;

  return (
    <div className="flex flex-col gap-4" data-testid="owner-waitlist">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <SectionLabel className="mb-0">
          {queue.length === 1 ? '1 party waiting' : `${queue.length} parties waiting`}
        </SectionLabel>
        {canAdd ? (
          <Button data-testid="owner-queue-add" size="sm" onClick={() => setAdding(true)}>
            Add a walk-in
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <MetricTile
          label="Parties waiting"
          value={String(queue.length)}
          note={`${heads} ${heads === 1 ? 'person' : 'people'}`}
          testId="owner-queue-parties"
        />
        <MetricTile
          label="Longest wait"
          value={longest ? `${longest} min` : '—'}
          note={longest >= 20 ? 'Somebody has been standing a while' : 'Within the usual'}
          testId="owner-queue-longest"
          tone={longest >= 20 ? 'warning' : 'neutral'}
        />
        <MetricTile
          label="Called to the door"
          value={String(queue.filter((w) => w.notified).length)}
          note="Told their table is ready"
          testId="owner-queue-notified"
        />
      </div>

      {queue.length === 0 ? (
        <FirstRunState
          title="Nobody is waiting"
          note="Parties appear here the moment they scan the entrance code or the host adds a walk-in. An empty queue on a Friday usually means the code is not where people can see it."
          testId="owner-queue-empty"
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {queue.map((w) => (
            <li key={w.id}>
              <Card className="flex flex-wrap items-center gap-3">
                <span className="w-7 shrink-0 type-caption font-bold text-[var(--text-muted)] tabular-nums">
                  {w.position}
                </span>

                <span className="min-w-[10rem] flex-1">
                  <span className="block type-body font-semibold">
                    {w.token}
                    {w.pair ? ` · ${w.pair}` : ''}
                  </span>
                  <span className="block type-caption text-[var(--text-muted)]">
                    {w.partySize} {w.partySize === 1 ? 'guest' : 'guests'} · joined {w.joinedAt} ·{' '}
                    {w.source === 'scanned' ? 'scanned the code' : 'walk-in'}
                  </span>
                </span>

                <span className="shrink-0 type-caption font-bold tracking-[0.1em] text-[var(--primary)] tabular-nums">
                  {w.code}
                </span>

                <span className="shrink-0 type-caption tabular-nums text-[var(--text-muted)]">
                  {w.waitedMinutes} min
                </span>

                <Pill tone={w.notified ? 'success' : w.waitedMinutes >= 20 ? 'warning' : 'neutral'}>
                  {w.notified ? 'Called' : w.waitedMinutes >= 20 ? 'Waiting a while' : 'Waiting'}
                </Pill>

                <span className="flex shrink-0 gap-1">
                  {canNotify && !w.notified ? (
                    <Button
                      data-testid={`owner-queue-notify-${w.id}`}
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        runBusy(async () => {
                          await send('/api/owner/action', { action: 'notify-waitlist', id: w.id });
                          toast.show(`${w.token} called to the door`, { tone: 'success' });
                        })
                      }
                    >
                      Call them
                    </Button>
                  ) : null}
                  {canSeat ? (
                    <Button
                      data-testid={`owner-queue-seat-${w.id}`}
                      size="sm"
                      disabled={busy}
                      onClick={() => setSeating({ id: w.id, token: w.token, partySize: w.partySize })}
                    >
                      Seat
                    </Button>
                  ) : null}
                  {canClear ? (
                    <Button
                      data-testid={`owner-queue-remove-${w.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoving({ id: w.id, token: w.token })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* WHICH TABLE — the design says "seating reads each table's seat count", and the guest's
          own screen names the table they were sent to. Tables too small for the party are still
          offered but marked: a host seating six at a four-top is making a judgement about two
          chairs pulled across, not making a mistake the screen should block. */}
      <Sheet
        open={seating !== null}
        onOpenChange={(o) => !o && setSeating(null)}
        posture="modal"
        title={seating ? `Seat ${seating.token}` : 'Seat'}
        description={
          seating
            ? `${seating.partySize} ${seating.partySize === 1 ? 'guest' : 'guests'} · the captain opens the bill at the table`
            : ''
        }
        testId="owner-queue-seat-sheet"
        footer={
          <Button data-testid="owner-queue-seat-cancel" variant="ghost" onClick={() => setSeating(null)}>
            Cancel
          </Button>
        }
      >
        {seating ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {free.length === 0 ? (
              <li className="type-body text-[var(--text-muted)]">
                Every table is taken or waiting to be cleared. Clear one first, or seat this party by hand once a
                table frees up.
              </li>
            ) : (
              free.map((t) => (
                <li key={t.id}>
                  <Button
                    data-testid={`owner-queue-seat-at-${t.id}`}
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    className="w-full justify-between"
                    onClick={() =>
                      runBusy(async () => {
                        await send('/api/owner/action', {
                          action: 'seat-waitlist',
                          id: seating.id,
                          tableId: t.id,
                        });
                        setSeating(null);
                        toast.show(`${seating.token} seated at ${t.name}`, { tone: 'success' });
                      })
                    }
                  >
                    <span>
                      {t.name} · {t.zone}
                    </span>
                    <span className={t.seats < seating.partySize ? 'text-[var(--warning)]' : ''}>
                      {t.seats} {t.seats === 1 ? 'seat' : 'seats'}
                      {t.seats < seating.partySize ? ' · tight' : ''}
                    </span>
                  </Button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </Sheet>

      <Sheet
        open={adding}
        onOpenChange={(o) => !o && setAdding(false)}
        posture="modal"
        title="Add a walk-in"
        description="A party at the door who did not scan the entrance code."
        testId="owner-queue-sheet"
        footer={
          <>
            <Button data-testid="owner-queue-cancel" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-queue-save"
              disabled={busy || !partySize || Number(partySize) < 1}
              onClick={() =>
                runBusy(async () => {
                  const res = await send<{ token: string; code: string }>('/api/owner/action', {
                    action: 'join-waitlist',
                    partySize: Number(partySize) || 1,
                    pair,
                    phone,
                    source,
                  });
                  setAdding(false);
                  setPair('');
                  setPhone('');
                  setPartySize('2');
                  toast.show(`${res.token} added · code ${res.code} — read it back to them`, { tone: 'success' });
                })
              }
            >
              Add to the queue
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Field label="How many" required htmlFor="owner-queue-size" className="min-w-[8rem] flex-1">
              <Input
                id="owner-queue-size"
                type="number"
                inputMode="numeric"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                data-testid="owner-queue-size"
              />
            </Field>
            <Field label="How they arrived" htmlFor="owner-queue-source" className="min-w-[10rem] flex-1">
              <Select
                id="owner-queue-source"
                value={source}
                onChange={(e) => setSource(e.target.value as 'walk_in' | 'scanned')}
                data-testid="owner-queue-source"
              >
                <option value="walk_in">Walk-in</option>
                <option value="scanned">Scanned the code</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Name to call"
            htmlFor="owner-queue-pair"
            hint="Two words carry across a full room in a way four digits do not. Left empty, the token is called instead."
          >
            <Input
              id="owner-queue-pair"
              value={pair}
              placeholder="Amber Lotus"
              onChange={(e) => setPair(e.target.value)}
              data-testid="owner-queue-pair"
            />
          </Field>

          <Field label="Phone" htmlFor="owner-queue-phone" hint="Optional. Only used to call this party to the door.">
            <Input
              id="owner-queue-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="owner-queue-phone"
            />
          </Field>
        </div>
      </Sheet>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Take this party off the queue"
        confirmLabel="Remove them"
        reasons={['They left', 'Seated elsewhere', 'Added twice', 'Changed their mind']}
        reason={removeReason}
        onReasonChange={setRemoveReason}
        busy={busy}
        testId="owner-queue-remove"
        consequence={
          removing ? (
            <p className="m-0 leading-relaxed">
              <strong>{removing.token}</strong> comes off the queue and everyone behind them moves up. The entry is
              kept, marked removed, with your name and this reason — so tonight&rsquo;s waiting times stay true.
            </p>
          ) : null
        }
        onConfirm={() =>
          removing &&
          runBusy(async () => {
            await send('/api/owner/action', { action: 'remove-waitlist', id: removing.id, reason: removeReason });
            toast.show(`${removing.token} removed — ${removeReason.toLowerCase()}`, { tone: 'success' });
            setRemoving(null);
          })
        }
      />
    </div>
  );
}
