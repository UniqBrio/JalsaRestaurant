'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, Chip, SectionLabel } from '@/components/ui/atoms';
import { DataTable } from '@/components/ui/data-table';
import { Sheet, ConfirmDialog } from '@/components/ui/sheet';
import { Combobox } from '@/components/ui/combobox';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import type { ExpenseRow } from '@/lib/db/types';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';
import { nowForRangeCheck, todayIn } from '@/lib/restaurant-time';
import {
  PRESET_LABEL,
  expensesInRange,
  rangeLabel,
  readReportAnswer,
  resolvePreset,
  type RangePreset,
} from '@/lib/report-range';

const FINANCE_PRESETS: RangePreset[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth'];

/** The slice of the report this screen reads: income, the same range's expenses, and the net. */
interface FinanceFigures {
  summary: {
    bills: number;
    sales: number;
    salesLabel: string;
    purchases: number;
    purchasesLabel: string;
    net: number;
    netLabel: string;
    tipsLabel: string;
  };
}

/**
 * Screens 30 and 31 — the tips ledger and expenses, as TWO sections.
 *
 * WHY THEY ARE NOT ONE SCREEN
 *   They were, and the argument for merging them was that neither is revenue. That is true and
 *   it is not enough. The design set's nav lists `tips` and `exp` separately, and the reason
 *   shows up in the permission matrix rather than in the visual: `tips.all` is confidential —
 *   what each member of the floor earned — while `expense.manage` is an approval grant for
 *   entering purchases. Merged, a manager who must enter the vegetable bill had to be handed
 *   everyone's tip income to do it, or be locked out of both.
 *
 *   What was right about the merge survives in the wording: each screen still says what it is
 *   NOT, because the whole risk with both ledgers is one of them being quietly folded into a
 *   sales figure (Standard 7.3).
 *
 * EVERY EXPENSE IS EDITABLE AND REMOVABLE, WITH A REASON (Standards 3.7 and 6.1). Create-only
 * records make the first typo permanent, and permanent typos flow into every report built on
 * them — so the reason is captured at the moment of the change, not asked for afterwards.
 */

const EXPENSE_CATEGORIES = [
  'Vegetables',
  'Chicken & mutton',
  'Groceries',
  'Gas cylinder',
  'Electricity',
  'Rent',
  'Staff advance',
  'Repairs',
  'Other',
];

/* ── Tips ──────────────────────────────────────────────────────────────── */

export function TipsSection({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const canSettle = data.grants.includes('tips.settle');

  const unsettled = data.tips.filter((t) => !t.settledAt);
  const byStaff = new Map<string, { id: string | null; name: string; amount: number; count: number }>();
  for (const t of unsettled) {
    const key = t.staffId ?? 'unattributed';
    const seen = byStaff.get(key) ?? { id: t.staffId, name: t.staffName, amount: 0, count: 0 };
    seen.amount += t.amount;
    seen.count += 1;
    byStaff.set(key, seen);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="owner-tips">
      <section>
        <SectionLabel>Tips — staff money, excluded from income</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MetricTile
            label="Collected today"
            value={data.today.tipsLabel}
            note="Never part of sales"
            testId="owner-tips-today"
          />
          <MetricTile
            label="Waiting to settle"
            value={rupees(unsettled.reduce((a, t) => a + t.amount, 0))}
            note={`${unsettled.length === 1 ? '1 tip' : `${unsettled.length} tips`} across ${byStaff.size} people`}
            testId="owner-tips-unsettled"
          />
          <MetricTile
            label="Sales today"
            value={data.today.salesLabel}
            note="Tips are not in this figure"
            testId="owner-sales-echo"
          />
        </div>

        {byStaff.size ? (
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {[...byStaff.values()].map((s) => (
              <li key={s.id ?? 'unattributed'}>
                <Card className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 type-body font-semibold">{s.name}</span>
                  <span className="type-caption text-[var(--text-muted)]">
                    {s.count === 1 ? '1 tip' : `${s.count} tips`}
                  </span>
                  <span className="type-body font-bold tabular-nums">{rupees(s.amount)}</span>
                  {canSettle && s.id ? (
                    <Button
                      data-testid={`owner-settle-${s.id}`}
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        runBusy(async () => {
                          const res = await send<{ settled: number }>('/api/owner/action', {
                            action: 'settle-tips',
                            staffId: s.id,
                          });
                          toast.show(`${rupees(res.settled)} settled to ${s.name} — recorded against your name`, {
                            tone: 'success',
                          });
                        })
                      }
                    >
                      Record settlement
                    </Button>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3">
          <DataTable
            rows={data.tips}
            rowKey={(t) => t.id}
            defaultSort={{ key: 'when', direction: 'desc' }}
            exportName="jalsa-tips"
            emptyTitle="No tips yet"
            emptyNote="A tip appears here the moment a guest chooses one, attributed to the captain on their bill."
            searchPlaceholder="Search bill, table or person"
            testId="owner-tips-table"
            columns={[
              { key: 'bill', header: 'Bill', cell: (t) => t.billCode, value: (t) => t.billCode },
              { key: 'table', header: 'Table', cell: (t) => t.tableName, value: (t) => t.tableName, secondary: true },
              { key: 'staff', header: 'Attributed to', cell: (t) => t.staffName, value: (t) => t.staffName },
              {
                key: 'when',
                header: 'Time',
                cell: (t) =>
                  new Date(t.createdAt).toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  }),
                value: (t) => t.createdAt,
                secondary: true,
              },
              { key: 'amount', header: 'Tip', cell: (t) => rupees(t.amount), value: (t) => t.amount, align: 'right' },
              {
                key: 'state',
                header: 'Settlement',
                cell: (t) => (t.settledAt ? 'Settled' : 'Waiting'),
                value: (t) => (t.settledAt ? 'settled' : 'waiting'),
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}

/* ── Expenses ──────────────────────────────────────────────────────────── */

export function ExpensesSection({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [editing, setEditing] = React.useState<{
    id?: string;
    spentOn: string;
    category: string;
    note: string;
    amount: string;
    reason: string;
  } | null>(null);
  const [deleting, setDeleting] = React.useState<ExpenseRow | null>(null);
  const [deleteReason, setDeleteReason] = React.useState('Entered twice');

  const canExpense = data.grants.includes('expense.manage');
  /* INCOME AND EXPENSES, ONE RANGE (24-Sep list, H1).
     Income is the closed bills' revenue (tips excluded - they are the staff's), read from the
     same report the Reports section reads. It is never typed in here, so a bill can never be
     counted twice as "income". Expenses are the ledger below, filtered to the same days by the
     same predicate the report uses. Net is the report's own figure. */
  const canSeeIncome = data.grants.includes('rep.sales');
  const [preset, setPreset] = React.useState<RangePreset>('thisMonth');
  const range = resolvePreset(preset, nowForRangeCheck());
  const key = `${range.from}|${range.to}`;
  const [income, setIncome] = React.useState<{
    key: string;
    figures: FinanceFigures | null;
    problem: string | null;
  } | null>(null);
  React.useEffect(() => {
    if (!canSeeIncome) return;
    let cancelled = false;
    const [from, to] = key.split('|');
    fetch(`/api/owner/report?from=${from}&to=${to}`)
      .then(async (res) => {
        const read = readReportAnswer<FinanceFigures>(res.ok, await res.json());
        if (!cancelled) setIncome({ key, figures: read.report, problem: read.problem });
      })
      .catch(() => {
        if (!cancelled)
          setIncome({ key, figures: null, problem: 'Income could not be read — the connection may have dropped.' });
      });
    return () => {
      cancelled = true;
    };
  }, [key, canSeeIncome]);
  const figures = income?.key === key ? income.figures : null;
  const incomeProblem = income?.key === key ? income.problem : null;

  const inRange = expensesInRange(data.expenses, range);
  /* Net from the SAME two figures on screen: the report's income and the live expense total.
     The report's own net was fetched once per range and went stale the moment an expense was
     added or deleted here, leaving Net ≠ Income − Expenses on one screen. */
  const netLabel = figures ? rupees(figures.summary.sales - inRange.total) : '…';
  /* Every entry, for correcting: the range governs the totals, but an expense outside it - older
     than 30 days, or a typo dated next year - must still be findable to edit or delete. */
  const [allEntries, setAllEntries] = React.useState(false);
  const ledgerRows = allEntries ? data.expenses : inRange.rows;
  const expenseTotal = inRange.total;

  return (
    <div className="flex flex-col gap-4" data-testid="owner-expenses">
      <Card className="flex flex-col gap-3" data-testid="owner-finance-range">
        <div className="flex flex-wrap gap-2">
          {FINANCE_PRESETS.map((p) => (
            <Chip key={p} on={preset === p} onClick={() => setPreset(p)} data-testid={`owner-finance-preset-${p}`}>
              {PRESET_LABEL[p]}
            </Chip>
          ))}
        </div>
        <p className="m-0 type-caption text-[var(--text-muted)]">{rangeLabel(range)}</p>
      </Card>

      <section data-testid="owner-finance-summary">
        <SectionLabel>Income and expenses</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {canSeeIncome ? (
            <MetricTile
              label="Income"
              value={figures ? figures.summary.salesLabel : '…'}
              note={
                figures
                  ? `${figures.summary.bills} closed ${figures.summary.bills === 1 ? 'bill' : 'bills'} · excludes ${figures.summary.tipsLabel} of tips`
                  : 'From closed bills'
              }
              testId="owner-finance-income"
            />
          ) : null}
          <MetricTile
            label="Expenses"
            value={rupees(expenseTotal)}
            note={`${inRange.rows.length} ${inRange.rows.length === 1 ? 'entry' : 'entries'}`}
            testId="owner-expense-total"
          />
          {canSeeIncome ? (
            <MetricTile label="Net" value={netLabel} note="Income minus expenses" testId="owner-finance-net" />
          ) : null}
        </div>
        {incomeProblem ? (
          <p className="m-0 mt-2 type-caption text-[var(--error)]" data-testid="owner-finance-problem">
            {incomeProblem}
          </p>
        ) : null}
        {!canSeeIncome ? (
          <p className="m-0 mt-2 type-caption text-[var(--text-muted)]" data-testid="owner-finance-no-income">
            Income comes from the sales reports, which are not part of your role - the expenses below are.
          </p>
        ) : (
          <p className="m-0 mt-2 type-caption leading-relaxed text-[var(--text-muted)]">
            Income is read from the bills closed in this range and is never typed in, so nothing is counted twice.
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SectionLabel className="mb-0">Expenses — entered by hand, never inferred</SectionLabel>
          <Chip on={allEntries} onClick={() => setAllEntries((v) => !v)} data-testid="owner-expenses-all">
            {allEntries ? 'Showing every entry' : 'Show every entry'}
          </Chip>
          {canExpense ? (
            <Button
              data-testid="owner-add-expense"
              size="sm"
              onClick={() =>
                setEditing({
                  spentOn: todayIn(),
                  category: EXPENSE_CATEGORIES[0] ?? 'Other',
                  note: '',
                  amount: '',
                  reason: '',
                })
              }
            >
              Add an expense
            </Button>
          ) : null}
        </div>

        <DataTable
          rows={ledgerRows}
          rowKey={(e) => e.id}
          defaultSort={{ key: 'date', direction: 'desc' }}
          exportName="jalsa-expenses"
          emptyTitle="Nothing recorded yet"
          emptyNote="Purchases are typed in here. This report is only ever as complete as the day's entries — nothing is inferred from anywhere else."
          searchPlaceholder="Search category, note or person"
          testId="owner-expenses-table"
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
            {
              key: 'amount',
              header: 'Amount',
              cell: (e) => rupees(e.amount),
              value: (e) => e.amount,
              align: 'right',
            },
            {
              key: 'actions',
              header: '',
              cell: (e) =>
                canExpense ? (
                  <span className="flex gap-1">
                    <Button
                      data-testid={`owner-edit-expense-${e.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing({
                          id: e.id,
                          spentOn: e.spentOn,
                          category: e.category,
                          note: e.note,
                          amount: String(e.amount),
                          reason: '',
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      data-testid={`owner-delete-expense-${e.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleting(e)}
                    >
                      Delete
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
      </section>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        posture="modal"
        title={editing?.id ? 'Edit this expense' : 'Add an expense'}
        description="This figure feeds the purchases report and the net for the range."
        testId="owner-expense-sheet"
        footer={
          <>
            <Button data-testid="owner-expense-cancel" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-expense-save"
              disabled={busy || !editing?.amount || !editing.category}
              onClick={() =>
                editing &&
                runBusy(async () => {
                  await send('/api/owner/action', {
                    action: 'upsert-expense',
                    ...(editing.id ? { id: editing.id } : {}),
                    spentOn: editing.spentOn,
                    category: editing.category,
                    note: editing.note,
                    amount: Number(editing.amount) || 0,
                    ...(editing.reason ? { reason: editing.reason } : {}),
                  });
                  toast.show(
                    `${editing.category} ${rupees(Number(editing.amount) || 0)} ${editing.id ? 'updated' : 'recorded'}`,
                    { tone: 'success' }
                  );
                  setEditing(null);
                })
              }
            >
              Save expense
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Field label="Date" required htmlFor="owner-exp-date" className="min-w-[10rem] flex-1">
                {/* A native date picker: an invalid date cannot be typed (Standard 3.3). */}
                <Input
                  id="owner-exp-date"
                  type="date"
                  value={editing.spentOn}
                  onChange={(e) => setEditing({ ...editing, spentOn: e.target.value })}
                  data-testid="owner-expense-date"
                />
              </Field>
              <Field label="Amount ₹" required htmlFor="owner-exp-amount" className="min-w-[9rem] flex-1">
                <Input
                  id="owner-exp-amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={editing.amount}
                  onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                  data-testid="owner-expense-amount"
                />
              </Field>
            </div>

            <Field label="Category" required htmlFor="owner-exp-cat">
              {/*
                SEARCH + CREATE, and the CONTRACT IS UNCHANGED: an expense category is a string
                on `expense.category`, not a foreign key. There is no category table here and
                this change did not add one.

                So `onCreate` returning the name is not a local pretence — it IS the whole write
                path for this field, exactly as the datalist it replaced was. The value persists
                when the expense is saved, and until then nothing claims otherwise.

                What went is the native datalist element: drawn by the browser, styled by the
                browser, different on every engine, and with no `Add "…"` row to tell anyone
                that typing a new category was allowed at all.
              */}
              <Combobox
                id="owner-exp-cat"
                testId="owner-expense-category"
                value={editing.category}
                onValueChange={(category) => setEditing({ ...editing, category })}
                options={[...new Set([...EXPENSE_CATEGORIES, ...data.expenses.map((e) => e.category)])]
                  .filter(Boolean)
                  .map((c) => ({ value: c, label: c }))}
                placeholder="Search or add a category"
                emptyLabel="No matching categories"
                allowCreate
                onCreate={async (name) => name}
              />
            </Field>

            <Field label="Note" htmlFor="owner-exp-note">
              <Input
                id="owner-exp-note"
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                data-testid="owner-expense-note"
              />
            </Field>

            {editing.id ? (
              <Field
                label="Why the change"
                required
                htmlFor="owner-exp-reason"
                hint="Recorded against your name with the old figure and the new one."
              >
                <Input
                  id="owner-exp-reason"
                  value={editing.reason}
                  onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                  data-testid="owner-expense-reason"
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this expense"
        confirmLabel="Remove it"
        reasons={['Entered twice', 'Wrong amount', 'Wrong category', 'Not ours']}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        busy={busy}
        testId="owner-expense-delete"
        consequence={
          deleting ? (
            <p className="m-0 leading-relaxed">
              <strong>
                {deleting.category} {rupees(deleting.amount)}
              </strong>{' '}
              from {deleting.spentOn} comes out of the purchases report and the net for every range that included it.
              The entry is kept, marked removed, with your name and this reason.
            </p>
          ) : null
        }
        onConfirm={() =>
          deleting &&
          runBusy(async () => {
            await send('/api/owner/action', { action: 'delete-expense', id: deleting.id, reason: deleteReason });
            toast.show(`${deleting.category} ${rupees(deleting.amount)} removed — ${deleteReason.toLowerCase()}`, {
              tone: 'success',
            });
            setDeleting(null);
          })
        }
      />
    </div>
  );
}
