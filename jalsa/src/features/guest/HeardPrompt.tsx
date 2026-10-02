'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/atoms';
import { Combobox } from '@/components/ui/combobox';
import { Field } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { SEEDED_HEARD_SOURCES } from '@/lib/heard-about';
import type { GuestScreenProps } from './GuestApp';

/**
 * "How did you hear about us?" for a phone that joined a table AFTER its first round (02-Oct-2026).
 *
 * The question was only ever on the welcome screen, and a second phone joining a table that has
 * already ordered lands straight on the order screen - so it was never asked. This card asks it
 * once: answering or "Not now" puts it away for good (the dismissal is stored on the session),
 * so the same phone is never asked twice. The same picker and the same `/api/guest/heard` write
 * as the welcome screen - one way to answer, not two.
 *
 * THE STANDARD CHOICES, PLUS "TYPE YOUR OWN" - NOT THE RECORDED LIST. The order screen is polled
 * every few seconds, and the list of everything guests have ever answered is read only on the
 * welcome screen for exactly that reason (guest-rounds, combobox-migration). Nothing is read for
 * this card; a guest whose answer is not among the four types it.
 */
export function HeardPrompt({ data, send }: Pick<GuestScreenProps, 'data' | 'send'>) {
  const toast = useToast();
  const [done, setDone] = React.useState(false);
  const [value, setValue] = React.useState('');
  if (done) return null;

  const save = async (source: string): Promise<void> => {
    setValue(source);
    try {
      await send('/api/guest/heard', { source });
      setDone(true);
      toast.show('Thank you — that helps us.', { tone: 'success' });
    } catch (err: unknown) {
      setValue('');
      toast.show(err instanceof Error ? err.message : 'That did not save — try again.', { tone: 'error' });
      throw err;
    }
  };

  const dismiss = (): void => {
    setDone(true);
    void send('/api/guest/heard', { dismiss: true }).catch(() => undefined);
  };

  return (
    <Card className="flex flex-col gap-2" data-testid="guest-heard-prompt">
      <Field label="How did you hear about us?" htmlFor="guest-heard-late">
        <Combobox
          id="guest-heard-late"
          testId="guest-heard-late"
          value={value}
          onValueChange={(source) => void save(source)}
          options={SEEDED_HEARD_SOURCES.map((v) => ({ value: v, label: v }))}
          placeholder="Search or add a source"
          emptyLabel="No matching sources"
          addHint="Not listed? Type your own answer."
          allowCreate
          onCreate={async (source) => {
            await save(source);
            return source;
          }}
        />
      </Field>
      <Button data-testid="guest-heard-not-now" variant="ghost" size="sm" className="self-start" onClick={dismiss}>
        Not now
      </Button>
    </Card>
  );
}
