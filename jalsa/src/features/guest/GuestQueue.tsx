'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, Chip, ChipRow, Pill, SectionLabel } from '@/components/ui/atoms';
import { useToast } from '@/components/ui/toast';
import { useLiveData } from '@/hooks/useLiveData';
import { QUEUE_CLOSED } from '@/lib/queue-closed';
import type { QueueSelfView } from '@/lib/db/types';

/**
 * The entrance queue on a guest's phone — patterns 6a, 6b and 6c of
 * `Jalsa Customer Patterns.dc.html`: "Festival nights — one QR at the door puts you in the queue".
 *
 * NOTHING IS ASKED EXCEPT HOW MANY
 *   The design's own copy is the specification: "Scan at the door, pick how many you are —
 *   nothing else asked", and under the button, "No name or number needed. Your time is locked
 *   the moment you tap." A queue is the one place a restaurant is tempted to take a phone number
 *   it has no use for. This one does not, and says so where the guest can read it.
 *
 * THE SCREEN REFRESHES ITSELF BECAUSE THE PARTY IS STANDING UP
 *   Somebody holding this is in a doorway watching their place move. A screen they must pull to
 *   refresh is a screen they will refresh every ten seconds anyway.
 *
 *   It does that through `useLiveData`, the application's ONE polling idiom (Standard 10.4).
 *   Until 18-Sep-2026 this file ran its own `setInterval`, which was a second idiom and was
 *   missing both of the behaviours the shared hook exists for: it kept polling with the phone in
 *   a pocket at a doorway — the flattest battery in the building — and a single failed read set
 *   the entry to null, blanking a party's own token because one request timed out. The hook
 *   stops when hidden, re-reads on focus, and keeps the last good payload when a read fails.
 *
 * POSITION AND THE ESTIMATE COME FROM THE SERVER
 *   Both are computed in `readQueueEntry` against one clock, so the number on the phone and the
 *   number on the host's screen cannot disagree — which is the whole argument at a busy door.
 *   The estimate carries a tilde because it is an estimate: a precise-looking wait is a promise
 *   the kitchen never made.
 */

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 8, 10] as const;
/** The guest surface's own cadence. A doorway is seconds-urgent, not milliseconds-urgent. */
const POLL_MS = 10_000;

export function GuestQueue({
  initial,
  waitLabel,
  queueOpen,
  hoursRows,
  hoursNote,
  logoUrl,
}: {
  initial: QueueSelfView | null;
  waitLabel: string;
  /** The restaurant's own logo, from `restaurant.logo_url` — read, not hardcoded. */
  logoUrl: string;
  queueOpen: boolean;
  hoursRows: Array<{ day: string; hours: string; today: boolean }>;
  hoursNote: string;
}) {
  const toast = useToast();
  const [showHours, setShowHours] = React.useState(false);
  const [size, setSize] = React.useState<number>(2);
  const [busy, setBusy] = React.useState(false);

  /*
    THE SHARED HOOK HOLDS THE ROW, AND A LOCAL OVERRIDE HOLDS WHAT THIS PHONE JUST DID.

    `useLiveData` owns the polled truth. `justDid` is the result of this phone's own join or
    leave, which is newer than any poll in flight — without it, tapping Join and then receiving a
    poll that started beforehand would flip the screen back to the join form for one cycle.
    Cleared whenever the server's own answer catches up to it.
  */
  const live = useLiveData<{ entry: QueueSelfView | null }>('/api/guest/queue', { entry: initial }, POLL_MS);
  const [justDid, setJustDid] = React.useState<{ entry: QueueSelfView | null } | null>(null);
  const entry = justDid ? justDid.entry : live.data.entry;
  const liveId = live.data.entry?.id ?? null;
  const localId = justDid?.entry?.id ?? null;
  // Adjusted during render rather than in an effect: the poll has agreed, so the override is
  // spent. React 19 calls this twice; it is a pure comparison, so twice is the same as once.
  if (justDid && liveId === localId) setJustDid(null);

  /*
    A TAB THAT WAS OPEN WHEN THE QUEUE CLOSED.

    `queueOpen` is settled by the server render, so a phone that loaded this page while the queue
    was open keeps showing the join form after it closes. The SERVER refuses that join (see
    `guestJoinQueue`), and when it does, this screen must say the true thing rather than flash a
    toast over a form that will never work again. One flag, set only by that refusal, and the
    closed screen below reads it alongside the server's own answer.
  */
  const [closedSinceLoad, setClosedSinceLoad] = React.useState(false);

  const send = React.useCallback(async (payload: unknown) => {
    const res = await fetch('/api/guest/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // fail() sends `{ code, message }` at the top level; there is no `error` wrapper (RC-015).
    const json = (await res.json()) as { entry?: QueueSelfView | null; message?: string };
    if (!res.ok) throw new Error(json.message ?? 'That did not go through.');
    return json.entry ?? null;
  }, []);

  /* ── 6c · the table is ready ─────────────────────────────────────────── */
  if (entry && entry.state === 'seated') {
    return (
      <div className="flex flex-col items-center gap-5 pt-8 text-center" data-testid="guest-queue-seated">
        <span aria-hidden className="type-h1">
          🎉
        </span>
        <div>
          <h2 className="type-h2">Your table is ready</h2>
          <p className="m-0 mt-1 type-body text-[var(--text-muted)]">
            {entry.token} · {entry.partySize} {entry.partySize === 1 ? 'guest' : 'guests'}
            {entry.tableName ? ` · Table ${entry.tableName}` : ''}
          </p>
        </div>
        {entry.tableName ? (
          <Button data-testid="guest-queue-start" asChild>
            <Link data-testid="guest-queue-start-link" href={`/t/${entry.tableName}`}>
              Start ordering
            </Link>
          </Button>
        ) : (
          <p className="m-0 max-w-[26em] type-caption leading-relaxed text-[var(--text-muted)]">
            Ask at the door and someone will walk you to it.
          </p>
        )}
      </div>
    );
  }

  /* ── the party left, or the row is gone ──────────────────────────────── */
  if (entry && entry.state === 'left') {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center" data-testid="guest-queue-left">
        <h2 className="type-h2">You have left the queue</h2>
        <p className="m-0 max-w-[26em] type-body leading-relaxed text-[var(--text-muted)]">
          Nothing is held. Scan the code at the door again whenever you are ready.
        </p>
      </div>
    );
  }

  /* ── 6b · in the queue ───────────────────────────────────────────────── */
  if (entry) {
    const ready = entry.state === 'ready';
    return (
      <div className="flex flex-col gap-4" data-testid="guest-queue-token">
        <div className="flex items-center justify-between gap-3">
          <span className="type-h2">{entry.token}</span>
          <Pill tone={ready ? 'success' : 'primary'}>{ready ? 'Called to the door' : 'In queue'}</Pill>
        </div>

        <Card className="flex flex-col gap-4">
          <div>
            <SectionLabel>Your token</SectionLabel>
            <p className="m-0 type-metric">{entry.token}</p>
          </div>

          <div className="flex flex-wrap gap-6">
            <span>
              <span className="block type-metric">{ordinal(entry.position)}</span>
              <span className="block type-caption text-[var(--text-muted)]">in line</span>
            </span>
            <span>
              <span className="block type-metric">~{entry.estimateMinutes}</span>
              <span className="block type-caption text-[var(--text-muted)]">minutes</span>
            </span>
            <span>
              <span className="block type-metric">{entry.partySize}</span>
              <span className="block type-caption text-[var(--text-muted)]">
                {entry.partySize === 1 ? 'guest' : 'guests'}
              </span>
            </span>
          </div>

          <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
            Joined at{' '}
            {new Date(entry.joinedAtIso).toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}{' '}
            · locked.{' '}
            {entry.ahead === 0
              ? 'You are next.'
              : entry.ahead === 1
                ? 'One party ahead of you.'
                : `${entry.ahead} parties ahead of you.`}{' '}
            Keep this screen open — it updates itself, and we will show a big alert when your table is ready.
          </p>
        </Card>

        {/* The design's pattern 6b offers "See the menu while you wait" here. It is NOT drawn,
            deliberately: a party in the queue has no table, and every menu screen this app has
            is assembled from a table's payload. The honest options were a link to a route that
            does not exist, or a second menu built table-free — a broken promise or a second
            source of truth for the menu. Recorded as DC-005 instead; the button returns when a
            table-less menu route does. */}

        <Button
          data-testid="guest-queue-leave"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void send({ action: 'leave' })
              .then((e) => {
                setJustDid({ entry: e });
                toast.show('You have left the queue', { tone: 'success' });
              })
              .catch((err: unknown) => toast.show(err instanceof Error ? err.message : 'That did not go through.', { tone: 'error' }))
              .finally(() => setBusy(false));
          }}
        >
          Leave the queue
        </Button>
      </div>
    );
  }

  /* ── 6d · the queue is closed ────────────────────────────────────────── */
  if (!queueOpen || closedSinceLoad) {
    return (
      <div className="flex flex-col gap-5" data-testid="guest-queue-closed">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-supplied remote artwork. */}
          <img
            src={logoUrl}
            alt=""
            aria-hidden
            className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] object-contain"
          />
          <span>
            <span className="block type-h2">We have stopped taking the queue</span>
            <span className="block type-caption text-[var(--text-muted)]">Entrance</span>
          </span>
        </div>

        {/* Honest instead of a dead end — the design's own words for this pattern. A closed
            queue that simply hides the button leaves a party standing at a door with no idea
            whether to wait, so this says what is true and what to do instead. */}
        <p className="m-0 max-w-[30em] type-body leading-relaxed text-[var(--text-muted)]">
          The kitchen has as much as it can finish tonight, so nobody new is being added. Ask at the door — if
          something frees up they will know first.
        </p>

        <HoursBlock
          rows={hoursRows}
          note={hoursNote}
          open={showHours}
          onToggle={() => setShowHours((v) => !v)}
        />
      </div>
    );
  }

  /* ── 6a · join ───────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-5" data-testid="guest-queue-join">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- owner-supplied remote artwork. */}
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          className="h-12 w-12 shrink-0 rounded-[var(--radius-md)] object-contain"
        />
        <span>
          <span className="block type-h2">Busy tonight</span>
          <span className="block type-caption text-[var(--text-muted)]">Entrance</span>
        </span>
      </div>

      <p className="m-0 max-w-[30em] type-body leading-relaxed text-[var(--text-muted)]">
        {waitLabel} Join the queue and watch your place from here.
      </p>

      <div>
        <SectionLabel>How many of you?</SectionLabel>
        <ChipRow>
          {PARTY_SIZES.map((n) => (
            <Chip
              key={n}
              on={size === n}
              onClick={() => setSize(n)}
              data-testid={`guest-queue-size-${n}`}
            >
              {n === 10 ? '10+' : n}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <Button
        data-testid="guest-queue-join-send"
        size="lg"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void send({ action: 'join', partySize: size })
            .then((e) => setJustDid({ entry: e }))
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : 'That did not go through.';
              // The queue closed between this page loading and this tap. Show the closed screen,
              // which explains and offers the hours, rather than a toast over a dead form.
              if (message === QUEUE_CLOSED) {
                setClosedSinceLoad(true);
                return;
              }
              toast.show(message, { tone: 'error' });
            })
            .finally(() => setBusy(false));
        }}
      >
        Join the queue
      </Button>

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        No name or number needed. Your time is locked the moment you tap.
      </p>

      <HoursBlock rows={hoursRows} note={hoursNote} open={showHours} onToggle={() => setShowHours((v) => !v)} />
    </div>
  );
}

/**
 * 9c — the hours sheet, on the ENTRANCE code as well as the table one.
 *
 * The same question gets asked in both places and the design answers it in both: a party at the
 * door wants to know until when, and a party at a table wants to know how long they have. One
 * block, opened on demand so it does not push the queue button below the fold on a short phone.
 */
function HoursBlock({
  rows,
  note,
  open,
  onToggle,
}: {
  rows: Array<{ day: string; hours: string; today: boolean }>;
  note: string;
  open: boolean;
  onToggle: () => void;
}) {
  if (rows.length === 0) return null;
  const today = rows.find((r) => r.today);
  return (
    <div>
      <button
        data-testid="guest-queue-hours"
        type="button"
        onClick={onToggle}
        className="min-h-11 type-caption underline underline-offset-2 text-[var(--text-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
      >
        {today ? `Open ${today.hours} today` : 'Opening hours'} · {open ? 'hide' : 'see the week'}
      </button>

      {open ? (
        <Card className="mt-2" data-testid="guest-queue-hours-sheet">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {rows.map((r) => (
              <li key={r.day} className="flex justify-between gap-4 type-caption">
                <span className={r.today ? 'font-semibold' : 'text-[var(--text-muted)]'}>{r.day}</span>
                <span className={r.today ? 'font-semibold tabular-nums' : 'tabular-nums text-[var(--text-muted)]'}>
                  {r.hours}
                </span>
              </li>
            ))}
          </ul>
          {note ? (
            <p className="m-0 mt-2.5 type-caption leading-relaxed text-[var(--text-muted)]">{note}</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

/** "2nd in line" reads; "2 in line" does not. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}
