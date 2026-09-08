/**
 * CP-27 — the audit trail. Who changed what, from what, to what, and when.
 *
 * WHY THIS IS A SHARED LIBRARY AND NOT A TABLE EACH APP WRITES
 *   An audit log is the record you reach for on the worst day: a permission someone denies
 *   granting, a fee that changed with no explanation, an account nobody admits creating. It is
 *   worth exactly as much as its weakest row, and the ways it goes quietly worthless are
 *   always the same four. Each rule below exists for one of them, and each has a spec.
 *
 * 1. AN ENTRY WITH NO REAL ACTOR IS NOT AN AUDIT ENTRY
 *    "Modified by: System" against a change a person made is the failure this file exists to
 *    prevent (ROOT_CAUSE_REGISTER RC-007, where exactly that shipped). A genuine background
 *    job IS System and says so; a USER action whose actor could not be resolved is recorded as
 *    UNRESOLVED, and renders visibly wrong - "Unknown (u-91ab)" - because a visibly wrong row
 *    gets fixed and a plausible one never does.
 *
 * 2. AN AUDIT ROW MUST NEVER CARRY THE SECRET IT IS AUDITING
 *    "Password changed" is the record. The password is not. A log that faithfully captures
 *    before-and-after values is a credential store with a search box, and it is usually the
 *    most widely readable table in the product.
 *
 * 3. A CHANGE THAT DID NOT HAPPEN MUST NOT APPEAR
 *    Reordering a role list is not a role change. Comparing arrays positionally reports one
 *    anyway, and a log where most rows are noise is a log nobody reads - which costs more than
 *    having none, because everyone believes it is being watched.
 *
 * 4. THE LOG IS APPEND-ONLY
 *    There is no updater and no deleter in this file, deliberately. An audit trail that can be
 *    edited answers the question "what happened" with "whatever the last editor preferred".
 */

// ---------------------------------------------------------------------------------------
// The actor
// ---------------------------------------------------------------------------------------

export type Actor =
  /** A person, resolved to a real identity. */
  | { kind: 'user'; id: string; name: string }
  /** A genuine background process: a scheduled job, a webhook, a migration. Honest System. */
  | { kind: 'system'; process: string }
  /** A user action whose identity could NOT be resolved. Never dressed up as System. */
  | { kind: 'unresolved'; id?: string };

/**
 * Render the actor for display. The unresolved case is deliberately ugly.
 *
 * Falling back to "System" here is the single most tempting line of code in this file, and it
 * is how an audit trail becomes untrue: every orphaned row acquires a plausible author, and
 * nobody ever discovers that identity resolution is broken.
 */
export function renderActor(actor: Actor): string {
  if (actor.kind === 'user') return actor.name.trim() || `Unknown (${actor.id})`;
  if (actor.kind === 'system') return `System (${actor.process})`;
  return actor.id ? `Unknown (${actor.id})` : 'Unknown';
}

/** True when the row cannot answer "who did this" - the report every audit review should run. */
export const isUnattributed = (e: AuditEntry): boolean => e.actor.kind === 'unresolved';

// ---------------------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------------------

/**
 * Field names whose VALUE never enters an audit row. Matched on the normalised field name, so
 * `newPassword`, `password_hash` and `user.password` are all caught.
 *
 * Deliberately a denylist of field names rather than a value scan: a value scan cannot tell a
 * token from any other opaque string, and the field name is what the developer actually knows.
 */
const SECRET_FIELDS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'apikey', 'api_key', 'accesskey',
  'privatekey', 'otp', 'pin', 'cvv', 'ssn', 'aadhaar', 'pan', 'authorization', 'cookie',
  'sessionid', 'refreshtoken', 'clientsecret', 'salt', 'hash',
];

const normaliseField = (field: string) => field.toLowerCase().replace(/[^a-z]/g, '');

export function isSecretField(field: string): boolean {
  const n = normaliseField(field);
  return SECRET_FIELDS.some((s) => n.includes(normaliseField(s)));
}

/** What a redacted value reads as. Not empty: the reader must see that something WAS there. */
export const REDACTED = '••••••• (not recorded)';

// ---------------------------------------------------------------------------------------
// Value rendering
// ---------------------------------------------------------------------------------------

/** A value that was never set. `—`, never "null" and never `0` - see CP-24's honesty rules. */
export const ABSENT = '—';

/** Longer than this and the cell stops being readable; the full value belongs in the record. */
const MAX_VALUE_LENGTH = 160;

/**
 * Render one value for the Previous / New columns.
 *
 * Arrays are SORTED before rendering. Roles and feature lists arrive in whatever order the
 * server assembled them, and an unsorted render makes ["owner","staff"] and ["staff","owner"]
 * look like a change to every human reading the row, even when the diff correctly said nothing
 * happened.
 */
export function renderValue(value: unknown, field = ''): string {
  if (field && isSecretField(field)) return REDACTED;
  if (value === null || value === undefined || value === '') return ABSENT;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (!value.length) return ABSENT;
    return truncate([...value].map((v) => String(v)).sort((a, b) => a.localeCompare(b)).join(', '));
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return truncate(JSON.stringify(value));
  return truncate(String(value));
}

function truncate(s: string): string {
  return s.length <= MAX_VALUE_LENGTH ? s : `${s.slice(0, MAX_VALUE_LENGTH - 1)}…`;
}

// ---------------------------------------------------------------------------------------
// The entry
// ---------------------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  /** What changed / the action name, in the user's language. Never an engine string (CP-11). */
  action: string;
  /** The screen or module it happened on - also the filter dimension. */
  module: string;
  /** Rendered, redacted, display-ready. `—` when nothing existed before. */
  previousValue: string;
  newValue: string;
  actor: Actor;
  /** ISO 8601, always. Display formatting is the view's job (CP-15). */
  at: string;
  remarks?: string;
}

export interface AuditContext {
  module: string;
  actor: Actor;
  at?: string | Date;
  remarks?: string;
  /** Supply in tests, or where ids must be reproducible. */
  id?: string;
}

let seq = 0;
const nextId = () => `a-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const isoOf = (at: AuditContext['at']): string =>
  at instanceof Date ? at.toISOString() : (at ?? new Date().toISOString());

/** One entry. There is no counterpart that edits or removes one - see rule 4 above. */
export function auditEntry(
  action: string,
  before: unknown,
  after: unknown,
  ctx: AuditContext,
  field = '',
): AuditEntry {
  return {
    id: ctx.id ?? nextId(),
    action,
    module: ctx.module,
    previousValue: renderValue(before, field),
    newValue: renderValue(after, field),
    actor: ctx.actor,
    at: isoOf(ctx.at),
    ...(ctx.remarks ? { remarks: ctx.remarks } : {}),
  };
}

// ---------------------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------------------

/** Set-equality for arrays, so order is not mistaken for change. See rule 3. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sa = [...a].map(String).sort();
    const sb = [...b].map(String).sort();
    return sa.every((v, i) => v === sb[i]);
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  // Absent shapes are the same absence: null, undefined and "" all mean "not set", and a log
  // that reports null -> "" as a change is reporting on its own serialisation.
  const absent = (v: unknown) => v === null || v === undefined || v === '';
  if (absent(a) && absent(b)) return true;
  return a === b;
}

export interface FieldLabels { [field: string]: string }

/**
 * One entry per field that ACTUALLY changed. Unchanged fields produce nothing.
 *
 * `labels` maps a field name to the words a user would recognise. A row that says
 * `role_ids` changed is a row written for the database, and the person reading the audit log
 * at 9pm is not holding the schema.
 */
export function diffRecords(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
  ctx: AuditContext,
  labels: FieldLabels = {},
): AuditEntry[] {
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const out: AuditEntry[] = [];
  for (const field of fields) {
    if (sameValue(before[field], after[field])) continue;
    out.push(auditEntry(labels[field] ?? field, before[field], after[field], ctx, field));
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// RBAC events - the three the platform must always record
// ---------------------------------------------------------------------------------------

/**
 * Creating an account. There is no previous value, and that is `—` rather than blank: an empty
 * cell reads as "we did not capture it", which is a different claim.
 */
export function auditAccountCreated(
  account: { id: string; name?: string; email?: string },
  ctx: AuditContext,
): AuditEntry {
  return auditEntry(
    'Account created',
    null,
    account.name || account.email || account.id,
    { ...ctx, remarks: ctx.remarks ?? `Account id ${account.id}` },
  );
}

/** Assigning or changing roles. Compared as a SET, so reordering is not a change. */
export function auditRolesAssigned(
  previousRoles: readonly string[],
  newRoles: readonly string[],
  ctx: AuditContext,
): AuditEntry | null {
  if (sameValue([...previousRoles], [...newRoles])) return null;
  return auditEntry('Roles changed', [...previousRoles], [...newRoles], ctx);
}

/**
 * Customising which features a role or account may reach. Recorded as the enabled SET before
 * and after: "granted Billing" alone cannot answer "what could they see in March".
 */
export function auditFeatureAccessChanged(
  previousFeatures: readonly string[],
  newFeatures: readonly string[],
  ctx: AuditContext,
): AuditEntry | null {
  if (sameValue([...previousFeatures], [...newFeatures])) return null;
  const added = newFeatures.filter((f) => !previousFeatures.includes(f)).sort();
  const removed = previousFeatures.filter((f) => !newFeatures.includes(f)).sort();
  const summary = [
    added.length ? `enabled ${added.join(', ')}` : '',
    removed.length ? `disabled ${removed.join(', ')}` : '',
  ].filter(Boolean).join('; ');
  return auditEntry('Feature access changed', [...previousFeatures], [...newFeatures], {
    ...ctx,
    remarks: ctx.remarks ?? (summary ? summary.charAt(0).toUpperCase() + summary.slice(1) : undefined),
  });
}

// ---------------------------------------------------------------------------------------
// Reading the log
// ---------------------------------------------------------------------------------------

/** The modules present, for the filter's options. Derived from the data, never hand-listed. */
export function modulesIn(entries: readonly AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.module))].sort((a, b) => a.localeCompare(b));
}

/**
 * Newest first - an audit log's only sensible default. The most recent change is the one
 * someone is asking about; making them sort to reach it answers a question they did not ask.
 */
export function newestFirst(entries: readonly AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.at.localeCompare(a.at));
}

/** Flatten for the search box and the table, which work on plain fields (CP-23's `Row`). */
export function toRow(e: AuditEntry): Record<string, unknown> {
  return {
    id: e.id,
    action: e.action,
    module: e.module,
    previousValue: e.previousValue,
    newValue: e.newValue,
    modifiedBy: renderActor(e.actor),
    at: e.at,
    remarks: e.remarks ?? '',
  };
}
