'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { billName, restaurantIdentity } from '@/lib/restaurant-identity';

/**
 * TableStandSheet — the two faces of the tabletop stand, previewed and printed from Settings.
 *
 * WHAT THE FRONT IS FOR
 *   A guest who has never scanned a code. The badge in the middle of the code says whose it is;
 *   the name and the place line say the same thing in words; and the six lines under it are the
 *   instructions the floor kept giving out loud — printed once, they stop being a conversation
 *   the captain has at every table. The wording is the owner's, as asked for, not paraphrased.
 *
 * WHAT THE BACK IS FOR
 *   The moment after the meal. The review code encodes the same link the guest's phone offers
 *   after payment, read from the same setting, so the card and the phone can never disagree.
 *   With no link set, the back says so instead of printing an empty square: a stand with a
 *   blank face reads as a printing mistake, a stand that names the missing setting reads as a
 *   thing to do.
 *
 * WHY TWO FACES ARE ONE PRINT
 *   `j-print-root` keeps this body and hides the console behind it; `j-print-break` starts the
 *   back on a new page. One print, two pages, folded once. On screen the faces sit side by side
 *   from `md` up so both can be checked before paper is spent, and stack on a phone.
 */

/** The preview grid. Pinned by `tests/render/table-stand.render.spec.ts`; change both. */
const STAND_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start';
/** One face of the card. Pinned by the same spec. */
const STAND_FACE =
  'flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-center';

/** The owner's own wording for the instructions, as requested. Do not paraphrase. */
const HOW_TO_SCAN = [
  'Open your phone’s Camera',
  'Point the camera at the QR code and wait for the link to appear.',
  'Tap the link to open it.',
] as const;

const IF_NOT_RECOGNISED = ['Open Google Lens and scan the QR code.', 'Then tap the link shown by Google Lens.'] as const;

export function TableStandSheet({
  table,
  onClose,
  qrOrigin,
  restaurant,
  settings,
}: {
  /** The table whose stand is open, or null when the sheet is closed. */
  table: string | null;
  onClose: () => void;
  qrOrigin: string;
  restaurant: Record<string, unknown>;
  settings: Record<string, Record<string, unknown>>;
}) {
  const copy = (settings.copy ?? {}) as Record<string, string>;
  const engagement = (settings.engagement ?? {}) as { reviewUrl?: string };
  const reviewUrl = (engagement.reviewUrl ?? '').trim();

  // The same sources the guest's phone reads: the copy panel's name and sub-line first, and the
  // identity block behind them when the copy panel has nothing.
  const name = copy.name || billName(restaurantIdentity(restaurant)) || 'Jalsa Restaurant';
  const subline = copy.subline || 'Hosur · since 2016';

  return (
    <Sheet
      open={table !== null}
      onOpenChange={(open) => !open && onClose()}
      posture="modal"
      title={table ? `Stand for table ${table}` : 'Table stand'}
      description="Two faces, one print. The front is the code and how to scan it; the back is the Google review code."
      testId="owner-stand-sheet"
      footer={
        <>
          <Button data-testid="owner-stand-close" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {/* window.print() and not a link: the sheet is already on screen and the print
              stylesheet makes it the only thing on the page, one face per sheet of paper. */}
          <Button data-testid="owner-stand-print" variant="primary" onClick={() => window.print()}>
            Print both faces
          </Button>
        </>
      }
    >
      {table ? (
        <div className={`j-print-root ${STAND_GRID}`} data-testid="owner-stand-faces">
          {/* ── Front ─────────────────────────────────────────────────────── */}
          <section className={STAND_FACE} data-testid="owner-stand-front" aria-label="Front of the stand">
            <p className="m-0 type-eyebrow text-[var(--primary)]">Scan to order</p>
            <h2 className="m-0 type-h2 text-[var(--text-heading)]">{name}</h2>
            <p className="m-0 type-caption text-[var(--text-muted)]">{subline}</p>

            {/* eslint-disable-next-line @next/next/no-img-element -- a generated vector the size it prints at; the optimiser would only cache a second copy of it. */}
            <img
              src={`/api/owner/qr?table=${encodeURIComponent(table)}`}
              alt={`QR code for table ${table}, with the Jalsa badge in the centre`}
              width={260}
              height={260}
              className="block h-[260px] w-[260px] max-w-full"
            />

            <p className="m-0 type-h3 text-[var(--text-heading)]">Table {table}</p>
            <p className="m-0 type-body text-[var(--text-body)]">
              The full menu is on your phone. Order as many rounds as you like — one bill at the end.
            </p>

            <div className="w-full text-left">
              <h3 className="m-0 type-body font-semibold text-[var(--text-heading)]">How to scan the QR code</h3>
              <ol className="m-0 mt-1 list-decimal pl-5 type-caption leading-relaxed text-[var(--text-body)]">
                {HOW_TO_SCAN.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
              <h3 className="m-0 mt-3 type-body font-semibold text-[var(--text-heading)]">If the QR code is not recognised</h3>
              <ol className="m-0 mt-1 list-decimal pl-5 type-caption leading-relaxed text-[var(--text-body)]">
                {IF_NOT_RECOGNISED.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>

            {/* An address has no spaces to wrap at. Without this it sets the card's floor width
                and, on a phone, pushes the whole face out of the dialog. */}
            <code className="break-all type-caption text-[var(--text-muted)]">
              {qrOrigin}/t/{table}
            </code>
          </section>

          {/* ── Back ──────────────────────────────────────────────────────── */}
          <section
            className={`j-print-break ${STAND_FACE}`}
            data-testid="owner-stand-back"
            aria-label="Back of the stand"
          >
            <p className="m-0 type-eyebrow text-[var(--primary)]">Enjoyed your meal?</p>
            <h2 className="m-0 type-h2 text-[var(--text-heading)]">Tell Google</h2>
            <p className="m-0 type-body text-[var(--text-body)]">
              A line from you helps the next table find us. Scan to leave a review — it takes a minute.
            </p>

            {reviewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- the same generated vector as the front. */}
                <img
                  src="/api/owner/review-qr"
                  alt="QR code for the Google review page, with the Jalsa badge in the centre"
                  width={260}
                  height={260}
                  className="block h-[260px] w-[260px] max-w-full"
                />
                <p className="m-0 type-caption text-[var(--text-muted)]">{name} · {subline}</p>
              </>
            ) : (
              <p
                className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]"
                data-testid="owner-stand-no-review"
              >
                No Google review link is set, so this face prints without a code. Add the link under Settings →
                Customer engagement and open this stand again.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </Sheet>
  );
}
