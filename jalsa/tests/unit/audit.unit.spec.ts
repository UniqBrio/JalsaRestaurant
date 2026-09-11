/**
 * audit unit spec — the four ways an audit trail goes quietly worthless (CP-27).
 *
 * Every assertion here is about TRUST, not formatting. An audit log that renders beautifully
 * and attributes a human's action to "System" is worse than no log, because the wrong answer
 * is believed. These run against the actual lib, not a description of it.
 */
import { test, expect } from '@playwright/test';
import {
  ABSENT, REDACTED, auditAccountCreated, auditEntry, auditFeatureAccessChanged,
  auditRolesAssigned, diffRecords, isSecretField, isUnattributed, modulesIn, newestFirst,
  renderActor, renderValue, toRow, type Actor, type AuditEntry,
} from '../../src/lib/audit';

const alice: Actor = { kind: 'user', id: 'u-1', name: 'Alice Menon' };
const ctx = (over: Partial<{ module: string; actor: Actor; at: string; id: string }> = {}) => ({
  module: 'User management', actor: alice, at: '2026-09-08T10:00:00.000Z', id: 'a-1', ...over,
});

/* ---- 1. an entry with no real actor is not an audit entry ---- */

test('a resolved person renders as their name', () => {
  expect(renderActor(alice)).toBe('Alice Menon');
});

test('a genuine background job is System, and SAYS which process', () => {
  // "System" alone is unfalsifiable. Naming the process makes it checkable.
  expect(renderActor({ kind: 'system', process: 'nightly-invoice-run' })).toBe('System (nightly-invoice-run)');
});

test('an UNRESOLVED actor never becomes System - it renders visibly wrong', () => {
  // RC-007 shipped audit rows attributed to "System" for actions people took. A plausible
  // wrong author is never discovered; an ugly one gets fixed.
  expect(renderActor({ kind: 'unresolved', id: 'u-91ab' })).toBe('Unknown (u-91ab)');
  expect(renderActor({ kind: 'unresolved' })).toBe('Unknown');
  expect(renderActor({ kind: 'user', id: 'u-7', name: '   ' })).toBe('Unknown (u-7)');
});

test('unattributed entries are countable, so the defect can be surfaced', () => {
  const e = auditEntry('Roles changed', ['staff'], ['owner'], ctx({ actor: { kind: 'unresolved' } }));
  expect(isUnattributed(e)).toBe(true);
  expect(isUnattributed(auditEntry('x', 1, 2, ctx()))).toBe(false);
});

/* ---- 2. an audit row must never carry the secret it audits ---- */

test('secret field names are recognised however they are spelled', () => {
  for (const f of ['password', 'newPassword', 'password_hash', 'user.password', 'apiKey',
                   'API_KEY', 'refreshToken', 'otp', 'cvv', 'clientSecret']) {
    expect(isSecretField(f), `${f} must be treated as secret`).toBe(true);
  }
  for (const f of ['name', 'email', 'roles', 'module', 'status']) {
    expect(isSecretField(f), `${f} must NOT be redacted`).toBe(false);
  }
});

test('a secret value is replaced, and the row still shows something HAPPENED', () => {
  // Not blank: blank reads as "we did not capture it", which is a different claim.
  expect(renderValue('hunter2', 'password')).toBe(REDACTED);
  expect(REDACTED).not.toBe('');
});

test('a password change is recorded as an event, with no values on either side', () => {
  const [entry] = diffRecords(
    { password: 'old-one' }, { password: 'new-one' }, ctx(), { password: 'Password changed' },
  );
  expect(entry?.action).toBe('Password changed');
  expect(entry?.previousValue).toBe(REDACTED);
  expect(entry?.newValue).toBe(REDACTED);
});

/* ---- 3. a change that did not happen must not appear ---- */

test('reordering a role list is NOT a change', () => {
  // The failure this prevents: every login re-serialises roles in a different order and the
  // log fills with role changes nobody made, until nobody reads it.
  expect(auditRolesAssigned(['owner', 'staff'], ['staff', 'owner'], ctx())).toBeNull();
  expect(auditFeatureAccessChanged(['billing', 'reports'], ['reports', 'billing'], ctx())).toBeNull();
});

test('a real role change IS recorded, with both sides sorted for comparison', () => {
  const e = auditRolesAssigned(['staff'], ['owner', 'staff'], ctx())!;
  expect(e).not.toBeNull();
  expect(e.previousValue).toBe('staff');
  expect(e.newValue).toBe('owner, staff');
});

test('unchanged fields produce no entries at all', () => {
  const before = { name: 'Asha', roles: ['staff'], active: true };
  const after = { name: 'Asha', roles: ['staff'], active: false };
  const entries = diffRecords(before, after, ctx(), { active: 'Account active' });
  expect(entries).toHaveLength(1);
  expect(entries[0]?.action).toBe('Account active');
  expect(entries[0]?.previousValue).toBe('Yes');
  expect(entries[0]?.newValue).toBe('No');
});

test('null, undefined and empty string are the SAME absence', () => {
  // Otherwise the log reports on its own serialisation: null -> "" is not a business event.
  expect(diffRecords({ note: null }, { note: '' }, ctx())).toHaveLength(0);
  expect(diffRecords({ note: undefined }, { note: null }, ctx())).toHaveLength(0);
  expect(diffRecords({ note: null }, { note: 'something' }, ctx())).toHaveLength(1);
});

/* ---- value rendering ---- */

test('an absent value renders as a dash, never "null" and never 0', () => {
  expect(renderValue(null)).toBe(ABSENT);
  expect(renderValue(undefined)).toBe(ABSENT);
  expect(renderValue('')).toBe(ABSENT);
  expect(renderValue([])).toBe(ABSENT);
  expect(renderValue(0)).toBe('0');      // a real zero is a real value
  expect(renderValue(false)).toBe('No'); // and a real false is a real value
});

test('a long value is truncated so one row cannot destroy the table', () => {
  const out = renderValue('x'.repeat(500));
  expect(out.length).toBeLessThanOrEqual(160);
  expect(out.endsWith('…')).toBe(true);
});

/* ---- the three RBAC events the platform must always record ---- */

test('creating an account records a dash as the previous value, not a blank', () => {
  const e = auditAccountCreated({ id: 'u-9', name: 'New Person' }, ctx({ module: 'Accounts' }));
  expect(e.action).toBe('Account created');
  expect(e.previousValue).toBe(ABSENT);
  expect(e.newValue).toBe('New Person');
  expect(e.remarks).toContain('u-9');
});

test('feature access records the whole enabled SET, plus a readable summary', () => {
  // "Granted billing" alone cannot answer "what could they reach in March".
  const e = auditFeatureAccessChanged(['reports'], ['reports', 'billing'], ctx({ module: 'Feature access' }))!;
  expect(e.previousValue).toBe('reports');
  expect(e.newValue).toBe('billing, reports');
  expect(e.remarks).toBe('Enabled billing');

  const removed = auditFeatureAccessChanged(['reports', 'billing'], ['reports'], ctx())!;
  expect(removed.remarks).toBe('Disabled billing');
});

/* ---- reading the log ---- */

test('the log reads newest first by default', () => {
  const mk = (id: string, at: string): AuditEntry =>
    auditEntry('x', 1, 2, { module: 'M', actor: alice, at, id });
  const out = newestFirst([
    mk('a', '2026-09-01T00:00:00.000Z'),
    mk('c', '2026-09-08T00:00:00.000Z'),
    mk('b', '2026-09-04T00:00:00.000Z'),
  ]);
  expect(out.map((e) => e.id)).toEqual(['c', 'b', 'a']);
});

test('module options come from the data, sorted, never hand-listed', () => {
  const mk = (module: string) => auditEntry('x', 1, 2, { module, actor: alice, at: '2026-09-08T00:00:00.000Z' });
  expect(modulesIn([mk('Users'), mk('Billing'), mk('Users')])).toEqual(['Billing', 'Users']);
});

test('the row shape carries the RESOLVED actor, so search can find a person by name', () => {
  const r = toRow(auditEntry('Roles changed', ['staff'], ['owner'], ctx()));
  expect(r.modifiedBy).toBe('Alice Menon');
  expect(r.at).toBe('2026-09-08T10:00:00.000Z'); // stored ISO; the view formats it (CP-15)
  expect(r.remarks).toBe('');                    // never undefined - the table renders a cell
});

/* ---- 4. append-only, structurally ---- */

test('the module exports no way to change or remove an entry', async () => {
  const mod = await import('../../src/lib/audit');
  const mutators = Object.keys(mod).filter((k) => /^(update|edit|delete|remove|patch|set)/i.test(k));
  expect(mutators, `an audit trail with a mutator answers "what happened" with "whatever the last editor preferred"`)
    .toEqual([]);
});
