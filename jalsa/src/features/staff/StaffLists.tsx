'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { FirstRunState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { PERMISSION_GROUPS, permissionLabel } from '@/lib/permissions';
import type { StaffScreenProps } from './StaffApp';

/**
 * Ready, KOTs, Requests and Me — screens 20 and 21 of the design set, plus the two lists that
 * make a service run.
 *
 * READY IS ORDERED BY AGE, NOT BY ARRIVAL. Food goes cold in the order it was plated. A list
 * sorted by "most recent first" is the exact wrong order for the only job it has.
 *
 * A REQUEST OLDER THAN FIVE MINUTES CHANGES COLOUR AND ALSO APPEARS ON THE OWNER'S DASHBOARD.
 * That is the design's escalation, and it is deliberately visible on both screens at once so
 * neither person can assume the other has it (Standard 8.2).
 */

/* ── Ready to run / collect ────────────────────────────────────────────── */

export function ReadyScreen({ data, go, send, runBusy, busy }: StaffScreenProps) {
  const toast = useToast();

  if (data.ready.length === 0) {
    return (
      <FirstRunState
        title="Nothing at the pass"
        note="The moment the kitchen marks a round ready it appears here, oldest first, and on the captain's phone at the same time."
        testId="staff-ready-empty"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="staff-ready">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {data.ready.map(({ kot, tableName, billCode, captain, billId }) => (
          <li key={kot.id}>
            <Card className={cn(kot.status === 'ready' && 'bg-[var(--success-surface)]')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-body font-bold">Table {tableName}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'type-caption font-semibold tabular-nums',
                      kot.ageMinutes > 6 ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'
                    )}
                  >
                    {kot.ageMinutes} min
                  </span>
                  <Pill tone={kot.tone}>{kot.statusWord}</Pill>
                </div>
              </div>
              <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]">
                {kot.code} · {billCode} · {captain}
              </p>

              <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
                {kot.items
                  .filter((i) => !i.cancelled)
                  .map((i) => (
                    <li key={i.id} className="flex items-center gap-2.5 type-body">
                      <FoodMark type={i.foodType} />
                      <span className="min-w-0 flex-1 truncate">{i.name}</span>
                      <span className="tabular-nums text-[var(--text-muted)]">×{i.qty}</span>
                    </li>
                  ))}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                {data.grants.includes('orders.status') ? (
                  <Button
                    data-testid={`staff-ready-advance-${kot.id}`}
                    disabled={busy}
                    onClick={() =>
                      runBusy(async () => {
                        const to = kot.status === 'ready' ? 'picked_up' : 'served';
                        await send('/api/staff/action', { action: 'advance-kot', kotId: kot.id, to });
                        toast.show(
                          to === 'picked_up'
                            ? `${kot.code} picked up from the counter`
                            : `${kot.code} served at ${tableName} · ${data.me.name}`,
                          { tone: 'success' }
                        );
                      })
                    }
                  >
                    {kot.status === 'ready' ? 'Picked up from the counter' : 'On the table — served'}
                  </Button>
                ) : null}
                <Button
                  data-testid={`staff-ready-open-${kot.id}`}
                  variant="ghost"
                  onClick={() => go('table', billId)}
                >
                  Open the table
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        Picked up means it left the counter. Served means it is on the table — that is what unlocks the guest&rsquo;s
        heart button, so it has to be a real tap, not an assumption.
      </p>
    </div>
  );
}

/* ── Every ticket tonight ──────────────────────────────────────────────── */

export function KotsScreen({ data, go, send, runBusy, busy }: StaffScreenProps) {
  const toast = useToast();
  const rows = data.bills
    .flatMap((b) => b.kots.map((k) => ({ k, b })))
    .sort((x, y) => y.k.code.localeCompare(x.k.code));

  if (rows.length === 0) {
    return (
      <FirstRunState
        title="No tickets yet tonight"
        note="Every round sent from a guest's phone, a captain or the owner lands here, newest first, with its print state."
        testId="staff-kots-empty"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="staff-kots">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map(({ k, b }) => (
          <li key={k.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-caption font-bold">
                  {k.code} <span className="font-normal text-[var(--text-muted)]">· {k.placedAt}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {k.printStatus === 'failed' ? <Pill tone="error">Print failed</Pill> : null}
                  <Pill tone={k.tone}>{k.statusWord}</Pill>
                </div>
              </div>
              <p className="m-0 mt-0.5 type-caption text-[var(--text-muted)]">
                Table {k.fromTable} · {b.code} · {b.spine.captain}
                {b.groupCode ? ` · ${b.groupCode}` : ''} · {k.source === 'guest' ? 'guest phone' : k.placedBy}
              </p>
              <p className="m-0 mt-1.5 type-caption leading-relaxed">
                {k.items
                  .filter((i) => !i.cancelled)
                  .map((i) => `${i.name} ×${i.qty}`)
                  .join(' · ')}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {data.grants.includes('orders.reprint') ? (
                  <Button
                    data-testid={`staff-kot-reprint-${k.id}`}
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
                <Button
                  data-testid={`staff-kot-open-${k.id}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => go('table', b.id)}
                >
                  Open table
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        A reprint is stamped REPRINT and recorded against your name, so the kitchen knows it is not a second order.
      </p>
    </div>
  );
}

/* ── Requests ──────────────────────────────────────────────────────────── */

export function RequestsScreen({ data, send, runBusy, busy }: StaffScreenProps) {
  const toast = useToast();

  if (data.requests.length === 0) {
    return (
      <FirstRunState
        title="Nothing waiting"
        note="Requests from your tables land here the moment a guest taps. Anything not cleared in five minutes also shows on Javeed's dashboard."
        testId="staff-requests-empty"
      />
    );
  }

  // Grouped by type with a count, so ten waters read as one job (Standard 8.2).
  const groups = new Map<string, typeof data.requests>();
  for (const r of data.requests) groups.set(r.kind, [...(groups.get(r.kind) ?? []), r]);

  return (
    <div className="flex flex-col gap-4" data-testid="staff-requests">
      {[...groups.entries()].map(([kind, items]) => (
        <div key={kind}>
          <SectionLabel>
            {kind} · {items.length}
          </SectionLabel>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {items.map((r) => (
              <li key={r.id}>
                <Card
                  className={cn(
                    'flex flex-wrap items-center gap-3 p-3',
                    r.urgent && 'bg-[var(--error-surface)] text-[var(--on-error-surface)]'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block type-body font-semibold">Table {r.tableName}</span>
                    <span className="block type-caption opacity-80">
                      {r.note || 'No note'} · {r.urgent ? "on Javeed's dashboard too" : 'waiting'}
                    </span>
                  </span>
                  <span className="type-caption font-bold tabular-nums">{r.ageMinutes} min</span>
                  <Button
                    data-testid={`staff-request-done-${r.id}`}
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      runBusy(async () => {
                        await send('/api/staff/action', { action: 'complete-request', requestId: r.id });
                        toast.show(`${r.kind} at ${r.tableName} marked done · ${data.me.name}`, { tone: 'success' });
                      })
                    }
                  >
                    Done
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        Marking done clears it from the owner&rsquo;s dashboard too, with your name against it.
      </p>
    </div>
  );
}

/* ── Me ────────────────────────────────────────────────────────────────── */

export function MeScreen({ data, onSignOut }: StaffScreenProps & { onSignOut: () => void }) {
  const granted = new Set(data.grants);

  return (
    <div className="flex flex-col gap-4" data-testid="staff-me">
      <Card className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] type-button font-bold text-[var(--on-primary)]"
        >
          {data.me.initials || data.me.name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block type-body font-semibold">{data.me.name}</span>
          <span className="block type-caption text-[var(--text-muted)]">
            {data.me.role}
            {data.myTables.length ? ` · ${data.myTables.join(', ')}` : ' · no open tables'}
          </span>
        </span>
      </Card>

      <div>
        <SectionLabel>What you may do tonight</SectionLabel>
        <Card>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {PERMISSION_GROUPS.flatMap((g) => g.permissions)
              // The ones that matter on a phone. The full matrix is the owner's screen, not this one.
              .filter(
                (p) => p.key.startsWith('orders.') || p.key.startsWith('bill.') || p.key.startsWith('menu.avail')
              )
              .map((p) => {
                const on = granted.has(p.key);
                return (
                  <li key={p.key} className="flex items-center gap-2.5 type-caption">
                    <span
                      aria-hidden
                      className={cn(
                        'w-4 text-center font-bold',
                        on ? 'text-[var(--success)]' : 'text-[var(--text-disabled)]'
                      )}
                    >
                      {on ? '✓' : '✕'}
                    </span>
                    <span className={cn(on ? '' : 'text-[var(--text-disabled)]')}>{permissionLabel(p.key)}</span>
                  </li>
                );
              })}
          </ul>
        </Card>
        <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
          Javeed sets these. Anything with a cross asks for his approval instead of failing silently.
        </p>
      </div>

      <Button data-testid="staff-signout" variant="secondary" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  );
}

/* ── Clear — the waiter's reset queue ──────────────────────────────────── */

/**
 * Tables the party has left and nobody has wiped yet.
 *
 * WHY THE WAITER HAS THIS TAB AND THE CAPTAIN DOES NOT
 *   It is the second half of what a waiter's shift actually is. The captain runs bills; the
 *   waiter runs the room — what is ready to carry out, and what is ready to sit down at. The
 *   design set gives the two roles different tab bars for exactly this reason, and this is the
 *   tab that was missing from ours.
 *
 * THE AGE IS THE WHOLE POINT
 *   A table three minutes cold is housekeeping. A table twelve minutes cold with a queue at the
 *   door is lost revenue and a party being told "just a few more minutes" for the third time.
 *   The row says which it is rather than leaving every table looking equally urgent.
 */
export function ClearScreen({ data, send, busy, runBusy }: StaffScreenProps) {
  const toast = useToast();
  const waiting = data.tables.filter((t) => t.clearing !== null);

  if (waiting.length === 0) {
    return (
      <FirstRunState
        title="Everything is reset"
        note="A table appears here the moment its bill is closed, and leaves it when somebody marks it clear. Nothing waiting means the room is ready for the next party."
        testId="staff-clear-empty"
      />
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="staff-clear">
      {waiting.map((t) => {
        const since = t.clearing!.releasedAtIso;
        const minutes = t.clearing!.waitedMinutes;
        const urgent = minutes >= 4;
        return (
          <li key={t.id}>
            <Card className={cn('flex flex-wrap items-center gap-3', urgent && 'bg-[var(--warning-surface)]')}>
              <span className="min-w-[9rem] flex-1">
                <span className="block type-body font-semibold">Table {t.name}</span>
                <span className="block type-caption text-[var(--text-muted)]">
                  Closed{' '}
                  {new Date(since).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                  {t.clearing!.billCode ? ` · ${t.clearing!.billCode}` : ''}
                  {t.clearing!.guests ? ` · ${t.clearing!.guests} guests` : ''}
                </span>
                <span className="block type-caption">
                  {urgent ? 'Someone is waiting for this table' : 'Clear and reset for the next party'}
                </span>
              </span>

              <span className="shrink-0 type-caption tabular-nums text-[var(--text-muted)]">
                {minutes === 0 ? 'just now' : `${minutes} min ago`}
              </span>

              <Button
                data-testid={`staff-clear-done-${t.id}`}
                size="sm"
                disabled={busy}
                onClick={() =>
                  runBusy(async () => {
                    await send('/api/staff/action', { action: 'clear-table', tableId: t.id });
                    toast.show(`Table ${t.name} ready for the next party`, { tone: 'success' });
                  })
                }
              >
                Mark it clear
              </Button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
