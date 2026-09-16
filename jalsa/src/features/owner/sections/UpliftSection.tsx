'use client';

import * as React from 'react';
import { Card, SectionLabel } from '@/components/ui/atoms';
import { FirstRunState } from '@/components/ui/states';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';

/**
 * Uplift — revenue the system itself created.
 *
 * WHY THIS IS A SECTION AND NOT A REPORTS TAB
 *   The design set disagrees with itself, and this follows the file the brief names authoritative
 *   for navigation. `Jalsa Navigation Flowchart.dc.html` lists THIRTEEN owner sections with
 *   Uplift among them — "Revenue the system itself created — repeat rounds, upsells, tips,
 *   parcels — over the chosen range, with its own export" — while `Jalsa Owner Admin.dc.html`
 *   carries twelve `tabs` and files uplift inside `repTabs`. The requirements document does not
 *   mention uplift at all, so there is no written brief to break the tie. The conflict is
 *   recorded in docs/registers/DESIGN_CONTRACT.md rather than settled silently.
 *
 * WHY IT SHOWS NO FIGURE YET, AND SAYS SO
 *   Uplift is a COMPARISON, not a sum: rounds that took an offer measured against rounds that
 *   did not, over a chosen range. This payload reads today only. A single evening's figure has
 *   no baseline to compare against, so any number printed here would be arithmetic presented as
 *   an insight — and the one thing worse than a missing report is an authoritative wrong one
 *   (Standard 4.4). The four sources are named because naming them is the honest half of the
 *   answer: they are what the figure WILL be built from, and three of the four are already
 *   recorded per round.
 */
export function UpliftSection({ data }: OwnerSectionProps) {
  // What CAN be counted from today's payload, stated as counts rather than as revenue. These
  // are inputs to uplift, not uplift itself, and the labels say so.
  const closed = data.closedToday;
  const rounds = closed.reduce((a, b) => a + b.kots.length, 0);
  const repeatRounds = closed.reduce((a, b) => a + Math.max(0, b.kots.length - 1), 0);
  const tipped = data.tips.length;

  return (
    <div className="flex flex-col gap-4" data-testid="owner-uplift">
      <SectionLabel>Revenue the system itself created</SectionLabel>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <MetricTile
          label="Repeat rounds today"
          value={String(repeatRounds)}
          note={`of ${rounds} rounds on closed bills`}
          testId="owner-uplift-repeat"
        />
        <MetricTile
          label="Tips taken"
          value={String(tipped)}
          note="Offered on the phone, chosen by the guest"
          testId="owner-uplift-tips"
        />
        <MetricTile
          label="Parcels asked for"
          value="—"
          note="Recorded as a request, not yet counted"
          testId="owner-uplift-parcels"
        />
      </div>

      <FirstRunState
        title="The uplift figure needs a date range"
        note="Uplift is a comparison, not a sum — rounds that took an offer against rounds that did not, over a range. This screen reads today only, and one evening has nothing to compare itself with. The counts above are the inputs, stated as counts so they cannot be mistaken for the figure."
        testId="owner-uplift-empty"
      />

      <Card>
        <SectionLabel>The four sources, and where each already lives</SectionLabel>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 type-caption leading-relaxed text-[var(--text-muted)]">
          <li>
            <strong className="text-[var(--text-body)]">Repeat rounds</strong> — every round after the first on a
            bill. Recorded per KOT with its source, so it is already exact.
          </li>
          <li>
            <strong className="text-[var(--text-body)]">Upsells</strong> — items added from the three offer tabs.
            The round records who placed it; which tab it came from is not yet stamped on the line.
          </li>
          <li>
            <strong className="text-[var(--text-body)]">Tips</strong> — the whole tips ledger. Attributed, timed and
            excluded from sales, so it needs no new capture.
          </li>
          <li>
            <strong className="text-[var(--text-body)]">Parcels</strong> — the takeaway ask from the Paid screen.
            Raised as a table request today rather than as a billed line, so it can be counted but not yet valued.
          </li>
        </ul>
      </Card>
    </div>
  );
}
