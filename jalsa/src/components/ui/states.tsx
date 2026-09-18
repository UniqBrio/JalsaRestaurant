'use client';

import * as React from 'react';
import {
  OFFLINE_BODY,
  OFFLINE_CALL,
  OFFLINE_CALL_NOTE,
  OFFLINE_HINT,
  OFFLINE_NO_NUMBER,
  OFFLINE_RETRY,
  OFFLINE_TITLE,
} from '@/lib/connectivity';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { Button } from './button';

/**
 * states — the eight states, as components, so a screen cannot ship with only the happy one.
 *
 * Reusable Design Standard 5.1: every data surface has a designed EMPTY, FIRST-RUN, LOADING,
 * PARTIAL, ERROR, SUCCESS, PERMISSION-DENIED and OFFLINE state. These are not edge cases —
 * empty is what every new customer sees first, and error is the one they remember.
 *
 * 5.2 is the distinction that most often gets missed, so it is TWO components rather than one
 * with a flag: "nothing yet" needs an onboarding action, "nothing found" needs the filters
 * cleared, and a single message serves neither.
 */

function Frame({ children, className, testId }: { children: React.ReactNode; className?: string; testId: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-10 text-center', className)} data-testid={testId}>
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="type-h3">{children}</h3>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="m-0 max-w-[34em] type-body leading-relaxed text-[var(--text-muted)]">{children}</p>;
}

/** Nothing exists yet. Says what will appear here, and offers the action that fills it. */
export function FirstRunState({
  title,
  note,
  action,
  testId,
}: {
  title: string;
  note: string;
  action?: { label: string; onClick: () => void; testId: string };
  testId: string;
}) {
  return (
    <Frame testId={testId}>
      <Image src="/brand/empty-light.svg" alt="" width={120} height={87} className="dark:hidden opacity-90" />
      <Image src="/brand/empty-dark.svg" alt="" width={120} height={87} className="hidden dark:block opacity-90" />
      <Title>{title}</Title>
      <Note>{note}</Note>
      {action ? (
        <Button data-testid={action.testId} variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </Frame>
  );
}

/**
 * Things exist, but the filters excluded them all. Names the active filters and clears them in
 * one tap — because the user's next move is always "show me everything again".
 */
export function NoMatchesState({
  query,
  filters,
  onClear,
  testId,
}: {
  query?: string;
  filters?: string[];
  onClear: () => void;
  testId: string;
}) {
  const active = [query ? `“${query}”` : null, ...(filters ?? [])].filter(Boolean).join(' · ');
  return (
    <Frame testId={testId}>
      <Title>Nothing matches that</Title>
      <Note>
        {active ? (
          <>Nothing on the menu matches {active}. Try a shorter word, or clear the filters.</>
        ) : (
          <>The filters you have set rule everything out.</>
        )}
      </Note>
      <Button data-testid={`${testId}-clear`} variant="secondary" onClick={onClear}>
        Clear the filters
      </Button>
    </Frame>
  );
}

/**
 * Something failed. Names what failed and what to try — never a stack trace, never "Something
 * went wrong", and never without a retry.
 */
export function ErrorState({
  title = 'That did not go through',
  message,
  onRetry,
  testId,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  testId: string;
}) {
  return (
    <Frame testId={testId}>
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--error-surface)] type-h3 font-bold text-[var(--on-error-surface)]"
      >
        !
      </span>
      <Title>{title}</Title>
      <Note>{message}</Note>
      {onRetry ? (
        <Button data-testid={`${testId}-retry`} variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Frame>
  );
}

/**
 * Permission denied, as a DESIGNED screen (Standard 9.3): it names the permission and who can
 * grant it. A blank panel or a silent redirect reads as a broken product and generates a
 * support contact every single time.
 */
export function DeniedState({
  permission,
  askWho = 'Javeed',
  testId,
}: {
  permission: string;
  askWho?: string;
  testId: string;
}) {
  return (
    <Frame testId={testId}>
      <Title>You do not have this one</Title>
      <Note>
        This screen needs <strong>{permission}</strong>. {askWho} can grant it from Staff → Module access, and it
        takes effect the moment they save — you will not need to sign in again.
      </Note>
    </Frame>
  );
}

/**
 * Offline. A banner rather than a screen: the guest can still READ what is already on their
 * phone, and hiding it would be a worse lie than saying the connection is gone.
 */
export function OfflineBanner() {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="sticky top-0 z-40 bg-[var(--warning-surface)] px-4 py-2 text-center type-caption font-semibold text-[var(--on-warning-surface)]"
    >
      No signal right now. You can still read this page — anything you send will wait until it comes back.
    </div>
  );
}

/**
 * A partial answer: some of what was asked for arrived, some did not. Shown rather than
 * silently dropping the missing part, because the missing part is usually the one that matters.
 */
export function PartialNotice({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div
      role="status"
      data-testid={testId}
      className="rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]"
    >
      {children}
    </div>
  );
}

/** A success confirmation that names the record and the values — a receipt, not a "Saved". */
export function SuccessNotice({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div
      role="status"
      data-testid={testId}
      className="rounded-[var(--radius-md)] bg-[var(--success-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-success-surface)]"
    >
      {children}
    </div>
  );
}

/**
 * The configuration state. Not one of the eight, and deliberately separate from ErrorState:
 * this is the operator's problem, not the user's, and it names the exact variable to set
 * rather than asking anyone to retry something that cannot work yet.
 */
export function NotConfiguredState({ problem }: { problem: string }) {
  return (
    <Frame testId="not-configured" className="min-h-[70vh] justify-center">
      <Title>Jalsa is not connected to its database yet</Title>
      <Note>
        The application is deployed but one or more environment variables are missing, so it has nothing to read. This
        is a setup step, not a fault — no data has been lost.
      </Note>
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 text-left type-caption leading-relaxed text-[var(--text-body)]">
        {problem}
      </pre>
      <Note>
        Set them in the deployment&rsquo;s environment (see <code>.env.example</code>) and reload. The secret key is
        in the Supabase dashboard under Project Settings → API keys.
      </Note>
    </Frame>
  );
}

/**
 * The database is configured, but the server could not reach it.
 *
 * WHY THIS IS A SCREEN AND NOT AN UNCAUGHT THROW
 *   Configuration and reachability fail in the same place and look identical in a stack trace,
 *   but they are different situations for different people. A missing variable is the
 *   operator's setup step; an unreachable host is a temporary outage, and the person looking at
 *   it is usually a guest holding a phone over a QR stand, or a captain mid-service.
 *   Without this, both of them get Next.js's error page — a screen that tells a guest nothing,
 *   offers them nothing, and reads as "the restaurant's app is broken".
 *
 *   Standard 1.6: say what happened, give the one fact needed next, and name what still works.
 *   What still works is the oldest fallback in the building — the staff take the order.
 *
 * WHY IT DOES NOT RETRY BY ITSELF
 *   A screen that silently re-requests hides the outage from the only people who can escalate
 *   it. Reload is one tap and it is the guest's own decision.
 */
export function UnreachableState({ surface, detail }: { surface: 'guest' | 'staff' | 'owner'; detail?: string }) {
  const note =
    surface === 'guest'
      ? 'Your table and your order are safe — this phone just cannot reach the till right now. Show this screen to any of the team and they will take your order the usual way.'
      : surface === 'staff'
        ? 'The floor could not be loaded — the till is not answering. Nothing has been lost: every open bill is in the database, and this screen will fill in as soon as the connection returns. Keep taking orders on paper until it does.'
        : 'The console could not be loaded — the database is not answering. No figures are shown rather than stale ones, because a wrong number here is worse than no number.';

  return (
    <Frame testId={`unreachable-${surface}`} className="min-h-[70vh] justify-center">
      <Title>We cannot reach the till just now</Title>
      <Note>{note}</Note>
      {detail ? (
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 text-left type-caption leading-relaxed text-[var(--text-body)]">
          {detail}
        </pre>
      ) : null}
      <Button data-testid={`unreachable-${surface}-reload`} variant="secondary" onClick={() => location.reload()}>
        Try again
      </Button>
    </Frame>
  );
}

/**
 * The connectivity gate at the door — a whole screen, not a banner.
 *
 * WHY A SCREEN AND NOT THE BANNER ABOVE
 *   `OfflineBanner` is the right answer once somebody is INSIDE: they have a menu on screen, a
 *   cart the server is holding, and losing the signal for ten seconds should not take any of it
 *   away. This is the other case — arriving with nothing loaded — where letting them through to
 *   a menu means letting them tap an order that cannot be sent and learn it from silence.
 *
 * WHY THERE IS NO "CALL CAPTAIN" BUTTON
 *   The captain-call mechanism posts to the server. On a screen that exists because the server
 *   cannot be reached, that button is one that cannot work, and a control that fails silently is
 *   worse than none (Standard 5.6). The copy points at the person instead, which is the thing
 *   that is always still true in a restaurant.
 *
 * WHAT IT REFUSES TO SAY
 *   Not "mobile data is off". A browser cannot tell mobile data from Wi-Fi, a captive portal
 *   from a working network, or airplane mode from a dead router. It names both options and lets
 *   the person look at their own phone.
 */
export function OfflineGate({
  onRetry,
  callNumber,
  captainAvailable = true,
}: {
  onRetry?: () => void;
  callNumber?: string;
  /**
   * Whether the restaurant offers Call captain at all — the owner's own `callCaptain` switch.
   *
   * TWO CONDITIONS, not one, and they answer different questions. `captainAvailable` is whether
   * this restaurant offers the action; `callNumber` is whether there is anything to dial. An
   * owner who has switched Call captain off across the guest surface must not meet it here, and
   * an owner who has it on but has configured no number must not be given a dead link.
   */
  captainAvailable?: boolean;
}) {
  /* Trimmed before it is used: a number that is whitespace or an empty string is no number, and
     `tel:` with nothing after it opens the dialler on an empty field. */
  const dial = captainAvailable ? (callNumber ?? '').replace(/\s+/g, '') : '';
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-4 px-6 text-center"
      data-testid="guest-offline-gate"
    >
      {/*
        THE JALSA MARK, so this reads as the application rather than as a browser error page.

        WHY THE LOCAL BADGE AND NOT THE RESTAURANT'S UPLOADED LOGO
          `data.logoUrl` is an owner-uploaded file on a REMOTE host. On a screen that exists
          because the network cannot be reached, that request cannot complete — it would put a
          broken image on the one screen that must not look broken. `/brand/jalsa-badge.png` is
          the mark `design/tokens.json` declares, it is same-origin, and `public/sw.js` serves
          `/brand/*` cache-first with runtime fill, so it is in the cache after any earlier visit.

        THE CIRCLE STAYS, and is why this is safe. If the image is ever missing the container is
        still a deliberate-looking tinted circle rather than a broken-image glyph.
      */}
      <span
        aria-hidden
        className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-sunken)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a static brand file, deliberately
            not next/image: the optimizer serves from /_next/image, which is a network round trip
            this screen by definition cannot make. */}
        <img src="/brand/jalsa-badge.png" alt="" aria-hidden className="h-10 w-10 object-contain" />
      </span>
      <h1 className="type-h2 font-semibold">{OFFLINE_TITLE}</h1>
      <p className="m-0 type-body leading-relaxed text-[var(--text-muted)]">{OFFLINE_BODY}</p>
      <p className="m-0 type-body leading-relaxed text-[var(--text-muted)]">{OFFLINE_HINT}</p>
      {/*
        THE TWO ACTIONS, in the order of what they can actually achieve.

        Stacked full-width rather than side by side: at 320px two buttons in a row give each
        about 130px, and "Call captain" does not fit one. A column has no width at which it is
        wrong, and this screen is never the one to be clever on.
      */}
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          data-testid="guest-offline-retry"
          onClick={() => (onRetry ? onRetry() : window.location.reload())}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-6 type-body font-semibold text-[var(--on-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          {OFFLINE_RETRY}
        </button>

        {/* The secondary, and the only thing here that does not need the network. See the note
            on OFFLINE_CALL: this is a telephone call, NOT the `/api/guest/ask` request, which
            could not arrive from this screen and must not claim to have. */}
        {dial ? (
          <a
            data-testid="guest-offline-call"
            href={`tel:${dial}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--border-strong)]/40 px-6 type-body font-semibold text-[var(--text-body)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          >
            {OFFLINE_CALL}
          </a>
        ) : null}
      </div>

      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
        Your table and your bill are held on our side, not on your phone — nothing is lost.{' '}
        {dial ? OFFLINE_CALL_NOTE : OFFLINE_NO_NUMBER}
      </p>
    </main>
  );
}
