import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The one class-name combiner. shadcn/ui components are generated against this helper, so it
 * lives at the alias `@/lib/cn` declared in components.json — anything added with
 * `npx shadcn@latest add …` wires itself up without an edit.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
