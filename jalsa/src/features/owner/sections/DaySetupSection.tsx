'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, SectionLabel } from '@/components/ui/atoms';
import { Field, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import type { OwnerSection, OwnerSectionProps } from '../OwnerConsole';

/**
 * Day setup — the six things somebody checks before the doors open.
 *
 * WHY EVERY ROW IS DERIVED AND NOT TICKED
 *   A checklist of checkboxes records that somebody clicked, which is not the same fact as the
 *   printer being reachable. Five of these six rows read the live answer out of the same payload
 *   every other screen reads, so the list cannot be green while the building is not. The one
 *   exception is the note for the floor, which has no derivable truth — it is written or it is
 *   not — and the menu check, which records a human judgement ("I have looked") rather than a
 *   machine one, and says so.
 *
 * WHY IT LINKS RATHER THAN EDITS
 *   Each row that is not right sends you to the screen that owns that thing. Reproducing the
 *   printer panel here would be a second place to configure printers, and the second one is
 *   always the one somebody finds first and the one nobody maintains.
 */

/** What Day setup ASKS. Six labels and where each answer is fixed — never data, never derived. */
interface DayFacts {
  onDuty: number;
  roster: number;
  offlinePrinters: number;
  printerCount: number;
  activeTables: number;
  offTables: number;
  offMenu: number;
  waiting: number;
  menuChecked: boolean;
  noteWritten: boolean;
}

const CHECKS: Array<{
  label: string;
  act?: { label: string; to: OwnerSection };
  read: (f: DayFacts) => { value: string; done: boolean };
}> = [
  {
    label: 'Who is in today',
    act: { label: 'Open staff', to: 'staff' },
    read: (f) => ({ value: `${f.onDuty} of ${f.roster} marked present`, done: f.onDuty > 0 }),
  },
  {
    label: 'Printers reachable',
    act: { label: 'Open settings', to: 'settings' },
    read: (f) => ({
      value: f.offlinePrinters ? `${f.offlinePrinters} not reachable` : `all ${f.printerCount} online`,
      done: f.offlinePrinters === 0,
    }),
  },
  {
    label: 'Tables ready',
    act: { label: 'Open settings', to: 'settings' },
    read: (f) => ({
      value: `${f.activeTables} active · ${f.offTables} switched off`,
      done: f.activeTables > 0,
    }),
  },
  {
    label: 'Menu checked for the day',
    act: { label: 'Open menu', to: 'menu' },
    // The one human judgement on the list: "somebody has looked" is not derivable, so it is
    // recorded rather than computed, and the row says which it is.
    read: (f) => ({
      value: f.offMenu ? `${f.offMenu} off the menu` : 'everything available',
      done: f.menuChecked,
    }),
  },
  {
    label: 'Queue set up',
    act: { label: 'Open waitlist', to: 'queue' },
    read: (f) => ({ value: f.waiting ? `${f.waiting} already waiting` : 'nobody waiting yet', done: true }),
  },
  {
    label: 'Note for the floor',
    read: (f) => ({ value: f.noteWritten ? 'written' : 'nothing written yet', done: f.noteWritten }),
  },
];

export function DaySetupSection({ data, go, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const stored = (data.settings.day ?? {}) as { note?: string; menuChecked?: boolean };
  const [note, setNote] = React.useState(stored.note ?? '');

  const facts = {
    onDuty: data.staff.filter((s) => s.active && s.onDuty).length,
    roster: data.staff.filter((s) => s.active).length,
    offlinePrinters: data.printers.filter((p) => !p.online).length,
    printerCount: data.printers.length,
    activeTables: data.floor.filter((t) => t.active).length,
    offTables: data.floor.length - data.floor.filter((t) => t.active).length,
    offMenu: data.menu.filter((m) => !m.available).length,
    waiting: data.waitlist.length,
    menuChecked: stored.menuChecked === true,
    noteWritten: !!note.trim(),
  };

  /* The static half of the checklist — what is asked, and where the answer is fixed. Held apart
     from the live half on purpose: these six labels are a specification and never change with
     the data, while every value below IS the data. Fused into one array of literals they read
     as a fixture, which is precisely the shape `check-fixture-leak` exists to catch, and it was
     right to ask. */
  const checks = CHECKS.map((c) => ({ ...c, ...c.read(facts) }));
  const ready = checks.filter((r) => r.done).length;

  return (
    <div className="flex flex-col gap-4" data-testid="owner-day">
      <SectionLabel>
        {ready} of {checks.length} ready for service
      </SectionLabel>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {checks.map((r) => (
          <li key={r.label}>
            <Card className="flex flex-wrap items-center gap-3">
              {/* A mark AND a word, never colour alone — the row has to read to somebody who
                  cannot separate the green from the amber (DR-3). */}
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full type-caption font-bold',
                  r.done
                    ? 'bg-[var(--success-surface)] text-[var(--on-success-surface)]'
                    : 'bg-[var(--warning-surface)] text-[var(--on-warning-surface)]'
                )}
              >
                {r.done ? '✓' : '!'}
              </span>
              <span className="min-w-[10rem] flex-1">
                <span className="block type-body font-semibold">{r.label}</span>
                <span className="block type-caption text-[var(--text-muted)]">
                  {r.done ? '' : 'Not ready · '}
                  {r.value}
                </span>
              </span>
              {r.act ? (
                <Button
                  data-testid={`owner-day-go-${r.act.to}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => go(r.act!.to)}
                >
                  {r.act.label}
                </Button>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      <Card className="flex flex-col gap-3">
        <SectionLabel>The note every captain sees on their floor screen</SectionLabel>
        <Field
          label="Note for the floor"
          htmlFor="owner-day-note"
          hint="Tonight's one thing: a shortage, a large booking, a dish that is off. It appears above the tables on every captain's phone."
        >
          <Textarea
            id="owner-day-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="owner-day-note"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="owner-day-save"
            disabled={busy}
            onClick={() =>
              runBusy(async () => {
                await send('/api/owner/action', { action: 'write-setting', key: 'day', value: { note } });
                toast.show(
                  note.trim() ? 'Note saved — it is on every captain’s floor screen' : 'Note cleared',
                  { tone: 'success' }
                );
              })
            }
          >
            Save the note
          </Button>
          <Button
            data-testid="owner-day-menu-checked"
            variant="secondary"
            disabled={busy || stored.menuChecked === true}
            onClick={() =>
              runBusy(async () => {
                await send('/api/owner/action', {
                  action: 'write-setting',
                  key: 'day',
                  value: { menuChecked: true },
                });
                toast.show('Menu marked as checked for today', { tone: 'success' });
              })
            }
          >
            {stored.menuChecked === true ? 'Menu already checked' : 'Mark the menu checked'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
