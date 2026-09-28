'use client';

import * as React from 'react';
import { Button } from './button';
import { Combobox } from './combobox';
import { KOT_CLASSES, KOT_CLASS_LABEL, type FoodType } from '@/lib/status';

/**
 * The ONE Food Type picker (28-Sep-2026): the Menu's Add item form and the ordering screens'
 * quick "new dish" both use it, so the two cannot ask for a type differently.
 *
 * TWO FIELDS, KEPT APART ON PURPOSE
 *   "Food Type" is the restaurant's own list - Veg, Fish, Dessert, Juice - and is what a person
 *   picks and reads. "KOT Classification" is how the kitchen treats that type: which side of the
 *   veg/non-veg split it prints on and the band it sits under. Fish is a Food Type classified
 *   Non-veg; Dessert is a Food Type with no KOT classification (Other). Adding a name here asks
 *   for its classification before anything is saved, so no type ever exists without one.
 *
 * Search and Add behave like Category: typing an existing name selects it (no Add row), and a new
 * one is selected only after the server has created it and handed back its id.
 */
export interface FoodTypeOption {
  id: string;
  name: string;
  kotClass: FoodType;
}

export function FoodTypePicker({
  id,
  testId,
  value,
  onValueChange,
  foodTypes,
  onAdd,
  disabled,
}: {
  id: string;
  testId: string;
  /** The chosen Food Type's id. */
  value: string;
  onValueChange: (id: string) => void;
  foodTypes: readonly FoodTypeOption[];
  /** Creates a Food Type and resolves to its id. Absent: this person may not add types. */
  onAdd?: (name: string, kotClass: FoodType) => Promise<string>;
  disabled?: boolean;
}) {
  // The name typed into Add, waiting for its classification. The combobox's own create is held
  // open on this promise, so it selects the new type only once it exists.
  const [pending, setPending] = React.useState<{
    name: string;
    resolve: (id: string) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const [adding, setAdding] = React.useState<FoodType | null>(null);

  const classify = async (kotClass: FoodType) => {
    if (!pending || !onAdd || adding) return;
    setAdding(kotClass);
    try {
      pending.resolve(await onAdd(pending.name, kotClass));
    } catch (err: unknown) {
      pending.reject(err instanceof Error ? err : new Error('That food type could not be added.'));
    } finally {
      setAdding(null);
      setPending(null);
    }
  };

  const cancel = () => {
    pending?.reject(new Error('Not added. Type the name again to add it.'));
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <Combobox
        id={id}
        testId={testId}
        value={value}
        onValueChange={(v) => v && onValueChange(v)}
        options={foodTypes.map((t) => ({ value: t.id, label: t.name, hint: `KOT: ${KOT_CLASS_LABEL[t.kotClass]}` }))}
        placeholder="Search or add a food type"
        emptyLabel="No matching food types"
        allowCreate={onAdd !== undefined}
        {...(onAdd
          ? {
              onCreate: (name: string) =>
                new Promise<string>((resolve, reject) => setPending({ name: name.trim(), resolve, reject })),
            }
          : {})}
        disabled={disabled === true}
      />

      {pending ? (
        <div
          role="group"
          aria-label={`KOT classification for ${pending.name}`}
          data-testid={`${testId}-classify`}
          className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3"
        >
          <p className="m-0 type-caption leading-relaxed">
            New food type <strong>{pending.name}</strong>. Choose its <strong>KOT classification</strong> - how the
            kitchen ticket treats it.
          </p>
          <div className="flex flex-wrap gap-2">
            {KOT_CLASSES.map((c) => (
              <Button
                key={c}
                type="button"
                size="sm"
                variant="secondary"
                disabled={adding !== null}
                data-testid={`${testId}-classify-${c}`}
                onClick={() => void classify(c)}
              >
                {KOT_CLASS_LABEL[c]}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={cancel}
              data-testid={`${testId}-classify-cancel`}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
