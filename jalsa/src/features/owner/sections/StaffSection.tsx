'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, Chip, Pill, SectionLabel } from '@/components/ui/atoms';
import { Sheet, ConfirmDialog } from '@/components/ui/sheet';
import { Field, Input, SearchField, Select } from '@/components/ui/field';
import { SuccessNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { PERMISSION_GROUPS, ROLE_PRESETS } from '@/lib/permissions';
import type { StaffMember } from '@/lib/db/types';
import type { OwnerSectionProps } from '../OwnerConsole';

/**
 * Screen 28 — people, roles, module access and PIN issuance.
 *
 * CREDENTIAL ISSUANCE IS PART OF THE CREATE FLOW (Standard 9.2)
 *   Record → credential → permissions, in one stepped dialog. Split apart, you get people who
 *   exist and cannot sign in, and nobody knows whose job the next step was. The PIN is shown
 *   ONCE, on the step that generated it, and it is never stored anywhere it could be read back.
 *
 * PRESETS, THEN OVERRIDES (9.1)
 *   Applying a role sets many values at once and never hides the underlying ones, so a preset is
 *   a starting point rather than a decision that has been taken away.
 */

const ROLES = ['Captain', 'Waiter', 'Chef', 'Cashier', 'Owner / Admin'] as const;

export function StaffSection({ data, send, runBusy, busy }: OwnerSectionProps) {
  const toast = useToast();
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState<{ id?: string; name: string; role: string; mobile: string } | null>(
    null
  );
  const [permsFor, setPermsFor] = React.useState<StaffMember | null>(null);
  const [granted, setGranted] = React.useState<Set<string>>(new Set());
  const [issuedPin, setIssuedPin] = React.useState<{ name: string; pin: string } | null>(null);
  const [removing, setRemoving] = React.useState<StaffMember | null>(null);
  const [removeReason, setRemoveReason] = React.useState('Left the restaurant');

  const canEdit = data.grants.includes('staff.create');
  const canPerms = data.grants.includes('staff.perms');
  const canPin = data.grants.includes('staff.pin');
  const canDuty = data.grants.includes('day.setup');

  const q = query.trim().toLowerCase();
  const people = data.staff.filter(
    (p) => !q || `${p.name} ${p.role} ${p.standingTables.join(' ')}`.toLowerCase().includes(q)
  );

  const byRole = new Map<string, StaffMember[]>();
  for (const p of people) byRole.set(p.role, [...(byRole.get(p.role) ?? []), p]);

  // Opens showing the person's CURRENT grants, never a preset standing in for them. The preset
  // buttons are an action INSIDE the panel — applying one is a decision, not a default.
  const openPerms = (p: StaffMember) => {
    setPermsFor(p);
    setGranted(new Set(data.staffGrants[p.id] ?? ROLE_PRESETS[p.role] ?? []));
  };

  return (
    <div className="flex flex-col gap-5" data-testid="owner-staff">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search people, roles and tables"
          resultCount={people.length}
          testId="owner-staff-search"
          className="min-w-[16rem] flex-1"
        />
        {canEdit ? (
          <Button data-testid="owner-add-staff" onClick={() => setEditing({ name: '', role: 'Waiter', mobile: '' })}>
            Add staff
          </Button>
        ) : null}
      </div>

      {[...byRole.entries()].map(([role, members]) => (
        <section key={role}>
          <SectionLabel>
            {role} · {members.length}
          </SectionLabel>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {members.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full type-body font-bold',
                      p.onDuty
                        ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                        : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                    )}
                  >
                    {p.initials || p.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block type-body font-semibold">{p.name}</span>
                    <span className="block type-caption text-[var(--text-muted)]">
                      {p.liveTables.length
                        ? `On ${p.liveTables.join(', ')} right now`
                        : p.standingTables.length
                          ? `${p.standingTables.join(', ')} (standing)`
                          : 'No tables assigned'}
                    </span>
                  </span>

                  <Pill tone={p.hasPin ? 'success' : 'warning'}>{p.hasPin ? 'Can sign in' : 'No PIN yet'}</Pill>

                  {canDuty ? (
                    <Button
                      data-testid={`owner-duty-${p.id}`}
                      size="sm"
                      variant={p.onDuty ? 'quiet' : 'secondary'}
                      disabled={busy}
                      onClick={() =>
                        runBusy(async () => {
                          await send('/api/owner/action', {
                            action: 'set-on-duty',
                            staffId: p.id,
                            onDuty: !p.onDuty,
                          });
                          toast.show(`${p.name} marked ${p.onDuty ? 'out' : 'in'} for today`);
                        })
                      }
                    >
                      {p.onDuty ? 'In today' : 'Out today'}
                    </Button>
                  ) : null}

                  {canPerms ? (
                    <Button
                      data-testid={`owner-perms-${p.id}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => openPerms(p)}
                    >
                      Module access
                    </Button>
                  ) : null}

                  {canPin ? (
                    <Button
                      data-testid={`owner-pin-${p.id}`}
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        runBusy(async () => {
                          const res = await send<{ pin: string }>('/api/owner/action', {
                            action: 'issue-pin',
                            staffId: p.id,
                          });
                          setIssuedPin({ name: p.name, pin: res.pin });
                        })
                      }
                    >
                      {p.hasPin ? 'Reissue PIN' : 'Give them the app'}
                    </Button>
                  ) : null}

                  {canEdit ? (
                    <>
                      <Button
                        data-testid={`owner-edit-staff-${p.id}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing({ id: p.id, name: p.name, role: p.role, mobile: p.mobile })}
                      >
                        Edit
                      </Button>
                      <Button
                        data-testid={`owner-remove-${p.id}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoving(p)}
                      >
                        Remove
                      </Button>
                    </>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Add / edit */}
      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        posture="modal"
        title={editing?.id ? 'Edit this person' : 'Add staff'}
        description="Name and role are all that is required. App access is the next step, and can wait."
        testId="owner-staff-sheet"
        footer={
          <>
            <Button data-testid="owner-staff-cancel" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-staff-save"
              disabled={busy || !editing?.name.trim()}
              onClick={() =>
                editing &&
                runBusy(async () => {
                  await send('/api/owner/action', {
                    action: 'upsert-staff',
                    ...(editing.id ? { id: editing.id } : {}),
                    name: editing.name.trim(),
                    role: editing.role,
                    mobile: editing.mobile,
                  });
                  toast.show(
                    editing.id
                      ? `${editing.name} saved`
                      : `${editing.name} added as ${editing.role} — the role preset has been applied`,
                    { tone: 'success' }
                  );
                  setEditing(null);
                })
              }
            >
              Save
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="flex flex-col gap-3">
            <Field label="Full name" required htmlFor="owner-staff-name">
              <Input
                id="owner-staff-name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                data-testid="owner-staff-name"
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Field label="Role" required htmlFor="owner-staff-role" className="min-w-[10rem] flex-1">
                <Select
                  id="owner-staff-role"
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  data-testid="owner-staff-role"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Mobile number" htmlFor="owner-staff-mobile" className="min-w-[10rem] flex-1">
                <Input
                  id="owner-staff-mobile"
                  type="tel"
                  inputMode="tel"
                  value={editing.mobile}
                  onChange={(e) => setEditing({ ...editing, mobile: e.target.value })}
                  data-testid="owner-staff-mobile"
                />
              </Field>
            </div>
            {!editing.id ? (
              <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
                Saving applies the <strong>{editing.role}</strong> preset —{' '}
                {(ROLE_PRESETS[editing.role] ?? []).length} permissions — which you can then adjust one at a time.
              </p>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      {/* Module access */}
      <Sheet
        open={permsFor !== null}
        onOpenChange={(o) => !o && setPermsFor(null)}
        posture="modal"
        title={permsFor ? `Module access · ${permsFor.name}` : 'Module access'}
        description="Grant a preset, then adjust anything by hand. Confidential permissions are marked."
        testId="owner-perms-sheet"
        footer={
          <>
            <Button data-testid="owner-perms-cancel" variant="ghost" onClick={() => setPermsFor(null)}>
              Cancel
            </Button>
            <Button
              data-testid="owner-perms-save"
              disabled={busy}
              onClick={() =>
                permsFor &&
                runBusy(async () => {
                  await send('/api/owner/action', {
                    action: 'set-permissions',
                    staffId: permsFor.id,
                    granted: [...granted],
                  });
                  toast.show(`${permsFor.name} now has ${granted.size} permissions`, { tone: 'success' });
                  setPermsFor(null);
                })
              }
            >
              Save access · {granted.size}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(ROLE_PRESETS).map((r) => (
              <Chip
                key={r}
                on={false}
                onClick={() => setGranted(new Set(ROLE_PRESETS[r]))}
                data-testid={`owner-preset-${r.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              >
                {r} preset
              </Chip>
            ))}
            <Chip on={false} onClick={() => setGranted(new Set())} data-testid="owner-preset-clear">
              Clear all
            </Chip>
          </div>

          {PERMISSION_GROUPS.map((g) => {
            const count = g.permissions.filter((p) => granted.has(p.key)).length;
            return (
              <div key={g.name}>
                <SectionLabel>
                  {g.name} · {count} of {g.permissions.length}
                </SectionLabel>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {g.permissions.map((p) => (
                    <li key={p.key}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2 type-caption hover:bg-[var(--surface-sunken)]">
                        <input
                          data-testid={`owner-perm-${p.key}`}
                          type="checkbox"
                          checked={granted.has(p.key)}
                          onChange={(e) => {
                            const next = new Set(granted);
                            if (e.target.checked) next.add(p.key);
                            else next.delete(p.key);
                            setGranted(next);
                          }}

                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        <span className="flex-1">{p.label}</span>
                        {p.confidential ? <Pill tone="warning">Confidential</Pill> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
            Every grant and revocation is written to the audit log with your name against it, and takes effect on
            their next tap — they do not need to sign in again.
          </p>
        </div>
      </Sheet>

      {/* PIN, shown once */}
      <Sheet
        open={issuedPin !== null}
        onOpenChange={(o) => !o && setIssuedPin(null)}
        posture="modal"
        title="PIN generated"
        testId="owner-pin-sheet"
        footer={
          <Button data-testid="owner-pin-done" onClick={() => setIssuedPin(null)}>
            Done
          </Button>
        }
      >
        {issuedPin ? (
          <div className="flex flex-col gap-3">
            <SuccessNotice testId="owner-pin-value">
              One-time PIN for <strong>{issuedPin.name}</strong>
            </SuccessNotice>
            <p
              /* INTENTIONAL EXCEPTION — the issued PIN, set to be read aloud across a counter.
                 Sized to its panel rather than to the reading scale; see scripts/check-typography.mjs. */
              className="m-0 rounded-[var(--radius-lg)] bg-[var(--surface-sunken)] py-6 text-center text-[38px] font-bold tracking-[0.3em] tabular-nums"
              data-testid="owner-pin-digits"
            >
              {issuedPin.pin}
            </p>
            <Button
              data-testid="owner-pin-copy"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(issuedPin.pin);
                toast.show('PIN copied');
              }}
            >
              Copy PIN
            </Button>
            <p className="m-0 type-caption leading-relaxed text-[var(--text-muted)]">
              They sign in at <strong>/staff</strong> with this PIN. It is shown once and cannot be read back — if it
              is lost, issue another. Every order, discount and closure is recorded against this name.
            </p>
          </div>
        ) : null}
      </Sheet>

      {/* Removal */}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? `Remove ${removing.name}` : 'Remove'}
        confirmLabel="Remove them"
        reasons={['Left the restaurant', 'Moved to another branch', 'Added by mistake', 'No longer needs the app']}
        reason={removeReason}
        onReasonChange={setRemoveReason}
        busy={busy}
        testId="owner-remove-dialog"
        consequence={
          removing ? (
            <p className="m-0 leading-relaxed">
              {removing.name} can no longer sign in, and their PIN stops working immediately. Their name{' '}
              <strong>stays</strong> on every bill they closed and every ticket they sent — history is never
              rewritten.
            </p>
          ) : null
        }
        onConfirm={() =>
          removing &&
          runBusy(async () => {
            await send('/api/owner/action', { action: 'remove-staff', staffId: removing.id, reason: removeReason });
            toast.show(`${removing.name} removed — ${removeReason.toLowerCase()}`, { tone: 'success' });
            setRemoving(null);
          })
        }
      />
    </div>
  );
}
