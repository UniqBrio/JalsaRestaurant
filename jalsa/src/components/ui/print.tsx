'use client';

import * as React from 'react';
import { Button } from './button';
import { Pill } from './atoms';
import { printerShortName } from '@/lib/print-routing';
import type { Tone } from '@/lib/status';
import type { KotPrintJob } from '@/lib/db/types';

/**
 * Where a round's paper is, on every surface that shows a round.
 *
 * WHY ONE COMPONENT AND NOT THREE BLOCKS OF JSX
 *   Three screens show a KOT — the owner's Live orders board and the captain's Tables and Ready
 *   lists — and all three showed exactly one fact about printing: a red "Print failed" pill, with
 *   no indication of WHICH machine had failed. The answer lived two screens away in Settings, so
 *   the person holding the phone in the kitchen could see that a ticket had not come out but not
 *   which room to walk to. Written three times it would drift three ways; written once it is one
 *   vocabulary, and "the freeze rule" has one place to hold.
 *
 * WHY "QUEUED" IS NOT SILENT
 *   It used to be: only `failed` drew a pill, because before Phase 1 a job was decided the
 *   instant it was written and `queued` never survived the insert. Now a job waits for something
 *   that can actually deliver it, so `queued` is the normal state of a ticket that has not
 *   printed yet — and a ticket that has not printed yet is precisely the thing a kitchen needs to
 *   be told about. Saying nothing would read as "printed", which is the one meaning it must never
 *   have.
 */

export const PRINT_STATUS: Record<KotPrintJob['status'], { word: string; tone: Tone }> = {
  // Assigned to a machine, waiting for the bridge. NOT a claim that paper moved.
  queued: { word: 'Waiting to print', tone: 'warning' },
  // A bridge is holding it. Still not a claim that paper moved — only that somebody is carrying it.
  processing: { word: 'Sending…', tone: 'info' },
  printed: { word: 'Printed', tone: 'success' },
  failed: { word: 'Print failed', tone: 'error' },
};

/**
 * The one line that answers "where is this ticket going".
 *
 * A fallback reads differently from a routed job on purpose: the station it is STAMPED for is
 * not the machine it is coming out of, and a cook who does not know that picks up the wrong
 * paper.
 */
export function printDestination(job: KotPrintJob): string {
  if (!job.printerId) return 'No machine assigned';
  const machine = printerShortName(job.printerName);
  if (job.routingRule === 'fallback') return `${job.station} → ${machine} (stand-in)`;
  if (job.routingRule === 'chosen') return `${job.station} → ${machine} (sent here by hand)`;
  return `${job.station} → ${machine}`;
}

/**
 * Every machine this round is printing at, with the retry that belongs to each.
 *
 * ONE BUTTON PER JOB, NAMING ITS MACHINE. A round spanning the tandoor and the main kitchen has
 * two tickets and two independent failures; a single "Retry the print" could only ever mean one
 * of them, and the old one silently meant "route it again from scratch".
 */
export function PrintTargets({
  jobs,
  canRetry,
  busy,
  onRetry,
  testIdPrefix,
}: {
  jobs: readonly KotPrintJob[];
  canRetry: boolean;
  busy: boolean;
  /** Retry THIS job, on the machine it is already assigned to. Never a re-route. */
  onRetry: (job: KotPrintJob) => void;
  testIdPrefix: string;
}) {
  // A round placed before Phase 1 has no jobs of its own. Drawing an empty panel for it would
  // be worse than drawing nothing: it reads as "nothing was printed", which is not known.
  if (jobs.length === 0) return null;

  return (
    <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0" data-testid={`${testIdPrefix}-targets`}>
      {jobs.map((job) => (
        <li key={job.id} className="flex flex-wrap items-center gap-2">
          <Pill tone={PRINT_STATUS[job.status].tone}>{PRINT_STATUS[job.status].word}</Pill>

          <span className="type-caption text-[var(--text-muted)]">{printDestination(job)}</span>

          {job.attempts > 1 ? (
            <span className="type-caption tabular-nums text-[var(--text-muted)]">· {job.attempts} tries</span>
          ) : null}

          {canRetry && job.status !== 'printed' && job.printerId ? (
            <Button
              data-testid={`${testIdPrefix}-retry-${job.id}`}
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onRetry(job)}
            >
              {/* The machine is IN the label. An operator should never have to hold in their head
                  which of two tickets this button belongs to. */}
              Retry on {printerShortName(job.printerName)}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
