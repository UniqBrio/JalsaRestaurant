import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/cn';

/**
 * Edit and Delete, as an icon only (13-Oct-2026) - the one way every screen shows them.
 *
 * THE WORD MOVES, IT DOES NOT GO
 *   The owner asked for the icon alone. The word is still the button's accessible name (`label`,
 *   which names the thing - "Delete Paneer Tikka"), so a screen reader reads it and a runner finds
 *   it by role, and it is the tooltip a mouse pointer gets. A bare pencil with no name is a button
 *   nobody can address.
 *
 * WHAT STAYS A WORD
 *   Only the button that OPENS an edit or a delete is an icon. The confirmation that carries out a
 *   delete keeps its words ("Delete the item") - a destructive commitment names what it does.
 *
 * Lucide at stroke 2.75, as the design system sets it. The 44px floor is Button's `icon` size.
 */
export type IconActionKind = 'edit' | 'delete';

export interface IconActionProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  kind: IconActionKind;
  /** What the button does to what, in words: "Edit Paneer Tikka". */
  label: string;
  'data-testid': string;
}

const ICON = { edit: Pencil, delete: Trash2 } as const;

export const IconAction = React.forwardRef<HTMLButtonElement, IconActionProps>(function IconAction(
  { kind, label, className, title, 'data-testid': testId, ...props },
  ref
) {
  const Icon = ICON[kind];
  return (
    <Button
      ref={ref}
      data-testid={testId}
      variant="ghost"
      size="icon"
      aria-label={label}
      title={title ?? label}
      className={cn(kind === 'delete' && 'text-[var(--error)] hover:text-[var(--error)]', className)}
      {...props}
    >
      <Icon aria-hidden="true" focusable="false" size={18} strokeWidth={2.75} />
    </Button>
  );
});
