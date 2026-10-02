'use client';

import * as React from 'react';
import { Chip } from '@/components/ui/atoms';
import { PRINTER_ROLES, ROLE_LABEL, type PrinterRole } from '@/lib/printer-roles';

/**
 * "Use for" - what a printer prints: kitchen tickets, bills, or both (02-Oct-2026).
 *
 * Two toggles rather than a select, because both may be on: a restaurant with one printer turns
 * both on. At least one stays on - a printer used for nothing is not a printer - so tapping the
 * last one does nothing rather than leaving a form that cannot be saved without saying why.
 * The same chips the console already uses for paper width (`aria-pressed`).
 */
export function PrinterRolesField({
  roles,
  onChange,
  testIdPrefix,
}: {
  roles: readonly string[];
  onChange: (roles: PrinterRole[]) => void;
  testIdPrefix: string;
}) {
  const toggle = (r: PrinterRole): void => {
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    const ordered = PRINTER_ROLES.filter((k) => next.includes(k));
    if (ordered.length > 0) onChange(ordered);
  };
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Use this printer for">
      <span className="type-caption font-semibold">Use for</span>
      <div className="flex flex-wrap gap-2">
        {PRINTER_ROLES.map((r) => (
          <Chip key={r} on={roles.includes(r)} onClick={() => toggle(r)} data-testid={`${testIdPrefix}-role-${r.toLowerCase()}`}>
            {roles.includes(r) ? '✓ ' : ''}
            {ROLE_LABEL[r]}
          </Chip>
        ))}
      </div>
      <span className="type-caption text-[var(--text-muted)]">One printer for everything? Turn both on.</span>
    </div>
  );
}

/**
 * "Default printer for" - only the kinds this printer prints. Choosing it here moves the default
 * from whichever printer had it; the server does the moving (`releaseDefaults`).
 */
export function DefaultRolesField({
  roles,
  defaultFor,
  onChange,
  testIdPrefix,
}: {
  roles: readonly string[];
  defaultFor: readonly string[];
  onChange: (defaultFor: PrinterRole[]) => void;
  testIdPrefix: string;
}) {
  const offered = PRINTER_ROLES.filter((r) => roles.includes(r));
  const toggle = (r: PrinterRole): void => {
    const next = defaultFor.includes(r) ? defaultFor.filter((x) => x !== r) : [...defaultFor, r];
    onChange(PRINTER_ROLES.filter((k) => next.includes(k) && roles.includes(k)));
  };
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Default printer for">
      <span className="type-caption font-semibold">Default printer for</span>
      <div className="flex flex-wrap gap-2">
        {offered.map((r) => (
          <Chip key={r} on={defaultFor.includes(r)} onClick={() => toggle(r)} data-testid={`${testIdPrefix}-default-${r.toLowerCase()}`}>
            {defaultFor.includes(r) ? '✓ ' : ''}
            {ROLE_LABEL[r]}
          </Chip>
        ))}
      </div>
      <span className="type-caption text-[var(--text-muted)]">
        Tickets nobody else is set up for go to the default. Leave both off and Jalsa picks one for you.
      </span>
    </div>
  );
}
