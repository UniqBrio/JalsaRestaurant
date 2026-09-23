'use client';

import * as React from 'react';
import { CHIP_NAV_WRAP } from '@/lib/chip-nav';
import { Card, Chip, SectionLabel } from '@/components/ui/atoms';
import { DataTable } from '@/components/ui/data-table';
import { Field, Input } from '@/components/ui/field';
import { FirstRunState } from '@/components/ui/states';
import { rupees } from '@/lib/money';
import {
  PRESET_LABEL,
  checkRange,
  rangeLabel,
  resolvePreset,
  type DateRange,
  type RangePreset,
} from '@/lib/report-range';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';

/**
 * The four report panels, under ONE date range.
 *
 * `Jalsa Navigation Flowchart.dc.html`, section three: *"Sales, purchases and expenses, final
 * report, all-orders ledger. **One date range governs every panel**; each exports."*
 *
 * WHY THE RANGE SITS ABOVE THE TABS
 *   Four panels with four ranges is four answers to "how did last week go", and somebody will
 *   read the sales off one and the purchases off another and subtract them. The net would be
 *   wrong and nothing on the screen would say so. So the range is one piece of state, above the
 *   tabs, and every panel below is a projection of the same rows.
 *
 * WHY THE ROWS COME FROM THEIR OWN ENDPOINT
 *   The console payload is polled every few seconds and carries the whole building. A thirty-day
 *   range is thousands of bills with their rounds and lines; on the poll, every screen would pay
 *   for a report nobody opened. `/api/owner/report` is fetched when the range changes and not
 *   otherwise.
 *
 * WHAT CHANGED, AND WHAT THE OLD SCREEN SAID
 *   This section used to read `data.closedToday` and its Final report tab carried an honest
 *   empty state: *"the final report needs a date range … a range control that silently only ever
 *   meant today would be worse than none."* That was true and is now obsolete. The range is
 *   real, the read is ranged, and the Final report is computed from it.
 *
 * Uplift is NOT among these four. The flowchart carries it as its own top-level section and that
 * is where it lives (see `UpliftSection`, and DC-001).
 */
type ReportTab = 'sales' | 'orders' | 'expenses' | 'final';

const REPORT_TABS: Array<{ key: ReportTab; label: string }> = [
  { key: 'sales', label: 'Sales & products' },
  { key: 'orders', label: 'All orders' },
  { key: 'expenses', label: 'Purchases & expenses' },
  { key: 'final', label: 'Final report' },
];

const PRESETS: RangePreset[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth'];

interface RangeReport {
  range: DateRange;
  summary: {
    bills: number;
    covers: number;
    sales: number;
    salesLabel: string;
    purchasesLabel: string;
    netLabel: string;
    net: number;
    tipsLabel: string;
    discountsLabel: string;
    taxLabel: string;
    averageBillLabel: string;
    byCategory: Array<{ category: string; amount: number; amountLabel: string }>;
    gstSplit: {
      gst: GstPanelSide;
      nonGst: GstPanelSide;
    };
    byPaymentMode: Array<{ mode: string; amount: number; bills: number; amountLabel: string; share: number }>;
  };
  products: Array<{ name: string; qty: number; revenue: number }>;
  categories: Array<{ category: string; qty: number; revenue: number; dishes: number }>;
  orders: Array<{
    id: string;
    code: string;
    tables: string;
    captain: string;
    guests: number;
    rounds: number;
    sources: string;
    closedOn: string;
    payable: number;
    payableLabel: string;
  }>;
  expenses: Array<{ id: string; spentOn: string; category: string; note: string; amount: number; enteredBy: string }>;
}

export function ReportsSection({ data }: OwnerSectionProps) {
  const [tab, setTab] = React.useState<ReportTab>('sales');
  const [preset, setPreset] = React.useState<RangePreset>('today');
  const [range, setRange] = React.useState<DateRange>(() => resolvePreset('today', new Date()));
  /**
   * ONE PIECE OF STATE, STAMPED WITH THE RANGE IT ANSWERS.
   *
   * A separate `loading` flag would have to be set synchronously as the effect starts, and a
   * separate `problem` would have to be cleared there too — both are cascading renders, and both
   * are avoidable: whether this is still loading is simply whether the answer in hand was fetched
   * for the range currently on screen. An answer carrying its own key also cannot be shown
   * against a different range by a response that arrived late.
   */
  const [result, setResult] = React.useState<{
    key: string;
    report: RangeReport | null;
    problem: string | null;
  } | null>(null);

  const verdict = checkRange(range, new Date());
  const key = `${range.from}|${range.to}`;

  React.useEffect(() => {
    if (verdict.problem) return;
    let cancelled = false;
    const [from, to] = key.split('|');
    fetch(`/api/owner/report?from=${from}&to=${to}`)
      .then(async (res) => {
        const body = (await res.json()) as { data?: RangeReport; error?: { message?: string } };
        if (cancelled) return;
        // The reason the SERVER gave, not a generic one: a report that will not load is either a
        // question about permission or one about the dates, and those need different actions.
        setResult({
          key,
          report: res.ok ? (body.data ?? null) : null,
          problem: res.ok ? null : (body.error?.message ?? 'The report could not be read.'),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key, report: null, problem: 'The report could not be read — the connection may have dropped.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, verdict.problem]);

  // A typed range that does not make sense is answered here, without a round trip: the same
  // `checkRange` the route validates with, so the two can never disagree.
  const problem = verdict.problem ?? (result?.key === key ? result.problem : null);
  const report = verdict.problem || result?.key !== key ? null : result.report;
  const loading = !verdict.problem && result?.key !== key;

  const pick = (p: RangePreset): void => {
    setPreset(p);
    setRange(resolvePreset(p, new Date()));
  };

  const canSeeMoney = data.grants.includes('rep.sales');

  return (
    <div className="flex flex-col gap-5" data-testid="owner-reports">
      {/* THE ONE RANGE. Above the tabs, deliberately: it is not a property of a panel. */}
      <Card className="flex flex-col gap-3" data-testid="owner-rep-range">
        <SectionLabel className="mb-0">One date range, every panel</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Chip key={p} on={preset === p} onClick={() => pick(p)} data-testid={`owner-rep-preset-${p}`}>
              {PRESET_LABEL[p]}
            </Chip>
          ))}
          <Chip on={preset === 'custom'} onClick={() => setPreset('custom')} data-testid="owner-rep-preset-custom">
            {PRESET_LABEL.custom}
          </Chip>
        </div>

        {preset === 'custom' ? (
          <div className="flex flex-wrap gap-3">
            <Field label="From" htmlFor="owner-rep-from" className="min-w-[9rem] flex-1">
              <Input
                id="owner-rep-from"
                data-testid="owner-rep-from"
                type="date"
                value={range.from}
                onChange={(e) => setRange({ ...range, from: e.target.value })}
              />
            </Field>
            <Field label="To" htmlFor="owner-rep-to" className="min-w-[9rem] flex-1">
              <Input
                id="owner-rep-to"
                data-testid="owner-rep-to"
                type="date"
                value={range.to}
                onChange={(e) => setRange({ ...range, to: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        <p className="m-0 type-caption text-[var(--text-muted)]">
          {rangeLabel(range)}
          {loading ? ' · reading…' : ''}
        </p>
      </Card>

      {problem ? (
        <p
          data-testid="owner-rep-problem"
          className="m-0 rounded-[var(--radius-md)] bg-[var(--error-surface)] px-4 py-3 type-caption leading-relaxed text-[var(--on-error-surface)]"
        >
          {problem}
        </p>
      ) : null}

      <nav className={CHIP_NAV_WRAP} aria-label="Reports">
        {REPORT_TABS.map((t) => (
          <Chip key={t.key} on={tab === t.key} onClick={() => setTab(t.key)} data-testid={`owner-rep-tab-${t.key}`}>
            {t.label}
          </Chip>
        ))}
      </nav>

      {!report ? (
        problem ? null : (
          <FirstRunState
            title={loading ? 'Reading the range' : 'Nothing in this range'}
            note={
              loading
                ? 'The rows are being read for the dates above.'
                : 'No bill was closed and no expense was recorded between these dates. Every panel below is a projection of the same rows, so all four are empty together rather than disagreeing.'
            }
            testId="owner-rep-empty"
          />
        )
      ) : (
        <>
          {tab === 'sales' ? <SalesPanel report={report} canSeeMoney={canSeeMoney} /> : null}
          {tab === 'orders' ? <OrdersPanel report={report} /> : null}
          {tab === 'expenses' ? <ExpensesPanel report={report} /> : null}
          {tab === 'final' ? <FinalPanel report={report} /> : null}
        </>
      )}
    </div>
  );
}

interface GstPanelSide {
  orders: number;
  gross: number;
  net: number;
  tax: number;
  grossLabel: string;
  netLabel: string;
  taxLabel: string;
}

/**
 * GST and non-GST, side by side.
 *
 * WHAT MARKS A BILL AS GST
 *   The tax it actually carried. Nothing in the database says 'this one was billed under
 *   GST', so the honest reading of what was stored is that a bill with tax on it is a GST
 *   bill. The screen says so out loud rather than leaving the owner to assume a flag exists
 *   that does not — a reconciliation done against a number whose rule is unstated is a
 *   reconciliation nobody can check.
 *
 * GROSS, NET AND THE TAX BETWEEN THEM
 *   Gross is what the customer paid less any tip, which was never the restaurant's. Net is
 *   the base before GST. Gross minus net IS the tax, by construction rather than by a third
 *   sum that could drift from the other two.
 */
function GstPanel({ report }: { report: RangeReport }) {
  const { gst, nonGst } = report.summary.gstSplit;
  const sides: Array<[string, GstPanelSide, string]> = [
    ['With GST', gst, 'owner-rep-gst'],
    ['Without GST', nonGst, 'owner-rep-nongst'],
  ];
  return (
    <section data-testid="owner-rep-gst-split">
      <SectionLabel>GST and non-GST</SectionLabel>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {sides.map(([label, side, testId]) => (
          <Card key={label} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="type-body font-semibold">{label}</span>
              <span className="type-caption text-[var(--text-muted)]" data-testid={`${testId}-orders`}>
                {side.orders === 1 ? '1 order' : `${side.orders} orders`}
              </span>
            </div>
            <dl className="m-0 grid grid-cols-3 gap-2">
              <div>
                <dt className="m-0 type-caption text-[var(--text-muted)]">Gross</dt>
                <dd className="m-0 type-body font-semibold tabular-nums" data-testid={`${testId}-gross`}>
                  {side.grossLabel}
                </dd>
              </div>
              <div>
                <dt className="m-0 type-caption text-[var(--text-muted)]">Net</dt>
                <dd className="m-0 type-body font-semibold tabular-nums" data-testid={`${testId}-net`}>
                  {side.netLabel}
                </dd>
              </div>
              <div>
                <dt className="m-0 type-caption text-[var(--text-muted)]">GST</dt>
                <dd className="m-0 type-body font-semibold tabular-nums" data-testid={`${testId}-tax`}>
                  {side.taxLabel}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
      <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
        A bill counts as GST when tax was charged on it. Gross is what the customer paid less any tip; net is the
        base before GST, so the difference between them is the GST column.
      </p>
    </section>
  );
}

/**
 * Where the money came in — cash, card, UPI.
 *
 * A bar per mode rather than a pie: the question being asked is "how much cash should be in
 * the drawer", which is a comparison of lengths, and a pie answers it worst. A bill closed
 * before the mode was captured is its own Unrecorded row for the same reason — folding it into
 * Cash would overstate the only figure this panel exists to reconcile.
 */
function PaymentPanel({ report }: { report: RangeReport }) {
  const modes = report.summary.byPaymentMode;
  if (modes.length === 0) return null;
  return (
    <section data-testid="owner-rep-payments">
      <SectionLabel>How it was paid</SectionLabel>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {modes.map((m) => (
          <li key={m.mode} data-testid={`owner-rep-pay-${m.mode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="type-body font-semibold">{m.mode}</span>
              <span className="type-caption text-[var(--text-muted)]">
                <span className="tabular-nums">{m.amountLabel}</span> · {m.share}% ·{' '}
                {m.bills === 1 ? '1 bill' : `${m.bills} bills`}
              </span>
            </div>
            {/* The bar is the figure beside it drawn to scale, and it is marked decorative:
                a screen reader that read both would say the same number twice. */}
            <div aria-hidden className="mt-1 h-2 w-full rounded-full bg-[var(--surface-sunken)]">
              <div
                className="h-2 rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.max(m.share, m.amount > 0 ? 2 : 0)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Sales and products ────────────────────────────────────────────────── */

function SalesPanel({ report, canSeeMoney }: { report: RangeReport; canSeeMoney: boolean }) {
  const s = report.summary;
  return (
    <div className="flex flex-col gap-5">
      <section>
        <SectionLabel>Over this range</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MetricTile label="Sales" value={s.salesLabel} note="Excludes tips" testId="owner-rep-sales" />
          <MetricTile
            label="Bills closed"
            value={String(s.bills)}
            note={`${s.covers} ${s.covers === 1 ? 'cover' : 'covers'}`}
            testId="owner-rep-bills"
          />
          <MetricTile
            label="Average bill"
            value={s.averageBillLabel}
            note="Rounded — the one figure here that is"
            testId="owner-rep-average"
          />
          <MetricTile
            label="Discounts given"
            value={s.discountsLabel}
            note="Each one names who gave it"
            testId="owner-rep-discounts"
          />
        </div>
        {canSeeMoney ? (
          <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
            Tips over this range came to <strong>{s.tipsLabel}</strong> and are not in the sales figure. The guest owed
            them; the restaurant did not earn them.
          </p>
        ) : null}
      </section>

      <GstPanel report={report} />

      <PaymentPanel report={report} />

      <section>
        <SectionLabel>What sold by category · {report.categories.length} categories</SectionLabel>
        {report.categories.length === 0 ? null : (
          <DataTable
            rows={report.categories}
            rowKey={(c) => c.category}
            defaultSort={{ key: 'revenue', direction: 'desc' }}
            exportName="jalsa-categories"
            emptyTitle="Nothing sold in this range"
            emptyNote="Closed bills fill this in."
            searchPlaceholder="Search a category"
            testId="owner-categories-table"
            columns={[
              {
                key: 'category',
                header: 'Category',
                cell: (c) => <span className="font-semibold">{c.category}</span>,
                value: (c) => c.category,
              },
              { key: 'dishes', header: 'Dishes', cell: (c) => c.dishes, value: (c) => c.dishes, align: 'right' },
              { key: 'qty', header: 'Sold', cell: (c) => c.qty, value: (c) => c.qty, align: 'right' },
              {
                key: 'revenue',
                header: 'Revenue',
                cell: (c) => <span className="tabular-nums">{rupees(c.revenue)}</span>,
                value: (c) => c.revenue,
                align: 'right',
              },
            ]}
          />
        )}
      </section>

      <section>
        <SectionLabel>What sold · {report.products.length} dishes</SectionLabel>
        {report.products.length === 0 ? (
          <FirstRunState
            title="Nothing was closed in this range"
            note="The product report is built from closed bills, so it fills up as evenings are settled rather than as they are ordered."
            testId="owner-products-empty"
          />
        ) : (
          <DataTable
            rows={report.products}
            rowKey={(p) => p.name}
            defaultSort={{ key: 'revenue', direction: 'desc' }}
            exportName="jalsa-products"
            emptyTitle="Nothing sold in this range"
            emptyNote="Closed bills fill this in."
            searchPlaceholder="Search a dish"
            testId="owner-products-table"
            columns={[
              {
                key: 'name',
                header: 'Dish',
                cell: (p) => <span className="font-semibold">{p.name}</span>,
                value: (p) => p.name,
              },
              { key: 'qty', header: 'Sold', cell: (p) => p.qty, value: (p) => p.qty, align: 'right' },
              {
                key: 'revenue',
                header: 'Revenue',
                cell: (p) => rupees(p.revenue),
                value: (p) => p.revenue,
                align: 'right',
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}

/* ── All orders ────────────────────────────────────────────────────────── */

function OrdersPanel({ report }: { report: RangeReport }) {
  return (
    <section>
      <SectionLabel>All orders · {report.orders.length}</SectionLabel>
      <DataTable
        rows={report.orders}
        rowKey={(o) => o.id}
        defaultSort={{ key: 'bill', direction: 'desc' }}
        exportName="jalsa-orders"
        emptyTitle="No bills closed in this range"
        emptyNote="Every bill settled between these dates appears here with how it was ordered and who ran it."
        searchPlaceholder="Search bill, table, captain or how it was placed"
        testId="owner-orders-ledger"
        columns={[
          {
            key: 'bill',
            header: 'Bill',
            cell: (o) => <span className="font-semibold">{o.code}</span>,
            value: (o) => o.code,
          },
          { key: 'table', header: 'Table', cell: (o) => o.tables, value: (o) => o.tables },
          { key: 'closed', header: 'Closed', cell: (o) => o.closedOn, value: (o) => o.closedOn, secondary: true },
          {
            key: 'guests',
            header: 'Guests',
            cell: (o) => o.guests,
            value: (o) => o.guests,
            align: 'right',
            secondary: true,
          },
          {
            key: 'rounds',
            header: 'Rounds',
            cell: (o) => o.rounds,
            value: (o) => o.rounds,
            align: 'right',
            secondary: true,
          },
          { key: 'source', header: 'Placed by', cell: (o) => o.sources, value: (o) => o.sources },
          { key: 'captain', header: 'Captain', cell: (o) => o.captain, value: (o) => o.captain, secondary: true },
          { key: 'total', header: 'Total', cell: (o) => o.payableLabel, value: (o) => o.payable, align: 'right' },
        ]}
      />
      <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
        &ldquo;Placed by&rdquo; is recorded on every round as it is created and cannot be reconstructed afterwards — it
        is what makes &ldquo;is the QR actually being used?&rdquo; answerable at all.
      </p>
    </section>
  );
}

/* ── Purchases and expenses ────────────────────────────────────────────── */

function ExpensesPanel({ report }: { report: RangeReport }) {
  return (
    <section>
      <SectionLabel>Purchases &amp; expenses · {report.summary.purchasesLabel}</SectionLabel>
      <DataTable
        rows={report.expenses}
        rowKey={(e) => e.id}
        defaultSort={{ key: 'date', direction: 'desc' }}
        exportName="jalsa-purchases"
        emptyTitle="Nothing recorded in this range"
        emptyNote="Purchases are typed in under Expenses. This report is only ever as complete as the entries — nothing is inferred from anywhere else."
        searchPlaceholder="Search category, note or person"
        testId="owner-purchases-table"
        columns={[
          { key: 'date', header: 'Date', cell: (e) => e.spentOn, value: (e) => e.spentOn },
          {
            key: 'category',
            header: 'Category',
            cell: (e) => <span className="font-semibold">{e.category}</span>,
            value: (e) => e.category,
          },
          { key: 'note', header: 'Note', cell: (e) => e.note, value: (e) => e.note, secondary: true },
          { key: 'by', header: 'Entered by', cell: (e) => e.enteredBy, value: (e) => e.enteredBy, secondary: true },
          { key: 'amount', header: 'Amount', cell: (e) => rupees(e.amount), value: (e) => e.amount, align: 'right' },
        ]}
      />
      <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
        This is the same ledger the Expenses section writes — one set of entries, read here as a report rather than
        re-keyed. Entering and correcting an expense stays there, with the reason it asks for.
      </p>
    </section>
  );
}

/* ── The final report ──────────────────────────────────────────────────── */

function FinalPanel({ report }: { report: RangeReport }) {
  const s = report.summary;
  return (
    <section className="flex flex-col gap-4" data-testid="owner-final-report">
      <SectionLabel>Final report · {rangeLabel(report.range)}</SectionLabel>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <MetricTile label="Income" value={s.salesLabel} note="Sales, tips excluded" testId="owner-final-income" />
        <MetricTile label="Purchases" value={s.purchasesLabel} note="Everything entered" testId="owner-final-purchases" />
        <MetricTile
          label="Net"
          value={s.netLabel}
          note={s.net < 0 ? 'Spent more than was taken' : 'Income less purchases'}
          tone={s.net < 0 ? 'error' : 'primary'}
          testId="owner-final-net"
        />
      </div>

      <Card className="flex flex-col gap-2">
        <SectionLabel>Where the money went</SectionLabel>
        {s.byCategory.length === 0 ? (
          <p className="m-0 type-caption text-[var(--text-muted)]">No purchases were recorded in this range.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {s.byCategory.map((c) => (
              <li
                key={c.category}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2"
              >
                <span className="type-caption font-semibold">{c.category}</span>
                <span className="type-caption tabular-nums">{c.amountLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <SectionLabel>What is in each figure, and what is not</SectionLabel>
        <dl className="m-0 flex flex-col gap-1">
          {[
            ['Income', `${s.salesLabel} — what the restaurant earned, over ${s.bills} closed ${s.bills === 1 ? 'bill' : 'bills'}`],
            ['Tips', `${s.tipsLabel} — collected on the staff's behalf and owed to them. Never income.`],
            ['GST', `${s.taxLabel} — collected and owed onward. It is inside what the guest paid and outside what the restaurant earned.`],
            ['Discounts', `${s.discountsLabel} — taken off before tax, each one named to whoever gave it.`],
            ['Purchases', `${s.purchasesLabel} — only what somebody typed into the Expenses ledger. Nothing is inferred.`],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-wrap gap-2 border-b border-[var(--border)] py-1.5 last:border-b-0">
              <dt className="min-w-[6rem] type-caption font-semibold">{k}</dt>
              <dd className="m-0 flex-1 type-caption leading-relaxed text-[var(--text-muted)]">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* EXPORTING THE FINAL REPORT IS EXPORTING ITS PANELS. The flowchart says each panel
          exports; this one is a roll-up of the other three, so it sends somebody to the rows
          rather than inventing a fourth export of figures that cannot be checked against them. */}
      <p className="m-0 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-4 py-3 type-caption leading-relaxed text-[var(--text-muted)]">
        Every figure here is a roll-up of the other three panels over the same range. To export it, export those —{' '}
        <strong>All orders</strong> for the income and <strong>Purchases &amp; expenses</strong> for the spend. Each
        exports exactly the rows shown, so the total in a spreadsheet is checkable against the total here.
      </p>
    </section>
  );
}
