'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, FoodMark, Pill, SectionLabel } from '@/components/ui/atoms';
import { DataTable } from '@/components/ui/data-table';
import { Sheet } from '@/components/ui/sheet';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { FOOD_TYPE, type FoodType } from '@/lib/status';
import type { OwnerSectionProps } from '../OwnerConsole';

/**
 * Screens 25 and 26 — the menu, and the item editor.
 *
 * THE AVAILABILITY SWITCH IS THE SAME ONE CAPTAINS SEE, and turning it off pulls the dish from
 * every open guest session on the next poll. The row says so, because a switch whose blast
 * radius is invisible is a switch people are afraid to use — and then they stop using it, and
 * then guests order things that ran out an hour ago.
 *
 * THE LIST IS BUILT FOR MORE THAN TWENTY OF ANYTHING (Standard 3.6): search across every
 * column, sort, a live count, and an export. Fifty-seven items is already past the point where
 * scrolling stops working.
 */

const FOOD_TYPES: FoodType[] = ['veg', 'non_veg', 'egg'];

export function MenuSection({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [editing, setEditing] = React.useState<{
    id?: string;
    name: string;
    price: string;
    categoryId: string;
    foodType: FoodType;
    description: string;
  } | null>(null);

  const canEdit = data.grants.includes('menu.item_edit');
  const canToggle = data.grants.includes('menu.availability');

  const closed = data.menu.filter((m) => !m.available);

  const openNew = () =>
    setEditing({
      name: '',
      price: '',
      categoryId: data.categories[0]?.id ?? '',
      foodType: 'veg',
      description: '',
    });

  return (
    <div className="flex flex-col gap-5" data-testid="owner-menu">
      {closed.length ? (
        <section>
          <SectionLabel>Off the customer menu right now · {closed.length}</SectionLabel>
          <Card className="flex flex-wrap gap-2">
            {closed.map((m) => (
              <span
                key={m.id}
                className="flex items-center gap-2 rounded-full bg-[var(--warning-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--on-warning-surface)]"
              >
                <FoodMark type={m.foodType} size={11} />
                {m.name}
                {canToggle ? (
                  <button
                    data-testid={`owner-reopen-${m.id}`}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runBusy(async () => {
                        await send('/api/owner/action', {
                          action: 'set-availability',
                          itemId: m.id,
                          available: true,
                        });
                        toast.show(`${m.name} back on every customer's phone`, { tone: 'success' });
                      })
                    }

                    className="rounded-full bg-[var(--on-warning-surface)]/10 px-2 py-0.5 text-[11px] underline underline-offset-2"
                  >
                    Put back
                  </button>
                ) : null}
              </span>
            ))}
          </Card>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <SectionLabel className="mb-0">
            {data.menu.length} items across {data.categories.length} categories
          </SectionLabel>
          {canEdit ? (
            <Button data-testid="owner-add-item" size="sm" onClick={openNew}>
              Add item
            </Button>
          ) : null}
        </div>

        <DataTable
          rows={data.menu}
          rowKey={(m) => m.id}
          defaultSort={{ key: 'category', direction: 'asc' }}
          exportName="jalsa-menu"
          emptyTitle="The menu is empty"
          emptyNote="Add the first dish and it appears on every guest's phone the moment you save it."
          searchPlaceholder="Search name, category or food type"
          testId="owner-menu-table"
          columns={[
            {
              key: 'name',
              header: 'Item',
              cell: (m) => (
                <span className="flex items-center gap-2">
                  <FoodMark type={m.foodType} />
                  <span className="font-semibold">{m.name}</span>
                </span>
              ),
              value: (m) => m.name,
              // Contains, not equals. Nobody types "Chilli Paneer" in full to find Chilli Paneer.
              filter: { kind: 'text', placeholder: 'Item name contains…' },
            },
            {
              key: 'category',
              header: 'Category',
              cell: (m) => m.category,
              value: (m) => m.category,
              // Built from the rows on screen, so a category with nothing in it never offers a
              // filter that returns an empty table.
              filter: { kind: 'options' },
            },
            {
              key: 'type',
              header: 'Type',
              cell: (m) => FOOD_TYPE[m.foodType].label,
              value: (m) => FOOD_TYPE[m.foodType].label,
              secondary: true,
              // Veg · Non-veg · Egg, in the menu's own order rather than alphabetically — it is
              // the order every other screen in this application lists them in.
              filter: { kind: 'options', order: FOOD_TYPES.map((t) => FOOD_TYPE[t].label) },
            },
            {
              key: 'price',
              header: 'Price',
              cell: (m) => <span className="font-semibold">{m.priceLabel}</span>,
              value: (m) => m.price,
              align: 'right',
              /* RANGE ONLY. Low → High and High → Low are sorting, and sorting stays on the
                 header where it already was — the requester's own brief put all three in this
                 dropdown and then chose to keep them apart when asked. */
              filter: { kind: 'range' },
            },
            {
              key: 'available',
              header: 'Available',
              cell: (m) =>
                canToggle ? (
                  <button
                    data-testid={`owner-avail-${m.id}`}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      runBusy(async () => {
                        await send('/api/owner/action', {
                          action: 'set-availability',
                          itemId: m.id,
                          available: !m.available,
                        });
                        toast.show(
                          m.available
                            ? `${m.name} off every customer's phone within seconds`
                            : `${m.name} back on the menu`,
                          { tone: 'success' }
                        );
                      })
                    }
                  >
                    <Pill tone={m.available ? 'success' : 'warning'}>{m.available ? 'On' : 'Off'}</Pill>
                  </button>
                ) : (
                  <Pill tone={m.available ? 'success' : 'warning'}>{m.available ? 'On' : 'Off'}</Pill>
                ),
              value: (m) => (m.available ? 'On' : 'Off'),
              // "On" and "Off" are the words already on the pills in this column. A dropdown
              // offering "Available / Unavailable" beside a row reading "On" is two vocabularies
              // for one fact (the freeze rule).
              filter: { kind: 'options', order: ['On', 'Off'] },
            },
            {
              key: 'edit',
              header: '',
              cell: (m) =>
                canEdit ? (
                  <Button
                    data-testid={`owner-edit-${m.id}`}
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditing({
                        id: m.id,
                        name: m.name,
                        price: String(m.price),
                        categoryId: m.categoryId,
                        foodType: m.foodType,
                        description: m.description,
                      })
                    }
                  >
                    Edit
                  </Button>
                ) : null,
            },
          ]}
        />

        <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
          The switch above is the same one captains see. Turning it off pulls the dish from every open guest session
          within seconds — nothing else on any screen changes.
        </p>
      </section>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        posture="modal"
        title={editing?.id ? 'Edit item' : 'Add an item'}
        description="Everything here shows on the guest's menu the moment you save."
        testId="owner-item-sheet"
        footer={
          <>
            <Button data-testid="owner-item-cancel" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-item-save"
              disabled={busy || !editing?.name.trim() || !editing?.categoryId}
              onClick={() =>
                editing &&
                runBusy(async () => {
                  await send('/api/owner/action', {
                    action: 'upsert-item',
                    ...(editing.id ? { id: editing.id } : {}),
                    name: editing.name.trim(),
                    price: Number(editing.price) || 0,
                    categoryId: editing.categoryId,
                    foodType: editing.foodType,
                    description: editing.description,
                  });
                  toast.show(
                    editing.id
                      ? `${editing.name} saved — every open menu updates within seconds`
                      : `${editing.name} added to the menu at ₹${Number(editing.price) || 0}`,
                    { tone: 'success' }
                  );
                  setEditing(null);
                })
              }
            >
              Save item
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-3">
            <Field label="Item name" required htmlFor="owner-item-name">
              <Input
                id="owner-item-name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                data-testid="owner-item-name"
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <Field label="Price ₹" required htmlFor="owner-item-price" className="min-w-[8rem] flex-1">
                <Input
                  id="owner-item-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  data-testid="owner-item-price"
                />
              </Field>
              <Field label="Category" required htmlFor="owner-item-cat" className="min-w-[10rem] flex-1">
                <Select
                  id="owner-item-cat"
                  value={editing.categoryId}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                  data-testid="owner-item-category"
                >
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Food type" required htmlFor="owner-item-type" className="min-w-[9rem] flex-1">
                <Select
                  id="owner-item-type"
                  value={editing.foodType}
                  onChange={(e) => setEditing({ ...editing, foodType: e.target.value as FoodType })}
                  data-testid="owner-item-type"
                >
                  {FOOD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FOOD_TYPE[t].label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Description"
              htmlFor="owner-item-desc"
              hint="One line, in the words a guest would use. It shows on the dish sheet."
            >
              <Textarea
                id="owner-item-desc"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                data-testid="owner-item-description"
              />
            </Field>

            {editing.id ? (
              <p className="m-0 rounded-[var(--radius-md)] bg-[var(--warning-surface)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--on-warning-surface)]">
                Changing a price is recorded separately in the audit log, with the old figure and the new one. Bills
                already open keep the price they were quoted.
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

/** A small re-export so the settings screen can reuse the same switch styling. */
export { Toggle };
