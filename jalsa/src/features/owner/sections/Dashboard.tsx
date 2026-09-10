'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, Pill, SectionLabel } from '@/components/ui/atoms';
import { Textarea } from '@/components/ui/field';
import { FirstRunState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';

/**
 * Screen 22 — the dashboard, and the landing screen.
 *
 * EVERY FIGURE IS A LINK, AND NAVIGATING PRE-APPLIES ITS FILTER (Standard 1.4)
 *   A number with no route to its detail invites a support question. The link is one line and
 *   removes the question entirely — and because every figure here is computed from the same read
 *   as the section it opens, the detail always reconciles with the number that was clicked.
 *
 * REQUESTS AND SUGGESTIONS ARE ON THE LANDING SCREEN ON PURPOSE
 *   Both are people waiting on a human answer, and both are invisible everywhere else in the
 *   building. A request older than five minutes turns red here at the same moment it turns red
 *   on the captain's phone — neither can assume the other has it (Standard 8.2).
 */
export function Dashboard({ data, go, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState('');

  const replies = ((data.settings.replies ?? {}) as { items?: Array<{ name: string; text: string }> }).items ?? [];
  const unanswered = data.suggestions.filter((s) => !s.repliedAt);

  return (
    <div className="flex flex-col gap-5" data-testid="owner-dashboard">
      <section>
        <SectionLabel>Today</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <MetricTile
            label="Sales recorded"
            value={data.today.salesLabel}
            note={`${data.closedToday.length} bills closed · excludes tips`}
            onClick={() => go('reports')}
            testId="owner-kpi-sales"
          />
          <MetricTile
            label="Open bills"
            value={String(data.today.openBills)}
            note={data.today.coversLabel}
            onClick={() => go('orders')}
            testId="owner-kpi-open"
          />
          <MetricTile
            label="Awaiting closure"
            value={String(data.today.awaitingClosure)}
            note="Guests have asked for the bill"
            onClick={() => go('payments')}
            testId="owner-kpi-closure"
            tone={data.today.awaitingClosure > 0 ? 'primary' : 'neutral'}
          />
          <MetricTile
            label="Tips collected"
            value={data.today.tipsLabel}
            note="Staff money — not income"
            onClick={() => go('ledgers')}
            testId="owner-kpi-tips"
          />
          <MetricTile
            label="Print failures"
            value={String(data.today.printFailures)}
            note={data.today.printFailures ? 'Orders are safe — tickets are not' : 'Every ticket printed'}
            onClick={() => go('orders')}
            testId="owner-kpi-print"
            tone={data.today.printFailures > 0 ? 'error' : 'neutral'}
          />
        </div>
      </section>

      {data.today.paymentMix.length ? (
        <section>
          <SectionLabel>Payment mix today</SectionLabel>
          <Card className="flex flex-wrap gap-x-6 gap-y-2">
            {data.today.paymentMix.map((p) => (
              <span key={p.mode} className="text-[13px]">
                <span className="font-semibold">{p.mode}</span>{' '}
                <span className="tabular-nums text-[var(--text-muted)]">
                  {p.amountLabel} · {p.count === 1 ? '1 bill' : `${p.count} bills`}
                </span>
              </span>
            ))}
          </Card>
        </section>
      ) : null}

      <section>
        <SectionLabel>Floor right now</SectionLabel>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-6">
          {data.floor.map((t) => (
            <li key={t.id}>
              <button
                data-testid={`owner-floor-${t.name}`}
                type="button"
                disabled={!t.billId}
                onClick={() => t.billId && go('orders', t.billId)}

                className={cn(
                  'w-full rounded-[var(--radius-md)] p-3 text-left shadow-[var(--shadow-card)] transition-colors',
                  'disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
                  t.tone === 'success'
                    ? 'bg-[var(--success-surface)] text-[var(--on-success-surface)]'
                    : t.tone === 'warning'
                      ? 'bg-[var(--warning-surface)] text-[var(--on-warning-surface)]'
                      : t.tone === 'primary'
                        ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                        : 'bg-[var(--surface)]'
                )}
              >
                <span className="block text-[14px] font-bold">{t.name}</span>
                <span className="block text-[10.5px] font-semibold">{t.stateLabel}</span>
                <span className="block text-[10.5px] opacity-75">{t.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionLabel>Table requests</SectionLabel>
        {data.requests.length === 0 ? (
          <Card>
            <p className="m-0 text-[12.5px] text-[var(--text-muted)]">
              Nothing waiting. Requests appear here the moment a guest taps, and turn red after five minutes.
            </p>
          </Card>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.requests.map((r) => (
              <li key={r.id}>
                <Card
                  className={cn(
                    'flex flex-wrap items-center gap-3 p-3',
                    r.urgent && 'bg-[var(--error-surface)] text-[var(--on-error-surface)]'
                  )}
                >
                  <span className="text-[13px] font-bold">Table {r.tableName}</span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    {r.kind}
                    {r.note ? <span className="opacity-75"> — {r.note}</span> : null}
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)]">{r.captain}</span>
                  <span className="text-[12px] font-bold tabular-nums">{r.ageMinutes} min</span>
                  <Button
                    data-testid={`owner-request-done-${r.id}`}
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      runBusy(async () => {
                        await send('/api/owner/action', { action: 'complete-request', requestId: r.id });
                        toast.show(`${r.kind} at ${r.tableName} marked done`, { tone: 'success' });
                      })
                    }
                  >
                    Done
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          Captains see the same list — either of you can clear it, and it clears for both.
        </p>
      </section>

      <section>
        <SectionLabel>Suggestions from guests</SectionLabel>
        {data.suggestions.length === 0 ? (
          <FirstRunState
            title="Nothing yet tonight"
            note="Anything a guest writes on their phone lands here, privately, for you to acknowledge with a reply."
            testId="owner-suggestions-empty"
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.suggestions.map((s) => (
              <li key={s.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-bold">Table {s.tableName ?? '—'}</span>
                    <span className="text-[11.5px] text-[var(--text-muted)]">
                      {new Date(s.createdAt).toLocaleTimeString('en-IN', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                    {!s.repliedAt ? <Pill tone="primary">New</Pill> : null}
                  </div>
                  <p className="m-0 mt-1.5 text-[13px] leading-relaxed">{s.body}</p>

                  {s.repliedAt ? (
                    <p className="m-0 mt-2 rounded-[var(--radius-md)] bg-[var(--success-surface)] px-3 py-2 text-[12px] leading-relaxed text-[var(--on-success-surface)]">
                      <strong>Your reply</strong> · {s.repliedBy} — {s.reply}
                    </p>
                  ) : replyTo === s.id ? (
                    <div className="mt-2.5 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {replies.map((r) => (
                          <button
                            data-testid={`owner-canned-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                            key={r.name}
                            type="button"
                            onClick={() => setReply(r.text)}

                            className="min-h-11 rounded-full border border-[var(--border-strong)]/25 px-3 text-[12px] font-semibold text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={3}
                        aria-label="Your reply"
                        data-testid="owner-reply-body"
                      />
                      <div className="flex gap-2">
                        <Button
                          data-testid="owner-reply-send"
                          size="sm"
                          disabled={busy || !reply.trim()}
                          onClick={() =>
                            runBusy(async () => {
                              await send('/api/owner/action', {
                                action: 'reply-suggestion',
                                suggestionId: s.id,
                                reply,
                              });
                              setReplyTo(null);
                              setReply('');
                              toast.show('Acknowledgement sent to the phone that wrote it', { tone: 'success' });
                            })
                          }
                        >
                          Send acknowledgement
                        </Button>
                        <Button
                          data-testid="owner-reply-cancel"
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyTo(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      data-testid={`owner-reply-${s.id}`}
                      size="sm"
                      variant="secondary"
                      className="mt-2.5"
                      onClick={() => {
                        setReplyTo(s.id);
                        setReply(replies[0]?.text ?? '');
                      }}
                    >
                      Send thanks
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
        {unanswered.length ? (
          <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
            {unanswered.length === 1 ? 'One guest is' : `${unanswered.length} guests are`} still waiting to hear back.
            They see the reply as a message from Jalsa, not from a system.
          </p>
        ) : null}
      </section>
    </div>
  );
}
