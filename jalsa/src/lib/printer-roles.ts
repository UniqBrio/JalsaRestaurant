/**
 * What a printer is used for (02-Oct-2026).
 *
 * A machine prints kitchen tickets, bills, or both. Until this date it printed exactly one, and a
 * restaurant with a single physical printer could not print its bills - see
 * `supabase/migrations/20261002090000_jalsa_printer_roles.sql`. The kinds are the same strings
 * `print_job.kind` and routing already use: 'KOT' and 'Invoice'.
 *
 * Pure, so the settings form, the API and the server mutation all validate with one function.
 */

export const PRINTER_ROLES = ['KOT', 'Invoice'] as const;
export type PrinterRole = (typeof PRINTER_ROLES)[number];

/** The words the owner reads. The same words the settings form has always used. */
export const ROLE_LABEL: Record<PrinterRole, string> = {
  KOT: 'Kitchen tickets',
  Invoice: 'Bills',
};

const isRole = (r: unknown): r is PrinterRole => (PRINTER_ROLES as readonly unknown[]).includes(r);

/** "Kitchen tickets", "Bills", or "Kitchen tickets and bills". */
export function rolesLabel(roles: readonly string[]): string {
  const known = PRINTER_ROLES.filter((r) => roles.includes(r));
  if (known.length === 2) return 'Kitchen tickets and bills';
  return known[0] ? ROLE_LABEL[known[0]] : ROLE_LABEL.KOT;
}

/**
 * The roles and defaults as they will be stored: known kinds only, in one order, no repeats, and
 * a default only for a kind the machine actually prints. `problem` is one sentence for the owner
 * when there is nothing left to store - a printer used for nothing is not a printer.
 */
export function normalizeRoles(input: { roles: readonly unknown[]; defaultFor?: readonly unknown[] | undefined }): {
  roles: PrinterRole[];
  defaultFor: PrinterRole[] | undefined;
  problem: string | null;
} {
  const roles = PRINTER_ROLES.filter((r) => input.roles.some((x) => isRole(x) && x === r));
  const defaultFor =
    input.defaultFor === undefined
      ? undefined
      : PRINTER_ROLES.filter((r) => roles.includes(r) && input.defaultFor!.some((x) => isRole(x) && x === r));
  return {
    roles,
    defaultFor,
    problem: roles.length === 0 ? 'Choose what this printer is used for: kitchen tickets, bills, or both.' : null,
  };
}
