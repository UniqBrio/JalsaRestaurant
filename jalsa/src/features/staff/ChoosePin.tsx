'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';

/**
 * First use: choose your own PIN.
 *
 * WHY THIS SCREEN EXISTS AT ALL
 *   The sign-in screen makes one promise — "everything you do tonight is recorded against your
 *   name" — and that promise is only true while the PIN is theirs alone. A code the owner
 *   generated, read out, and possibly wrote on a docket is not yet theirs. So a session opened
 *   with an issued PIN opens THIS, and nothing else: not the floor, not the console, not a
 *   dismissible banner over either.
 *
 * WHY IT IS NOT SKIPPABLE
 *   A "remind me later" here is a permanent later. The one thing that makes it fair to be
 *   non-negotiable is that it takes eight taps.
 *
 * WHY THE CURRENT PIN IS ASKED FOR
 *   The person is already signed in, so it looks redundant — but a handset left unlocked on a
 *   counter is the realistic threat, and without it anyone passing could lock its owner out of
 *   their own name.
 */
export function ChoosePin({ name }: { name: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<'current' | 'next' | 'confirm'>('current');
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const value = step === 'current' ? current : step === 'next' ? next : confirm;
  const setValue = step === 'current' ? setCurrent : step === 'next' ? setNext : setConfirm;

  const submit = React.useCallback(
    async (chosen: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/staff/pin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ current, next: chosen }),
        });
        const parsed = (await res.json()) as { message?: string };
        if (!res.ok) {
          setError(parsed.message ?? 'That did not work.');
          // Back to the start of the choice, never back to the beginning: the current PIN was
          // already accepted, and re-typing it would read as a punishment for a typo.
          setNext('');
          setConfirm('');
          setStep('next');
          return;
        }
        router.refresh();
      } catch {
        setError('We could not reach the till. Check the wifi and try again.');
      } finally {
        setBusy(false);
      }
    },
    [current, router]
  );

  const advance = React.useCallback(
    (complete: string) => {
      setError(null);
      if (step === 'current') {
        setStep('next');
        return;
      }
      if (step === 'next') {
        setStep('confirm');
        return;
      }
      if (complete !== next) {
        setError('Those two did not match. Choose it again.');
        setNext('');
        setConfirm('');
        setStep('next');
        return;
      }
      void submit(complete);
    },
    [step, next, submit]
  );

  const press = (key: string) => {
    setError(null);
    if (key === '⌫') {
      setValue(value.slice(0, -1));
      return;
    }
    const updated = (value + key).slice(0, 4);
    setValue(updated);
    if (updated.length === 4) advance(updated);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  const heading =
    step === 'current'
      ? 'First, the PIN you were given'
      : step === 'next'
        ? 'Now choose your own'
        : 'Once more, to be sure';

  const note =
    step === 'current'
      ? `Welcome, ${name}. Before you start, the code you were given has to be replaced with one only you know.`
      : step === 'next'
        ? 'Four digits. Not 1234, not four of the same — those are the two anyone tries first.'
        : 'Type the same four digits again.';

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[24rem] flex-col justify-center gap-6 px-6 py-10"
      data-testid="staff-choose-pin"
      data-step={step}
    >
      <div className="text-center">
        <p className="m-0 type-eyebrow font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
          Step {step === 'current' ? '1' : step === 'next' ? '2' : '3'} of 3
        </p>
        <h1 className="mt-1.5 type-h2">{heading}</h1>
        <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">{note}</p>
      </div>

      {/* The real control. This screen shipped with the keypad and NOTHING else, so a phone's
          own numeric keyboard could not be used on it at all - three PINs to enter, every digit
          by tapping. It is sr-only rather than hidden so it stays focusable and in the
          accessibility tree, exactly as the sign-in screen does it. */}
      <label className="sr-only" htmlFor="staff-choose-pin-input">
        {step === 'current' ? 'The PIN you were given' : step === 'next' ? 'Your new PIN' : 'Your new PIN again'}
      </label>
      <input
        data-testid="staff-choose-pin-input"
        id="staff-choose-pin-input"
        /* Entering a PIN is the only thing this screen does. */
        autoFocus
        className="sr-only"
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        disabled={busy}
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
          setError(null);
          setValue(digits);
          if (digits.length === 4) advance(digits);
        }}
      />

      <label
        htmlFor="staff-choose-pin-input"
        data-testid="staff-choose-pin-dots"
        className="flex cursor-text justify-center gap-3 py-1"
        aria-label="Enter four digits"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full transition-colors',
              value.length > i
                ? 'bg-[var(--primary)]'
                : value.length === i
                  ? 'animate-pulse bg-[var(--primary)]/45 ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--background)]'
                  : 'bg-[var(--border-strong)]/35'
            )}
          />
        ))}
      </label>

      {error ? <ErrorState title="Not quite" message={error} testId="staff-choose-pin-error" /> : null}

      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={`gap-${i}`} />
          ) : (
            <button
              data-testid={`staff-choose-key-${k === '⌫' ? 'back' : k}`}
              key={k}
              type="button"
              disabled={busy}
              onClick={() => press(k)}
              aria-label={k === '⌫' ? 'Delete the last digit' : k}
              className="h-14 rounded-[var(--radius-md)] bg-[var(--surface)] type-h2 font-semibold text-[var(--text-body)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-45"
            >
              {k}
            </button>
          )
        )}
      </div>

      <p className="m-0 text-center type-caption leading-relaxed text-[var(--text-muted)]">
        {busy ? 'Saving…' : 'Nobody can see this, including Javeed. If you forget it, he issues a new one.'}
      </p>

      {/* Per-session only, and that distinction is the whole point: it rewrites THIS cookie so
          the floor opens now, and leaves `staff.pin_provisional` alone in the database. Sign in
          again tomorrow and the screen returns. A skip that cleared the database flag would turn
          a published four-digit code into this account's permanent credential, which is exactly
          what KL-4 says makes the shared 1234 safe only while it is provisional. */}
      <Button
        data-testid="staff-choose-pin-skip"
        variant="secondary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void fetch('/api/staff/pin', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ skip: true }),
          })
            .then(() => router.refresh())
            .finally(() => setBusy(false));
        }}
      >
        Skip for now
      </Button>

      <Button
        data-testid="staff-choose-pin-signout"
        variant="ghost"
        onClick={() => void fetch('/api/staff/session', { method: 'DELETE' }).then(() => router.refresh())}
      >
        Not you? Sign out
      </Button>
    </main>
  );
}
