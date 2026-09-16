/**
 * permissions - the permission matrix, as data.
 *
 * Reusable Design Standard 9.1: access is granted by applying a role PRESET and then adjusting
 * individual permissions. Both halves matter - roles cover the common case, and reality always
 * has exceptions. Supporting only one of the two guarantees workarounds.
 *
 * The KEYS are the contract shared with the database (`staff_permission.perm_key`) and with the
 * owner's Module access panel. The GROUPS and LABELS are what that panel renders, so a new
 * permission appears in the UI the moment it exists here - there is no second list to update,
 * and therefore no way to ship a permission nobody can grant.
 *
 * CONFIDENTIAL permissions are marked. The design's panel shows the badge; the audit log records
 * the grant. Marking them here rather than in the panel means an export or a report cannot
 * accidentally treat one as ordinary.
 */

export interface PermissionDef {
  key: string;
  label: string;
  /** Needs an explicit grant - it is not part of "just doing the job". */
  approval?: boolean;
  /** Shown with the CONFIDENTIAL badge, and its grant is a marked audit entry. */
  confidential?: boolean;
}

export interface PermissionGroup {
  name: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    name: 'Orders',
    permissions: [
      { key: 'orders.view', label: 'See orders on assigned tables' },
      { key: 'orders.create', label: 'Place an order for a table', approval: true },
      { key: 'orders.add_items', label: 'Add items to an open bill', approval: true },
      { key: 'orders.qty_change', label: 'Change quantities', approval: true },
      { key: 'orders.cancel_before', label: 'Cancel before the kitchen starts', approval: true },
      { key: 'orders.cancel_after', label: 'Cancel after the kitchen starts', approval: true, confidential: true },
      { key: 'orders.status', label: 'Update order status', approval: true },
      { key: 'orders.reprint', label: 'Reprint a KOT', approval: true },
    ],
  },
  {
    name: 'Waitlist',
    permissions: [
      { key: 'queue.view', label: 'See the entrance queue' },
      { key: 'queue.walkin', label: 'Add a walk-in party', approval: true },
      { key: 'queue.notify', label: 'Call or notify a waiting party', approval: true },
      { key: 'queue.seat', label: 'Seat a party at a table', approval: true },
      { key: 'queue.close', label: 'Close the queue to new parties', approval: true, confidential: true },
      { key: 'queue.clear', label: 'Clear everyone still waiting', approval: true, confidential: true },
    ],
  },
  {
    name: 'Tables',
    permissions: [
      { key: 'tables.view', label: 'See the floor' },
      { key: 'tables.assign', label: 'Assign a table to a captain', approval: true },
      { key: 'tables.qr', label: 'View or download a table QR' },
      // Not an approval grant, unlike tables.free. Clearing takes nothing away that cannot be
      // put back: it closes no bill and releases no table that is still held — it records that
      // a table somebody has already left has been reset for the next party.
      { key: 'tables.clear', label: 'Mark a table cleared for the next party' },
      { key: 'tables.transfer', label: 'Move a bill to another table', approval: true, confidential: true },
      {
        key: 'tables.free',
        label: 'Mark a table free by hand',
        approval: true,
        confidential: true,
      },
      {
        key: 'bill.reassign_staff',
        label: 'Change the captain or waiter on a bill',
        approval: true,
        confidential: true,
      },
    ],
  },
  {
    name: 'Menu',
    permissions: [
      { key: 'menu.view', label: 'See the menu' },
      { key: 'menu.availability', label: 'Mark an item sold out or paused', approval: true },
      { key: 'menu.item_edit', label: 'Add or edit items', approval: true },
      { key: 'menu.price_edit', label: 'Change prices', approval: true, confidential: true },
      { key: 'menu.category', label: 'Manage categories', approval: true },
    ],
  },
  {
    name: 'Billing',
    permissions: [
      { key: 'bill.view', label: 'See a bill and its total' },
      { key: 'bill.disc_pct', label: 'Apply a percentage discount', approval: true },
      { key: 'bill.disc_flat', label: 'Apply a flat discount', approval: true },
      { key: 'bill.record_payment', label: 'Record payment and close a bill', approval: true },
      { key: 'bill.reprint', label: 'Reprint a bill', approval: true },
      { key: 'bill.tax_view', label: 'See tax configuration', confidential: true },
      { key: 'bill.void', label: 'Void a closed bill', approval: true, confidential: true },
    ],
  },
  {
    name: 'Tips',
    permissions: [
      { key: 'tips.own', label: 'See own tips' },
      { key: 'tips.all', label: "See everyone's tips", confidential: true },
      { key: 'tips.settle', label: 'Record tip settlement', approval: true },
    ],
  },
  {
    name: 'Reports',
    permissions: [
      { key: 'rep.sales', label: 'Sales reports', confidential: true },
      { key: 'rep.products', label: 'Product reports' },
      { key: 'rep.staff', label: 'Staff performance' },
      { key: 'rep.expenses', label: 'Expenses and net', confidential: true },
      { key: 'rep.reviews', label: 'Review engagement' },
    ],
  },
  {
    name: 'Staff',
    permissions: [
      { key: 'staff.view', label: 'See the staff list' },
      { key: 'staff.create', label: 'Add or edit staff', approval: true },
      { key: 'staff.perms', label: 'Change permissions', approval: true, confidential: true },
      { key: 'staff.pin', label: 'Generate or reset login PINs', approval: true, confidential: true },
      // Salary, PAN and the bank fragment the payslip prints. Separate from `staff.create`,
      // which is name, role and who is on duty: fixing a spelling in a waiter's name is not the
      // same act as reading what the senior captain is paid.
      { key: 'staff.paperwork', label: 'Employment record and HR documents', approval: true, confidential: true },
    ],
  },
  {
    name: 'Settings',
    permissions: [
      { key: 'set.hours', label: 'Opening hours and holidays' },
      { key: 'set.identity', label: 'Restaurant details and logo' },
      { key: 'set.tax', label: 'Tax and GST', confidential: true },
      { key: 'set.invoice', label: 'Invoice numbering and format' },
      { key: 'set.printer', label: 'Printer routing' },
      { key: 'set.tables', label: 'Tables and QR codes' },
      { key: 'set.features', label: 'What the customer sees' },
      { key: 'set.copy', label: 'Words the guest sees' },
      { key: 'set.whatsapp', label: 'WhatsApp delivery' },
      { key: 'set.review', label: 'Google review link' },
      { key: 'audit.view', label: 'Read the audit log', confidential: true },
      { key: 'expense.manage', label: 'Enter and edit expenses', approval: true },
      { key: 'day.setup', label: "Open the day and set today's note", approval: true },
    ],
  },
] as const;

export const ALL_PERMISSION_KEYS: readonly string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

export function permissionLabel(key: string): string {
  for (const g of PERMISSION_GROUPS) {
    for (const p of g.permissions) if (p.key === key) return p.label;
  }
  // An unknown key is shown as itself rather than hidden: a permission the panel cannot name
  // is a bug, and hiding it is how it stays one.
  return key;
}

export function isConfidential(key: string): boolean {
  for (const g of PERMISSION_GROUPS) {
    for (const p of g.permissions) if (p.key === key) return p.confidential === true;
  }
  return false;
}

/**
 * Role presets. A starting point an owner then adjusts - never the final word.
 *
 * The Waiter preset deliberately omits `bill.view`. The design hides amounts from waiters and
 * says so on screen ("Bill amounts are hidden for waiters. Imran or Javeed closes the bill."),
 * and an action that is hidden but not actually withheld is the worst of both.
 */
export const ROLE_PRESETS: Record<string, readonly string[]> = {
  Captain: [
    'queue.view',
    'queue.walkin',
    'queue.notify',
    'queue.seat',
    'orders.view',
    'orders.create',
    'orders.add_items',
    'orders.qty_change',
    'orders.cancel_before',
    'orders.status',
    'orders.reprint',
    'tables.view',
    'tables.assign',
    'tables.qr',
    'tables.clear',
    'menu.view',
    'menu.availability',
    'bill.view',
    'bill.record_payment',
    'bill.reprint',
    'tips.own',
    'rep.products',
  ],
  Waiter: [
    'queue.view', 'orders.view', 'orders.status', 'tables.view', 'tables.clear',
    'menu.view', 'menu.availability', 'tips.own',
  ],
  Chef: ['orders.view', 'orders.status', 'orders.reprint', 'menu.view', 'menu.availability'],
  Cashier: [
    'queue.view',
    'queue.notify',
    'orders.view',
    'tables.view',
    'bill.view',
    'bill.record_payment',
    'bill.reprint',
    'bill.disc_pct',
    'tips.settle',
  ],
  'Owner / Admin': ALL_PERMISSION_KEYS,
};

/**
 * A person's effective grants, as a set the server and the UI both read.
 *
 * The UI uses it to withhold an action it cannot honour (Standard 5.6 - a button that silently
 * does nothing is worse than an absent one). The server uses THE SAME function to refuse it,
 * because a hidden button is a UI convenience, never a security boundary.
 */
export class Grants {
  private readonly keys: ReadonlySet<string>;

  constructor(keys: Iterable<string>) {
    this.keys = new Set(keys);
  }

  can(key: string): boolean {
    return this.keys.has(key);
  }

  /** Every grant, for the "What you may do tonight" list on the staff Me screen. */
  list(): string[] {
    return [...this.keys].sort();
  }

  countIn(group: PermissionGroup): number {
    return group.permissions.filter((p) => this.keys.has(p.key)).length;
  }
}

/** Thrown by server code when a caller lacks a permission. Maps to the designed denied state. */
export class PermissionDenied extends Error {
  readonly permission: string;

  constructor(permission: string) {
    super(`Not permitted: ${permissionLabel(permission)}`);
    this.name = 'PermissionDenied';
    this.permission = permission;
  }
}
