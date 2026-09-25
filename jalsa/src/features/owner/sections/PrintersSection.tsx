'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Chip, Pill, SectionLabel } from '@/components/ui/atoms';
import { Combobox } from '@/components/ui/combobox';
import { Field, Input } from '@/components/ui/field';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { FirstRunState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { BRIDGE_DOWNLOAD_ROUTE, DOWNLOAD_UNAVAILABLE } from '@/lib/print-bridge-download';
import {
  COMPUTER_WORDS,
  OWNER_PRINT_MESSAGES,
  addedOnLabel,
  computerState,
  lastPrintedLabel,
  printerReadiness,
  testPrintProgress,
} from '@/lib/print-computer';
import type { DiscoveredPrinterRow, PrintComputerRow, PrinterRow } from '@/lib/db/types';
import type { OwnerSectionProps } from '../OwnerConsole';
import { PrintSetupSection } from './PrintSetupSection';

/**
 * Printers — the owner's own entry point to printing (23-Sep-2026).
 *
 * WHAT THIS SCREEN IS FOR
 *   One journey, in the owner's words: connect the computer the printer is plugged into, choose
 *   the printer, say which station it serves, print a test. "Bridge", "token", "queue name",
 *   "environment variable" and "machine id" appear nowhere on it. They are how it works, not what
 *   the owner is doing.
 *
 * WHAT IT REUSES
 *   Everything underneath. A test print here is the same `test-print` action, the same
 *   `print_job`, the same claim → TicketLine[] → ESC/POS → transport → report path as a kitchen
 *   ticket. "Manage" opens the existing Print setup — Overview, Printers, Bridges, Templates,
 *   Routing, History — unchanged, for whoever wants the detail.
 *
 * THE SENTENCES COME FROM `print-computer.ts`, not from here, so the card, the test-print result
 * and the history row cannot drift apart.
 */

/**
 * The clock, as state — read once per interval, never during render. React 19's purity rule
 * (and its double-invoked renders) forbids `Date.now()` inside a component; a countdown and a
 * "last seen two minutes ago" both need the time, so they take it from here.
 */
function useNow(intervalMs: number): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** A Windows queue name, tidied into what a person would call the printer. */
const suggestedName = (queueName: string): string => queueName.replace(/\s*\((copy|redirected)[^)]*\)\s*$/i, '').trim();

type Target = { kind: 'existing'; printerId: string } | { kind: 'new'; name: string; station: string; paperMm: number; purpose: string };

export function PrintersSection(props: OwnerSectionProps) {
  const { data, send, runBusy, busy } = props;
  const toast = useToast();
  const canEdit = data.grants.includes('set.printer');
  const [manage, setManage] = React.useState(false);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [choosing, setChoosing] = React.useState<{
    computer: PrintComputerRow;
    printer: DiscoveredPrinterRow;
    /** The Jalsa printer this Windows printer prints as now, when it is being CHANGED (B3). */
    currentPrinterId?: string;
  } | null>(null);
  const [disconnecting, setDisconnecting] = React.useState<PrintComputerRow | null>(null);
  const [deleting, setDeleting] = React.useState<PrinterRow | null>(null);
  /* WHICH printer is being tested, and the job it queued — so the line beside the button follows
     that one job through History rather than guessing from the latest row. */
  const [testing, setTesting] = React.useState<string | null>(null);
  const [testJobs, setTestJobs] = React.useState<Record<string, string>>({});

  const now = useNow(15_000);
  const computers = data.printComputers;
  const mappingByPrinter = new Map(data.printerMappings.map((m) => [m.printerId, m]));
  const computerById = new Map(computers.map((c) => [c.id, c]));
  const printerById = new Map(data.printers.map((p) => [p.id, p]));
  // EVERY printer, those on a computer first (item 1, 25-Sep-2026). This list used to hold only
  // printers on a computer, so a printer that was never mapped - or whose computer was
  // disconnected - could not be seen or deleted from here at all.
  const listed = [
    ...data.printers.filter((p) => mappingByPrinter.has(p.id)),
    ...data.printers.filter((p) => !mappingByPrinter.has(p.id)),
  ];
  const nothingYet = computers.length === 0 && !data.pairing;

  const runTest = (p: PrinterRow): void => {
    if (testing) return;
    setTesting(p.id);
    void (async () => {
      try {
        const result = await send<{ queued: boolean; jobId: string | null; printerName: string; reason: string }>(
          '/api/owner/action',
          { action: 'test-print', printerId: p.id }
        );
        if (result.queued && result.jobId) {
          const jobId = result.jobId;
          setTestJobs((prev) => ({ ...prev, [p.id]: jobId }));
        } else {
          toast.show(result.reason, { tone: 'error' });
        }
      } catch (err: unknown) {
        toast.show(err instanceof Error ? err.message : 'That test could not be sent.', { tone: 'error' });
      } finally {
        setTesting(null);
      }
    })();
  };

  const removeMapping = (p: PrinterRow): void => {
    void runBusy(async () => {
      await send('/api/owner/action', { action: 'remove-printer-mapping', printerId: p.id });
      toast.show(`${p.name} is no longer on a computer`, { tone: 'success' });
    });
  };

  /* Delete only after the confirmation, and only once the server has confirmed it: the dialog
     stays open and the toast says why when it is refused (tickets still waiting on it). The
     console reloads from the database after every action, so the row goes because it is gone. */
  const removePrinter = (p: PrinterRow): void => {
    void runBusy(async () => {
      await send('/api/owner/action', { action: 'delete-printer', printerId: p.id });
      setDeleting(null);
      toast.show(`${p.name} deleted`, { tone: 'success' });
    });
  };

  const disconnect = (c: PrintComputerRow): void => {
    void runBusy(async () => {
      await send('/api/owner/action', { action: 'revoke-bridge-token', tokenId: c.id });
      setDisconnecting(null);
      toast.show(`${c.label} can no longer print for this restaurant`, { tone: 'success' });
    });
  };

  if (manage) {
    return (
      <div className="flex flex-col gap-4" data-testid="owner-printers-manage">
        <div>
          <Button data-testid="owner-printers-back" variant="ghost" size="sm" onClick={() => setManage(false)}>
            ← Back to Printers
          </Button>
        </div>
        <PrintSetupSection {...props} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="owner-printers">
      {nothingYet ? (
        <Card className="flex flex-col gap-3">
          <FirstRunState
            testId="owner-printers-empty"
            title="Connect your printing computer"
            note="Install Jalsa Print Bridge on the Windows computer connected to your thermal printer. Kitchen tickets and bills print from there."
            {...(canEdit
              ? { action: { label: 'Connect Printing Computer', onClick: () => setSetupOpen(true), testId: 'owner-printers-connect' } }
              : {})}
          />
        </Card>
      ) : null}

      {/* ── Printers ─────────────────────────────────────────────────────── */}
      {listed.length ? (
        <Card className="flex flex-col gap-3">
          <SectionLabel>Printers</SectionLabel>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {listed.map((p) => {
              const mapping = mappingByPrinter.get(p.id) ?? null;
              const computer = mapping ? (computerById.get(mapping.computerId) ?? null) : null;
              const discovered = computer && mapping ? (computer.discovered.find((d) => d.queueName === mapping.queueName) ?? null) : null;
              const readiness = printerReadiness({
                name: p.name,
                enabled: p.enabled,
                mapping,
                computer: computer ? { lastSeenAt: computer.lastSeenAt, revoked: false } : null,
                discovered,
                now,
              });
              const jobId = testJobs[p.id];
              const job = jobId ? (data.printJobs.find((j) => j.id === jobId) ?? null) : null;
              const progress = jobId ? (testPrintProgress(job, p.name) ?? { text: OWNER_PRINT_MESSAGES.sending, tone: 'info' as const }) : null;
              return (
                <li key={p.id}>
                  <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3" data-testid={`owner-printers-printer-${p.id}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-[10rem] flex-1">
                        <span className="block type-caption text-[var(--text-muted)]">{p.station}</span>
                        <span className="block type-body font-semibold">{p.name}</span>
                        <span className="block type-caption text-[var(--text-muted)]" data-testid={`owner-printers-added-${p.id}`}>
                          {addedOnLabel(p.createdAt)}
                        </span>
                        <span className="block type-caption text-[var(--text-muted)]">
                          {computer ? `On ${computer.label}` : 'Not on a computer'} · {lastPrintedLabel(p.lastPrintedAt)}
                        </span>
                      </span>
                      <Pill tone={readiness.tone}>{readiness.word}</Pill>
                      {canEdit ? (
                        <Button
                          data-testid={`owner-printers-test-${p.id}`}
                          size="sm"
                          variant="secondary"
                          disabled={testing === p.id || readiness.tone === 'warning' || readiness.tone === 'error'}
                          onClick={() => runTest(p)}
                        >
                          {testing === p.id ? 'Sending…' : 'Test Print'}
                        </Button>
                      ) : null}
                      {canEdit && mapping ? (
                        <Button
                          data-testid={`owner-printers-remove-${p.id}`}
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => removeMapping(p)}
                        >
                          Remove
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <Button
                          data-testid={`owner-printers-delete-${p.id}`}
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setDeleting(p)}
                          className="text-[var(--error)]"
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                    {readiness.message ? (
                      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">{readiness.message}</p>
                    ) : null}
                    {progress ? (
                      <p
                        data-testid={`owner-printers-test-status-${p.id}`}
                        className={
                          progress.tone === 'error'
                            ? 'm-0 type-caption font-semibold text-[var(--error)]'
                            : progress.tone === 'success'
                              ? 'm-0 type-caption font-semibold text-[var(--success)]'
                              : 'm-0 type-caption text-[var(--text-muted)]'
                        }
                      >
                        {progress.text}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* ── Printing computers ───────────────────────────────────────────── */}
      {computers.length || data.pairing ? (
        <Card className="flex flex-col gap-3">
          <SectionLabel>Printing computer{computers.length === 1 ? '' : 's'}</SectionLabel>
          {data.pairing && !computers.some((c) => c.label === data.pairing?.label) ? (
            <p data-testid="owner-printers-waiting" className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]">
              Waiting for <strong>{data.pairing.label}</strong> to connect. {OWNER_PRINT_MESSAGES.notInstalled}{' '}
              Finish the installer on that computer, or {canEdit ? 'get a new code below.' : 'ask the owner for a new code.'}
            </p>
          ) : null}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {computers.map((c) => {
              const state = computerState(c.lastSeenAt, now);
              const words = COMPUTER_WORDS[state];
              const real = c.discovered.filter((d) => !d.isVirtual);
              const software = c.discovered.filter((d) => d.isVirtual);
              return (
                <li key={c.id}>
                  <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3" data-testid={`owner-printers-computer-${c.id}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-[10rem] flex-1">
                        <span className="block type-body font-semibold">{c.label}</span>
                        <span className="block type-caption text-[var(--text-muted)]">
                          {c.hostname ? `${c.hostname} · ` : ''}
                          {c.source === 'paired' ? 'Jalsa Print Bridge' : 'Set up by hand'}
                          {c.bridgeVersion ? ` ${c.bridgeVersion}` : ''}
                        </span>
                      </span>
                      <Pill tone={words.tone}>{words.word}</Pill>
                      {canEdit ? (
                        <Button data-testid={`owner-printers-disconnect-${c.id}`} size="sm" variant="ghost" disabled={busy} onClick={() => setDisconnecting(c)}>
                          Disconnect
                        </Button>
                      ) : null}
                    </div>
                    {state === 'not-running' ? (
                      <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
                        {OWNER_PRINT_MESSAGES.notRunning} Restart the computer, or run the installer again on it.
                      </p>
                    ) : null}

                    <div className="flex flex-col gap-1.5">
                      <span className="type-eyebrow font-bold uppercase tracking-[0.11em] text-[var(--text-muted)]">Available printers</span>
                      {c.discovered.length === 0 ? (
                        <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
                          {state === 'connected'
                            ? 'No printer has been found on this computer yet. Check the printer is plugged in and switched on — the list updates by itself.'
                            : 'The list appears once this computer connects.'}
                        </p>
                      ) : (
                        <ul className="m-0 flex list-none flex-col gap-1 p-0">
                          {[...real, ...software].map((d) => {
                            const mapped = data.printerMappings.find((m) => m.computerId === c.id && m.queueName === d.queueName);
                            const jalsaPrinter = mapped ? printerById.get(mapped.printerId) : undefined;
                            const word =
                              d.status === 'ready' ? 'Available' : d.status === 'offline' ? 'Offline' : d.status === 'error' ? 'Needs attention' : 'Unknown';
                            return (
                              <li key={d.queueName} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface)] px-3 py-2">
                                <span className="min-w-[8rem] flex-1">
                                  <span className="block type-body">{d.queueName}</span>
                                  <span className="block type-caption text-[var(--text-muted)]">
                                    {d.isVirtual ? 'Software printer' : d.portName.toUpperCase().startsWith('USB') ? 'USB' : d.portName || 'Windows printer'}
                                  </span>
                                </span>
                                <Pill tone={d.status === 'ready' ? 'success' : d.status === 'unknown' ? 'neutral' : 'error'}>{word}</Pill>
                                {jalsaPrinter ? (
                                  <>
                                    <span className="type-caption font-semibold">→ {jalsaPrinter.station} · {jalsaPrinter.name}</span>
                                    {/* Change what it prints as, or stop using it, from right here (B3):
                                        a mapped printer used to show no control at all. */}
                                    {canEdit ? (
                                      <>
                                        <Button
                                          data-testid={`owner-printers-change-${c.id}-${d.queueName.replace(/[^A-Za-z0-9]+/g, '-')}`}
                                          size="sm"
                                          variant="secondary"
                                          disabled={busy}
                                          onClick={() => setChoosing({ computer: c, printer: d, currentPrinterId: jalsaPrinter.id })}
                                        >
                                          Change
                                        </Button>
                                        <Button
                                          data-testid={`owner-printers-stop-${c.id}-${d.queueName.replace(/[^A-Za-z0-9]+/g, '-')}`}
                                          size="sm"
                                          variant="ghost"
                                          disabled={busy}
                                          onClick={() => removeMapping(jalsaPrinter)}
                                        >
                                          Stop using
                                        </Button>
                                      </>
                                    ) : null}
                                  </>
                                ) : canEdit ? (
                                  <Button
                                    data-testid={`owner-printers-select-${c.id}-${d.queueName.replace(/[^A-Za-z0-9]+/g, '-')}`}
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => setChoosing({ computer: c, printer: d })}
                                  >
                                    Select
                                  </Button>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {!nothingYet ? (
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button data-testid="owner-printers-connect-another" variant="secondary" size="sm" onClick={() => setSetupOpen(true)}>
              Connect another computer
            </Button>
          ) : null}
          <Button data-testid="owner-printers-manage" variant="ghost" size="sm" onClick={() => setManage(true)}>
            Manage
          </Button>
        </div>
      ) : null}

      <SetupSheet {...props} open={setupOpen} onClose={() => setSetupOpen(false)} />

      <ChoosePrinterSheet
        {...props}
        choosing={choosing}
        onClose={() => setChoosing(null)}
        existing={data.printers}
        placeOf={(id) => {
          // Where a printer is now, so choosing it here says it will MOVE (B3). The server's
          // one-computer-per-printer upsert already moved it; the chooser used to hide it.
          const m = mappingByPrinter.get(id);
          if (!m) return null;
          return `${computerById.get(m.computerId)?.label ?? 'another computer'} · ${m.queueName}`;
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : 'Delete printer'}
        consequence={
          <>
            <strong>{deleting?.name}</strong>
            {deleting ? ` (${deleting.station}, ${deleting.paperMm} mm)` : ''} is removed from Jalsa and from any computer
            it is on. Categories it printed go to the main kitchen printer. Its past tickets stay in History.
          </>
        }
        confirmLabel="Delete the printer"
        onConfirm={() => deleting && removePrinter(deleting)}
        testId="owner-printers-delete-confirm"
        busy={busy}
      />

      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title={disconnecting ? `Disconnect ${disconnecting.label}?` : 'Disconnect'}
        consequence={
          <>
            Its printers are taken off <strong>{disconnecting?.label}</strong>, and their tickets go to the main kitchen
            printer. To use this computer again, connect it with a new pairing code and select its printers again. The
            computer itself is not changed.
          </>
        }
        confirmLabel="Disconnect the computer"
        onConfirm={() => disconnecting && disconnect(disconnecting)}
        testId="owner-printers-disconnect-confirm"
        busy={busy}
      />
    </div>
  );
}

/* ── Connect Printing Computer ─────────────────────────────────────────── */

/**
 * The setup, as four things to do — download, install, type the code, choose the printer — in
 * one sheet, so the owner is never sent to a different screen to find out what comes next.
 */
function SetupSheet({ data, send, open, onClose }: OwnerSectionProps & { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [label, setLabel] = React.useState('Kitchen PC');
  const [issued, setIssued] = React.useState<{ code: string; label: string; expiresAt: string; at: number } | null>(null);
  const [issuing, setIssuing] = React.useState(false);
  // Once a second, for the countdown. Cheap: the sheet is small and open for minutes at most.
  const now = useNow(1000);

  const download = data.printBridgeDownload.available;
  const secondsLeft = issued ? Math.max(0, Math.floor((new Date(issued.expiresAt).getTime() - now.getTime()) / 1000)) : 0;
  const arrived = issued
    ? data.printComputers.find((c) => c.label === issued.label && c.source === 'paired' && new Date(c.createdAt).getTime() >= issued.at - 60_000)
    : undefined;

  const issue = (): void => {
    if (issuing) return;
    setIssuing(true);
    void (async () => {
      try {
        const res = await send<{ code: string; label: string; expiresAt: string }>('/api/owner/action', {
          action: 'issue-pairing-code',
          label,
        });
        // The code lives in this component for as long as the sheet is open, and nowhere else.
        setIssued({ ...res, at: new Date(res.expiresAt).getTime() - 10 * 60_000 });
      } catch (err: unknown) {
        toast.show(err instanceof Error ? err.message : 'A code could not be made.', { tone: 'error' });
      } finally {
        setIssuing(false);
      }
    })();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      posture="modal"
      title="Connect your printing computer"
      description="On the Windows computer the thermal printer is plugged into."
      testId="owner-printers-setup"
      footer={
        <Button data-testid="owner-printers-setup-done" variant={arrived ? 'primary' : 'ghost'} onClick={onClose}>
          {arrived ? 'Choose the printer' : 'Close'}
        </Button>
      }
    >
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        <li className="flex flex-col gap-2">
          <span className="type-body font-semibold">1 · Download Jalsa Print Bridge</span>
          {download ? (
            <div>
              <Button asChild data-testid="owner-printers-download">
                <a href={BRIDGE_DOWNLOAD_ROUTE} download data-testid="owner-printers-download">
                  Download for Windows
                </a>
              </Button>
            </div>
          ) : (
            <p data-testid="owner-printers-download-unavailable" className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-warning-surface)]">
              {DOWNLOAD_UNAVAILABLE}
            </p>
          )}
        </li>
        <li className="flex flex-col gap-1">
          <span className="type-body font-semibold">2 · Install it</span>
          <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
            Open the downloaded folder and double-click <strong>Install Jalsa Print Bridge</strong>. Windows asks for permission — choose Yes.
            Nothing else needs installing.
          </p>
        </li>
        <li className="flex flex-col gap-2">
          <span className="type-body font-semibold">3 · Pair this computer</span>
          {issued && !arrived ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
                When the installer asks, type this code. It works once and for the next{' '}
                {secondsLeft > 0 ? `${Math.ceil(secondsLeft / 60)} minute${secondsLeft > 60 ? 's' : ''}` : 'few minutes'}.
              </p>
              {secondsLeft > 0 ? (
                <code
                  data-testid="owner-printers-pairing-code"
                  className="block rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 text-center type-metric font-bold tracking-[0.2em]"
                >
                  {issued.code}
                </code>
              ) : (
                <p data-testid="owner-printers-pairing-expired" className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-4 py-3 type-caption text-[var(--on-warning-surface)]">
                  That code has expired. Get a new one.
                </p>
              )}
              <p className="m-0 type-caption text-[var(--text-muted)]">
                Waiting for <strong>{issued.label}</strong> to connect…
              </p>
              <div>
                <Button data-testid="owner-printers-new-code" variant="ghost" size="sm" disabled={issuing} onClick={issue}>
                  Get a new code
                </Button>
              </div>
            </div>
          ) : arrived ? (
            <p data-testid="owner-printers-paired" className="m-0 rounded-[var(--radius-md)] bg-[var(--success-surface)] px-4 py-3 type-body font-semibold text-[var(--on-success-surface)]">
              {arrived.label} is connected.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Name this computer" htmlFor="owner-printers-label" hint="What somebody standing next to it would call it.">
                <Input
                  id="owner-printers-label"
                  data-testid="owner-printers-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Kitchen PC"
                />
              </Field>
              <Button data-testid="owner-printers-show-code" disabled={issuing || !label.trim()} onClick={issue}>
                {issuing ? 'One moment…' : 'Show pairing code'}
              </Button>
            </div>
          )}
        </li>
        <li className="flex flex-col gap-1">
          <span className="type-body font-semibold">4 · Choose the printer</span>
          <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
            Once the computer connects, its printers are listed here under Printing computer. Select one, say which station
            it serves, and press Test Print.
          </p>
        </li>
      </ol>
    </Sheet>
  );
}

/* ── Select a printer ──────────────────────────────────────────────────── */

function ChoosePrinterSheet({
  send,
  runBusy,
  busy,
  choosing,
  onClose,
  existing,
  placeOf,
}: OwnerSectionProps & {
  choosing: { computer: PrintComputerRow; printer: DiscoveredPrinterRow; currentPrinterId?: string } | null;
  onClose: () => void;
  existing: PrinterRow[];
  placeOf: (printerId: string) => string | null;
}) {
  const toast = useToast();
  const [target, setTarget] = React.useState<Target>({ kind: 'new', name: '', station: 'Main Kitchen', paperMm: 80, purpose: 'KOT' });

  // Reset the form for each printer chosen. The suggested name comes from Windows' own name.
  const key = choosing ? `${choosing.computer.id}/${choosing.printer.queueName}` : '';
  const [formKey, setFormKey] = React.useState(key);
  if (key !== formKey) {
    setFormKey(key);
    setTarget(
      choosing?.currentPrinterId
        ? { kind: 'existing', printerId: choosing.currentPrinterId }
        : { kind: 'new', name: choosing ? suggestedName(choosing.printer.queueName) : '', station: 'Main Kitchen', paperMm: 80, purpose: 'KOT' }
    );
  }

  const stations = [...new Set(['Main Kitchen', 'Tandoor', 'Billing', ...existing.map((p) => p.station)])];

  const save = (): void => {
    if (!choosing) return;
    void runBusy(async () => {
      await send('/api/owner/action', {
        action: 'save-printer-mapping',
        computerId: choosing.computer.id,
        queueName: choosing.printer.queueName,
        ...(target.kind === 'existing'
          ? { printerId: target.printerId }
          : { name: target.name, station: target.station, paperMm: target.paperMm, purpose: target.purpose }),
      });
      onClose();
      toast.show('Printer saved. Press Test Print to check it.', { tone: 'success' });
    });
  };

  const valid = target.kind === 'existing' ? !!target.printerId : !!target.name.trim() && !!target.station.trim();

  return (
    <Sheet
      open={choosing !== null}
      onOpenChange={(o) => !o && onClose()}
      posture="modal"
      title="Set up this printer"
      description={choosing ? `${choosing.printer.queueName} on ${choosing.computer.label}` : ''}
      testId="owner-printers-choose"
      footer={
        <>
          <Button data-testid="owner-printers-choose-cancel" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="owner-printers-save" disabled={busy || !valid} onClick={save}>
            Save Printer
          </Button>
        </>
      }
    >
      {choosing ? (
        <div className="flex flex-col gap-3">
          {/* Searchable, like every picker on this console (CP-27) — and the list is short enough that
              the first thing the owner sees is every choice. */}
          <Field label="Use it as" htmlFor="owner-printers-target">
            <Combobox
              id="owner-printers-target"
              testId="owner-printers-target"
              ariaLabel="Use this printer as"
              value={target.kind === 'existing' ? target.printerId : 'new'}
              onValueChange={(v) =>
                setTarget(
                  v === 'new'
                    ? { kind: 'new', name: suggestedName(choosing.printer.queueName), station: 'Main Kitchen', paperMm: 80, purpose: 'KOT' }
                    : { kind: 'existing', printerId: v }
                )
              }
              options={[
                { value: 'new', label: 'A new printer' },
                ...existing.map((p) => {
                  const place = p.id === choosing.currentPrinterId ? null : placeOf(p.id);
                  return {
                    value: p.id,
                    label: p.name,
                    hint: place ? `${p.station} · now on ${place} — moves here` : `${p.station} · already in Jalsa`,
                  };
                }),
              ]}
              placeholder="A new printer, or one already in Jalsa"
            />
          </Field>

          {target.kind === 'new' ? (
            <>
              <Field label="Printer name" required htmlFor="owner-printers-name">
                <Input
                  id="owner-printers-name"
                  data-testid="owner-printers-name"
                  value={target.name}
                  onChange={(e) => setTarget({ ...target, name: e.target.value })}
                  placeholder="TVS RP3160"
                />
              </Field>
              <Field label="Station" required htmlFor="owner-printers-station" hint="Where in the building this printer is. Type a new one to add it.">
                <Combobox
                  id="owner-printers-station"
                  testId="owner-printers-station"
                  ariaLabel="Station"
                  value={target.station}
                  onValueChange={(station) => setTarget({ ...target, station })}
                  options={stations.map((st) => ({ value: st, label: st }))}
                  placeholder="Tandoor"
                  allowCreate
                  // A station is a word on a ticket, not a row anywhere: creating one is choosing it.
                  onCreate={async (name) => name.trim()}
                />
              </Field>
              <div className="flex flex-wrap gap-6">
                <div className="flex flex-col gap-1.5">
                  <span className="type-caption font-semibold">What it prints</span>
                  <div className="flex gap-2">
                    <Chip on={target.purpose === 'KOT'} onClick={() => setTarget({ ...target, purpose: 'KOT' })} data-testid="owner-printers-purpose-kot">
                      Kitchen tickets
                    </Chip>
                    <Chip on={target.purpose === 'Invoice'} onClick={() => setTarget({ ...target, purpose: 'Invoice' })} data-testid="owner-printers-purpose-bill">
                      Bills
                    </Chip>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="type-caption font-semibold">Paper</span>
                  <div className="flex gap-2">
                    <Chip on={target.paperMm === 80} onClick={() => setTarget({ ...target, paperMm: 80 })} data-testid="owner-printers-paper-80">
                      80 mm
                    </Chip>
                    <Chip on={target.paperMm === 58} onClick={() => setTarget({ ...target, paperMm: 58 })} data-testid="owner-printers-paper-58">
                      58 mm
                    </Chip>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
              Its station, paper width and routing stay exactly as they are. Only how Jalsa reaches it changes.
            </p>
          )}
        </div>
      ) : null}
    </Sheet>
  );
}
