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
        <p className="m-0 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">
          Step {step === 'current' ? '1' : step === 'next' ? '2' : '3'} of 3
        </p>
        <h1 className="mt-1.5 text-[21px]">{heading}</h1>
        <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{note}</p>
      </div>

      <div className="flex justify-center gap-3" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-3.5 w-3.5 rounded-full transition-colors',
              value.length > i ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]/35'
            )}
          />
        ))}
      </div>

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
              className="h-14 rounded-[var(--radius-md)] bg-[var(--surface)] text-[22px] font-semibold text-[var(--text-body)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:opacity-45"
            >
              {k}
            </button>
          )
        )}
      </div>

      <p className="m-0 text-center text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        {busy ? 'Saving…' : 'Nobody can see this, including Javeed. If you forget it, he issues a new one.'}
      </p>

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
