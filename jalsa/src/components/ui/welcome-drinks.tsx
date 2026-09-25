'use client';

import * as React from 'react';
import { Button } from './button';
import { Card, Pill } from './atoms';
import { welcomeDrinksAdded, withWelcomeDrinks } from '@/lib/welcome-drinks';

/**
 * The welcome-drinks quick add, for a table's first order (24-Sep list, D1). One component on
 * both ordering surfaces - the captain's phone and the owner's new-round sheet - so the two
 * cannot offer it differently.
 *
 * It says what it will add before the tap, and "Added to this round" after it, so nobody has to
 * wonder whether the drinks went in. Removing one is the ordinary stepper on the menu row.
 */
export function WelcomeDrinksOffer({
  drinks,
  guests,
  cart,
  onCart,
  testIdPrefix,
}: {
  drinks: ReadonlyArray<{ id: string; name: string }>;
  /** How many of each - one per guest where the party size is known. */
  guests: number;
  cart: Record<string, number>;
  onCart: (next: Record<string, number>) => void;
  testIdPrefix: string;
}) {
  if (drinks.length === 0) return null;
  const added = welcomeDrinksAdded(cart, drinks);
  const each = Math.max(1, guests);
  return (
    <Card className="flex flex-wrap items-center gap-3 p-3" data-testid={`${testIdPrefix}-welcome`}>
      <span className="min-w-0 flex-1">
        <span className="block type-body font-semibold">Welcome drinks</span>
        <span className="block type-caption text-[var(--text-muted)]">
          First order on this table · {drinks.map((d) => d.name).join(', ')}
          {each > 1 ? ` · ${each} of each` : ''}
        </span>
      </span>
      {added ? (
        <span data-testid={`${testIdPrefix}-welcome-added`}>
          <Pill tone="success">Added to this round</Pill>
        </span>
      ) : (
        <Button
          data-testid={`${testIdPrefix}-welcome-add`}
          size="sm"
          variant="secondary"
          onClick={() => onCart(withWelcomeDrinks(cart, drinks, each))}
        >
          Add welcome drinks
        </Button>
      )}
    </Card>
  );
}
