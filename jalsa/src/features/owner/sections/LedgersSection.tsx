'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, SectionLabel } from '@/components/ui/atoms';
import { DataTable } from '@/components/ui/data-table';
import { Sheet, ConfirmDialog } from '@/components/ui/sheet';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { rupees } from '@/lib/money';
import type { ExpenseRow } from '@/lib/db/types';
import { MetricTile, type OwnerSectionProps } from '../OwnerConsole';

/**
 * Screens 30 and 31 — the tips ledger and expenses.
 *
 * THEY SHARE A SCREEN BECAUSE THEY SHARE A PROPERTY: neither is revenue.
 *   A tip is money collected on somebody else's behalf and paid out in full (Standard 7.3); an
 *   expense is money that has already left. Putting them beside each other, under a heading that
 *   says so, is what stops either being quietly folded into a sales figure.
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

export function LedgersSection({ data, send, runBusy, busy }: OwnerSectionProps) {
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

  const expenseTotal = data.expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <div className="flex flex-col gap-6" data-testid="owner-ledgers">
      <section>
        <SectionLabel>Tips — staff money, excluded from income</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
            label="Expenses recorded"
            value={rupees(expenseTotal)}
            note={`${data.expenses.length} entries`}
            testId="owner-expense-total"
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
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{s.name}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">
                    {s.count === 1 ? '1 tip' : `${s.count} tips`}
                  </span>
                  <span className="text-[15px] font-bold tabular-nums">{rupees(s.amount)}</span>
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

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SectionLabel className="mb-0">Expenses — entered by hand, never inferred</SectionLabel>
          {canExpense ? (
            <Button
              data-testid="owner-add-expense"
              size="sm"
              onClick={() =>
                setEditing({
                  spentOn: new Date().toISOString().slice(0, 10),
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
          rows={data.expenses}
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
              <Input
                id="owner-exp-cat"
                list="owner-exp-categories"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                data-testid="owner-expense-category"
              />
              {/* A datalist rather than a closed dropdown: the list covers the common case and
                  typing a new category creates it in place, without leaving the task (3.2). */}
              <datalist id="owner-exp-categories">
                {[...new Set([...EXPENSE_CATEGORIES, ...data.expenses.map((e) => e.category)])].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
