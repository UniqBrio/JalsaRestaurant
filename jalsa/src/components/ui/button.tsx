import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Button — the pill from the design set, at every size a surface needs.
 *
 * THE 44px FLOOR IS NOT A STYLE CHOICE
 *   `min-h-11` is 44px, the minimum touch target the design set fixes and the layout token
 *   carries. Captains tap these standing up, moving, one-handed, holding plates. A 32px button
 *   is a mis-tap that cancels the wrong line.
 *
 * EVERY STATE IS THEMED HERE, ONCE (Standard 10.6)
 *   Hover, pressed, focus-visible and disabled are defined on the variants below, so no screen
 *   restyles them and no screen forgets them. The focus ring is the accent ring the token sheet
 *   defines — never the browser's blue, which fails keyboard users quietly on a maroon header.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ' +
    'transition-colors cursor-pointer select-none ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ' +
    'disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)]',
        secondary:
          'bg-[var(--surface)] text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary-surface)] active:border-[var(--primary)]',
        ghost:
          'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-body)]',
        danger: 'bg-[var(--error)] text-[var(--on-error)] hover:opacity-90 active:opacity-100',
        quiet: 'bg-[var(--surface-sunken)] text-[var(--text-body)] hover:bg-[var(--border)]',
      },
      size: {
        /** The full-width commitment: Send to the kitchen, Request payment, Record payment. */
        lg: 'min-h-12 px-6 text-[15px] w-full',
        md: 'min-h-11 px-5 text-[13.5px]',
        sm: 'min-h-11 px-4 text-[12.5px]',
        icon: 'min-h-11 min-w-11 p-0 text-[15px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Required. Every interactive element is addressable by an automated runner, and a name
   * chosen at the moment the element is written is the only one that ever gets chosen.
   */
  'data-testid': string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      // A button inside a form defaults to submit, which is how a Cancel button ends up
      // saving the form. Stating it is cheaper than remembering it.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
