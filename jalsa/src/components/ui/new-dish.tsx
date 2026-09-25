'use client';

import * as React from 'react';
import { Button } from './button';
import { Card } from './atoms';
import { Combobox } from './combobox';
import { Field, Input, Select } from './field';
import { FOOD_TYPE, type FoodType } from '@/lib/status';
import { existingDish, newDishProblem, type NewDish } from '@/lib/new-dish';

const FOOD_TYPES: FoodType[] = ['veg', 'non_veg', 'egg'];

/**
 * Add a dish the menu does not list yet, from the ordering screen (24-Sep list, E1). One component
 * on both ordering surfaces - the captain's Add items screen and the owner's New round sheet - so
 * the two cannot ask for it differently.
 *
 * The parent shows it only to someone holding `menu.item_edit` (`canAddDish`), the grant the
 * server demands. When the search names a dish that is not listed, the offer is that dish; the
 * form stays open with the server's sentence on a failure, and nothing is added to the round
 * until the dish exists as a row with an id the server chose.
 */
export function NewDishOffer({
  query,
  menu,
  categories,
  onCreate,
  onAdded,
  disabled,
  testIdPrefix,
}: {
  /** What the search field holds: an unlisted name is offered as the new dish. */
  query: string;
  menu: ReadonlyArray<{ name: string }>;
  categories: ReadonlyArray<{ id: string; name: string }>;
  /** Saves it. Resolves to the dish's id - the existing one when the name was already taken. */
  onCreate: (dish: NewDish) => Promise<{ id: string; existed: boolean }>;
  /** Called once the dish exists: the parent puts it in the round and says so. */
  onAdded: (id: string, dish: NewDish, existed: boolean) => void;
  disabled?: boolean;
  testIdPrefix: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [foodType, setFoodType] = React.useState<FoodType>('veg');
  const [problem, setProblem] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const typed = query.trim();
  const unlisted = typed.length > 0 && existingDish(menu, typed) === null;

  const start = () => {
    setName(unlisted ? typed : '');
    setPrice('');
    setCategoryId('');
    setFoodType('veg');
    setProblem(null);
    setOpen(true);
  };

  const save = async () => {
    const dish: NewDish = { name: name.trim(), price: Number(price), categoryId, foodType };
    const refused = price.trim() === '' ? 'Give the dish a price above ₹0.' : newDishProblem(dish);
    if (refused) {
      setProblem(refused);
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const res = await onCreate(dish);
      setOpen(false);
      onAdded(res.id, dish, res.existed);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That dish was not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button
          data-testid={`${testIdPrefix}-new-dish`}
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={start}
        >
          {unlisted ? `+ Add “${typed}” to the menu` : '+ New dish'}
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-3" data-testid={`${testIdPrefix}-new-dish-form`}>
      <span className="type-body font-semibold">New dish</span>
      <Field label="Dish name" required htmlFor={`${testIdPrefix}-new-dish-name`}>
        <Input
          id={`${testIdPrefix}-new-dish-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid={`${testIdPrefix}-new-dish-name`}
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Field label="Price ₹" required htmlFor={`${testIdPrefix}-new-dish-price`} className="min-w-[7rem] flex-1">
          <Input
            id={`${testIdPrefix}-new-dish-price`}
            type="number"
            inputMode="decimal"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            data-testid={`${testIdPrefix}-new-dish-price`}
          />
        </Field>
        <Field label="Food type" required htmlFor={`${testIdPrefix}-new-dish-type`} className="min-w-[8rem] flex-1">
          <Select
            id={`${testIdPrefix}-new-dish-type`}
            value={foodType}
            onChange={(e) => setFoodType(e.target.value as FoodType)}
            data-testid={`${testIdPrefix}-new-dish-type`}
          >
            {FOOD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FOOD_TYPE[t].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Category" required htmlFor={`${testIdPrefix}-new-dish-cat`} error={problem}>
        <Combobox
          id={`${testIdPrefix}-new-dish-cat`}
          testId={`${testIdPrefix}-new-dish-category`}
          value={categoryId}
          onValueChange={setCategoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Search the categories"
          emptyLabel="No matching categories"
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          data-testid={`${testIdPrefix}-new-dish-cancel`}
          variant="ghost"
          disabled={saving}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button
          data-testid={`${testIdPrefix}-new-dish-save`}
          disabled={saving || disabled}
          onClick={() => void save()}
        >
          {saving ? 'Adding…' : 'Add to menu and round'}
        </Button>
      </div>
    </Card>
  );
}
