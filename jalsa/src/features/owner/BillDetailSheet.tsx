'use client';

import * as React from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { TotalsBlock } from '@/components/ui/bill';
import { TicketPaper } from '@/components/ui/print';
import type { TicketLine } from '@/lib/print-template';
import { cn } from '@/lib/cn';
import { billShareText, whatsAppShareUrl, type WhatsAppTemplate } from '@/lib/bill-share';
import type { RestaurantIdentity } from '@/lib/restaurant-identity';
import type { OwnerBillView } from '@/lib/db/owner-view';

/**
 * The bill, in full, opened from a list.
 *
 * WHY A SHEET AND NOT A ROUTE
 *   The requester said "next screen", and a route would have been the literal reading. It is
 *   the wrong one here: a bill opened from Closed today is read and then closed again, and a
 *   route costs a URL, a back button, a loading state and a second way to reach a bill that the
 *   Record payment dialog already reaches as a sheet. Standard 10.4 — consolidate before adding.
 *   The sheet fills the screen on a phone, which is where "next screen" is literally true.
 *
 * WHY IT RE-READS NOTHING
 *   Every figure here comes off the `OwnerBillView` the console already holds: the rounds and
 *   their lines, `totals` (which is where GST lives, at the bill's own rate), the per-table
 *   split, and — added with this screen — how the closure was recorded. A detail screen that
 *   fetched its own copy would be a second answer to "what did this bill come to", and the two
 *   would disagree on the first bill with a discount (Standard 7.4).
 *
 * THE PRINT PATH IS THE BROWSER'S, NOT THE THERMAL STACK'S
 *   Jalsa has a printer stack — `printer`, `print_job`, a character-grid template engine — and
 *   it exists to put KOTs and invoices on 58mm and 80mm paper at the counter. This button is
 *   not that: it is an owner, at a desk, wanting a copy of one bill. `window.print()` over a
 *   print stylesheet needs no machine to be online, no route, and no job to fail silently. If
 *   what was wanted is a thermal ticket, that is the other thing and it is a different build.
 */
export function BillDetailSheet({
  bill,
  open,
  onOpenChange,
  identity,
  whatsAppTemplate,
  invoice,
}: {
  bill: OwnerBillView | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  identity: RestaurantIdentity;
  whatsAppTemplate: WhatsAppTemplate;
  /**
   * The bill as the ONE invoice lays it out (item 8, 25-Sep-2026) - what "Print" puts on paper.
   * The browser copy used to be this detail sheet itself, a second invoice format.
   */
  invoice?: { lines: TicketLine[]; cols: number };
}) {
  if (!bill) return null;

  /* The owner's own WhatsApp template composes the message - the same function the Templates
     preview renders, so what the preview shows is what the guest receives. */
  const shareUrl = whatsAppShareUrl(billShareText(bill, identity, whatsAppTemplate));

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      posture="modal"
      title={`${bill.code} · ${bill.tables.join(', ')}`}
      description={`${bill.guests} ${bill.guests === 1 ? 'guest' : 'guests'} · opened ${bill.openedAt}${
        bill.closedAt ? ` · closed ${bill.closedAt}` : ''
      }`}
      testId="owner-bill-detail"
      footer={
        <>
          <Button data-testid="owner-bill-detail-close" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {/* `window.print()` and not a link: the sheet is already on screen and the print
              stylesheet in globals.css makes it the only thing on the page. */}
          <Button data-testid="owner-bill-print" variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          {/*
            A real anchor wearing the button's clothes, rather than a Button with `asChild`.

            Two reasons. It is a LINK — middle-click, long-press, "open in new tab" and a screen
            reader announcing it as a link are all correct here and all free. And the testid
            audit reads the source, where `asChild` puts the attribute on the Button while the
            anchor underneath is the element that actually ships; one element carrying its own
            name is what both the audit and a runner want.

            (And the tag names above are written out in words on purpose. The audit's matcher is
            a regex over the source with no idea what a comment is, so a bare angle-bracket tag
            in a sentence explaining the code is counted as an element missing an id — which is
            exactly how this comment first failed the gate.)

            `rel="noreferrer"` with `target="_blank"`: without it the opened tab gets a handle on
            this one through `window.opener`, and this tab is a signed-in owner console.
          */}
          <a
            data-testid="owner-bill-share-whatsapp"
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'primary', size: 'md' })}
          >
            Share to whatsapp
          </a>
        </>
      }
    >
      {/* ONE INVOICE (item 8). Print puts the invoice on paper - the same lines the counter
          printer is handed - and not this detail view, which was a second invoice format. The
          block is invisible on screen; `j-print-root` is what the print stylesheet keeps. */}
      {invoice ? (
        <div className="j-print-root hidden print:block" data-testid="owner-bill-invoice">
          <TicketPaper testId="owner-bill-invoice-paper" lines={invoice.lines} cols={invoice.cols} />
        </div>
      ) : null}
      <div className={cn('flex flex-col gap-4', invoice ? 'print:hidden' : 'j-print-root')}>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={bill.tone}>{bill.statusLabel}</Pill>
          <span className="type-caption text-[var(--text-muted)]">
            Captain {bill.spine.captain}
            {bill.spine.waiter ? ` · waiter ${bill.spine.waiter}` : ''}
          </span>
        </div>

        <div>
          <SectionLabel>What was ordered</SectionLabel>
          {bill.kots.length ? (
            <ul className="m-0 mt-1 flex list-none flex-col gap-3 p-0" data-testid="owner-bill-detail-rounds">
              {bill.kots.map((k) => (
                <li key={k.id}>
                  <p className="m-0 type-caption text-[var(--text-muted)]">
                    {k.code} · table {k.fromTable} · {k.placedAt} · {k.sourceLabel}
                  </p>
                  <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
                    {k.items.map((i) => (
                      <li key={i.id} className="flex items-center gap-2.5 type-caption">
                        <FoodMark type={i.foodType} />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate',
                            i.cancelled && 'text-[var(--text-muted)] line-through'
                          )}
                        >
                          {i.name}
                        </span>
                        <span className="tabular-nums text-[var(--text-muted)]">×{i.qty}</span>
                        <span className="w-16 text-right tabular-nums">{i.lineLabel}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 type-caption text-[var(--text-muted)]" data-testid="owner-bill-detail-empty">
              No rounds on this bill.
            </p>
          )}
        </div>

        {bill.perTable.length ? (
          <div>
            <SectionLabel>What each table ordered</SectionLabel>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {bill.perTable.map((t) => (
                <li key={t.table} className="flex justify-between type-caption">
                  <span>Table {t.table}</span>
                  <span className="tabular-nums text-[var(--text-muted)]">{t.amountLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* GST is in here, at this bill's own rate, because `totalsRows` puts it there. It is
            not recomputed for this screen — that is the whole point. */}
        <TotalsBlock rows={bill.totals} testId="owner-bill-detail-totals" />

        {bill.paymentMode ? (
          <div>
            <SectionLabel>How it was settled</SectionLabel>
            <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
              {bill.paymentMode}
              {bill.paymentReference ? ` · ${bill.paymentReference}` : ''}
              {bill.closedBy ? ` · recorded by ${bill.closedBy}` : ''}
              {bill.closedAt ? ` at ${bill.closedAt}` : ''}
            </p>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
