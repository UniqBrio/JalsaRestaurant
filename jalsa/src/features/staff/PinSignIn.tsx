'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { Surface } from '@/lib/cookie-names';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';

/**
 * The four-digit keypad.
 *
 * WHY A PIN AT ALL, AND WHY IT MATTERS THAT IT IS THEIRS
 *   Signing in is what puts a name against every order, discount, cancellation and closure that
 *   follows (Standard 6.2). The screen says so, in the design's own words, because a credential
 *   people understand the purpose of is a credential people stop sharing.
 *
 * WHY A CUSTOM KEYPAD RATHER THAN A NUMBER FIELD
 *   A captain does this standing up, one-handed, holding something. Four 56px keys they can hit
 *   without looking beat a text field and whichever keyboard the handset decides to show.
 *   The real input element is still there, hidden, so password managers and hardware keyboards work
 *   and so the value is announced properly.
 */
export function PinSignIn({ surface }: { surface: Surface }) {
  const router = useRouter();
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = React.useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/staff/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pin: value, surface }),
        });
        const parsed = (await res.json()) as { message?: string };
        if (!res.ok) {
          setError(parsed.message ?? 'That PIN did not work.');
          setPin('');
          return;
        }
        router.refresh();
      } catch {
        setError('We could not reach the till. Check the wifi and try again.');
      } finally {
        setBusy(false);
      }
    },
    [router, surface]
  );

  const press = (key: string) => {
    setError(null);
    if (key === '⌫') {
      setPin(pin.slice(0, -1));
      return;
    }
    // The next value is computed HERE, not inside the state updater.
    //
    // An updater passed to setState must be pure: React is free to call it more than once for a
    // single update, and under StrictMode it deliberately does. A `submit()` inside one is
    // therefore a second sign-in attempt nobody made — which against a lockout policy locks a
    // captain out of their own shift for typing their PIN correctly, once.
    // Caught by tests/functional/signin.functional.spec.ts ("submits exactly once").
    const next = (pin + key).slice(0, 4);
    setPin(next);
    // Four digits IS the submit. Asking for a fifth tap on a button after the fourth digit is
    // a tap that exists only because the form was built before the keypad was.
    if (next.length === 4) void submit(next);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[24rem] flex-col justify-center gap-6 px-6 py-10"
      data-testid="staff-signin"
    >
      <div className="text-center">
        <h1 className="type-h2">Staff sign in</h1>
        <p className="m-0 mt-1.5 type-caption leading-relaxed text-[var(--text-muted)]">
          Four-digit PIN. Everything you do tonight is recorded against your name.
        </p>
      </div>

      {/* The real control, kept out of sight but not out of the accessibility tree. */}
      <label className="sr-only" htmlFor="staff-pin">
        Your four-digit PIN
      </label>
      <input
        data-testid="staff-pin-input"
        id="staff-pin"
        /* The keypad IS the screen: there is nothing else to focus, and a captain should be
           able to type the moment it opens. */
        autoFocus
        className="sr-only"
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
          setPin(digits);
          if (digits.length === 4) void submit(digits);
        }}
      />

      {/* Tapping the dots focuses the real field, which is what opens the phone's own numeric
          keypad. Without a label bound to it, the input is unreachable by touch and the keypad
          below is the ONLY way in - fine on a desktop with a mouse, useless to a captain who
          wants to type. The caret marks the digit about to be entered. */}
      <label
        htmlFor="staff-pin"
        data-testid="staff-pin-dots"
        className="flex cursor-text justify-center gap-3 py-1"
        aria-label="Enter your four-digit PIN"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full transition-colors',
              pin.length > i
                ? 'bg-[var(--primary)]'
                : pin.length === i
                  ? 'animate-pulse bg-[var(--primary)]/45 ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]'
                  : 'bg-[var(--border-strong)]/35'
            )}
          />
        ))}
      </label>

      {error ? <ErrorState title="Not tonight" message={error} testId="staff-pin-error" /> : null}

      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={`gap-${i}`} />
          ) : (
            <button
              data-testid={`staff-key-${k === '⌫' ? 'back' : k}`}
              key={k}
              type="button"
              disabled={busy}
              onClick={() => press(k)}

              aria-label={k === '⌫' ? 'Delete the last digit' : k}
              className="h-14 rounded-[var(--radius-md)] bg-[var(--surface)] type-h2 font-semibold text-[var(--text-body)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
            >
              {k}
            </button>
          )
        )}
      </div>

      <p className="m-0 text-center type-caption text-[var(--text-muted)]">
        {busy ? 'Checking…' : 'Ask Javeed if you have forgotten it.'}
      </p>

      <Button data-testid="staff-signin-home" asChild variant="ghost">
        <Link data-testid="staff-signin-home-link" href="/">
          Back
        </Link>
      </Button>
    </main>
  );
}
