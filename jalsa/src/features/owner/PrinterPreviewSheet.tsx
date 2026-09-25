'use client';

import * as React from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { TicketPaper } from '@/components/ui/print';
import { PAPER, type PaperWidth, type TemplateConfig, type TicketKind } from '@/lib/print-template';
import { previewIdentity, previewTaxRate, ticketPreview } from '@/lib/ticket-preview';
import type { PrinterRow } from '@/lib/db/types';
import type { OwnerSectionProps } from './OwnerConsole';

/**
 * Preview - what THIS machine will print, for a kitchen ticket or a bill (item 9, 25-Sep-2026).
 *
 * The lines are `ticketPreview`'s: the saved template for that kind, at this machine's paper
 * width, through the same builders the printer's own path calls. The bill is the latest real bill
 * when there is one - its items in the order they were ordered - so the preview is that bill as
 * the counter would print it, not a picture of one.
 */
export function PrinterPreviewSheet({
  data,
  printer,
  kind,
  onClose,
  onTest,
  testing,
}: {
  data: OwnerSectionProps['data'];
  printer: PrinterRow | null;
  kind: TicketKind;
  onClose: () => void;
  onTest?: (p: PrinterRow, kind: TicketKind) => void;
  testing?: boolean;
}) {
  if (!printer) return null;
  const width: PaperWidth = printer.paperMm === 58 ? '58' : '80';
  const stored = (data.settings.print ?? {}) as Partial<Record<TicketKind, Partial<TemplateConfig>>>;
  const latest = data.closedToday[0]?.invoice ?? data.openBills[0]?.invoice ?? null;
  const preview = ticketPreview({
    kind,
    width,
    template: stored[kind],
    menu: data.menu,
    who: previewIdentity(data.restaurant as Record<string, unknown>, data.settings),
    taxRate: previewTaxRate(data.settings),
    bill: latest,
  });
  const what = kind === 'kot' ? 'Kitchen ticket' : 'Bill';

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      posture="modal"
      title={`Preview · ${what}`}
      description={`${printer.name} · ${PAPER[width].mm} mm · ${preview.cols} characters a line. ${preview.source}.`}
      testId="owner-printer-preview"
      footer={
        <>
          <Button data-testid="owner-printer-preview-close" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {onTest ? (
            <Button data-testid="owner-printer-preview-test" variant="secondary" disabled={testing} onClick={() => onTest(printer, kind)}>
              {testing ? 'Sending…' : 'Test Print'}
            </Button>
          ) : null}
        </>
      }
    >
      {data.menu.length === 0 && kind === 'kot' ? (
        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]" data-testid="owner-printer-preview-empty">
          Add items to the menu to see a kitchen ticket built from them.
        </p>
      ) : (
        <TicketPaper testId="owner-printer-preview-paper" lines={preview.lines} cols={preview.cols} />
      )}
    </Sheet>
  );
}
