import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { PermissionDenied, ROLE_PRESETS } from '@/lib/permissions';
import { rupees } from '@/lib/money';
import { audit, nextNumber, type Actor } from './mutations';

/**
 * owner-mutations — the configuration writes, kept apart from the operational ones.
 *
 * WHY THE SPLIT
 *   `mutations.ts` is the service: rounds, quantities, closures. Everything here changes what
 *   the service will do NEXT — the menu, the people, the rates, the words a guest reads. They
 *   have different blast radii and different audit obligations, and mixing them means the file
 *   that decides whether a guest can be charged also decides what colour a food-type mark is.
 *
 * EVERY WRITE BELOW IS AUDITED WITH ITS BEFORE AND AFTER where a figure changed. A settings
 * screen that records "settings updated" answers no dispute anyone will ever actually have.
 */

function demand(actor: Actor, permission: string): void {
  if (!actor.grants || !actor.grants.can(permission)) throw new PermissionDenied(permission);
}

/* ── Menu ──────────────────────────────────────────────────────────────── */

export async function upsertMenuItem(input: {
  id?: string;
  name: string;
  price: number;
  categoryId: string;
  foodType: 'veg' | 'non_veg' | 'egg';
  description?: string;
  actor: Actor;
}): Promise<{ id: string }> {
  demand(input.actor, input.id ? 'menu.item_edit' : 'menu.item_edit');
  const restaurantId = await currentRestaurantId();

  if (input.id) {
    const { data: before } = await db().from('menu_item').select('name,price').eq('id', input.id).maybeSingle();
    const priceChanged = before && Number(before.price) !== input.price;
    // A price change is a different act from an edit, and a confidential one. It is checked
    // separately so a person who may fix a typo cannot quietly reprice the biryani.
    if (priceChanged) demand(input.actor, 'menu.price_edit');

    const { error } = await db()
      .from('menu_item')
      .update({
        name: input.name,
        price: input.price,
        category_id: input.categoryId,
        food_type: input.foodType,
        description: input.description ?? '',
      })
      .eq('id', input.id);
    if (error) throw error;

    await audit({
      action: priceChanged ? 'Price' : 'Menu item',
      detail: priceChanged
        ? `${input.name}: ${rupees(Number(before?.price ?? 0))} → ${rupees(input.price)}`
        : `${input.name} edited`,
      actor: input.actor,
      confidential: !!priceChanged,
    });
    return { id: input.id };
  }

  const { data, error } = await db()
    .from('menu_item')
    .insert({
      restaurant_id: restaurantId,
      name: input.name,
      price: input.price,
      category_id: input.categoryId,
      food_type: input.foodType,
      description: input.description ?? '',
    })
    .select('id')
    .single();
  if (error) throw error;

  await audit({ action: 'Menu item', detail: `${input.name} added at ${rupees(input.price)}`, actor: input.actor });
  return { id: data.id as string };
}

export async function addCategory(input: { name: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'menu.category');
  const restaurantId = await currentRestaurantId();
  const { error } = await db().from('menu_category').insert({ restaurant_id: restaurantId, name: input.name });
  if (error) throw error;
  await audit({ action: 'Menu category', detail: `${input.name} added`, actor: input.actor });
}

/* ── Tables ────────────────────────────────────────────────────────────── */

export async function upsertTable(input: {
  id?: string;
  name: string;
  zone: string;
  seats: number;
  active: boolean;
  actor: Actor;
}): Promise<void> {
  demand(input.actor, 'set.tables');
  const restaurantId = await currentRestaurantId();

  if (input.id) {
    // Renaming a table keeps its QR working, because the QR resolves on the row, not the name.
    const { error } = await db()
      .from('dining_table')
      .update({ name: input.name, zone: input.zone, seats: input.seats, active: input.active })
      .eq('id', input.id);
    if (error) throw error;
    await audit({
      action: 'Table',
      detail: `${input.name} updated — ${input.seats} seats, ${input.active ? 'on' : 'off'} the floor`,
      actor: input.actor,
      tableId: input.id,
    });
    return;
  }

  const { error } = await db().from('dining_table').insert({
    restaurant_id: restaurantId,
    name: input.name,
    zone: input.zone,
    seats: input.seats,
    active: input.active,
  });
  if (error) throw error;
  await audit({ action: 'Table', detail: `${input.name} added in ${input.zone}`, actor: input.actor });
}

/* ── People ────────────────────────────────────────────────────────────── */

export async function upsertStaff(input: {
  id?: string;
  name: string;
  role: string;
  mobile?: string;
  actor: Actor;
}): Promise<{ id: string }> {
  demand(input.actor, 'staff.create');
  const restaurantId = await currentRestaurantId();

  if (input.id) {
    const { error } = await db()
      .from('staff')
      .update({ name: input.name, role: input.role, mobile: input.mobile ?? '' })
      .eq('id', input.id);
    if (error) throw error;
    await audit({ action: 'Staff', detail: `${input.name} updated — ${input.role}`, actor: input.actor });
    return { id: input.id };
  }

  const { data, error } = await db()
    .from('staff')
    .insert({
      restaurant_id: restaurantId,
      name: input.name,
      role: input.role,
      mobile: input.mobile ?? '',
      initials: input.name
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2),
    })
    .select('id')
    .single();
  if (error) throw error;

  // Standard 9.1: creating a person APPLIES the role preset, then the owner adjusts. A new
  // captain who can do nothing until someone remembers to tick twenty boxes is a captain who
  // spends their first shift borrowing somebody else's PIN.
  const preset = ROLE_PRESETS[input.role] ?? [];
  if (preset.length) {
    await db()
      .from('staff_permission')
      .insert(
        preset.map((perm_key) => ({
          staff_id: data.id as string,
          perm_key,
          granted: true,
          granted_by: input.actor.label,
        }))
      );
  }

  await audit({
    action: 'Staff',
    detail: `${input.name} added as ${input.role} — ${preset.length} permissions from the role preset`,
    actor: input.actor,
  });
  return { id: data.id as string };
}

/**
 * Issue a PIN.
 *
 * Standard 9.2: credential issuance belongs INSIDE the create flow, and the credential is shown
 * ONCE. Returning it here — rather than storing it anywhere readable — is what makes "show it
 * once, then it is hidden" true rather than a UI convention.
 */
export async function issuePin(input: { staffId: string; actor: Actor }): Promise<{ pin: string }> {
  demand(input.actor, 'staff.pin');

  // Four digits, uniformly drawn, with the trivial ones excluded. 0000 and 1234 are the two
  // PINs a stranger tries first, and a generator that can produce them will.
  const banned = new Set([
    '0000',
    '1111',
    '2222',
    '3333',
    '4444',
    '5555',
    '6666',
    '7777',
    '8888',
    '9999',
    '1234',
    '4321',
  ]);
  let pin = '';
  do {
    pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  } while (banned.has(pin));

  const { error } = await db().rpc('set_staff_pin', { p_staff: input.staffId, p_pin: pin });
  if (error) throw error;

  const { data: person } = await db().from('staff').select('name').eq('id', input.staffId).maybeSingle();
  await audit({
    action: 'Permission',
    detail: `A new sign-in PIN was issued to ${person?.name ?? 'a member of staff'}`,
    actor: input.actor,
    confidential: true,
  });
  return { pin };
}

export async function setPermissions(input: { staffId: string; granted: string[]; actor: Actor }): Promise<void> {
  demand(input.actor, 'staff.perms');

  const { data: person } = await db().from('staff').select('name').eq('id', input.staffId).maybeSingle();
  const { data: before } = await db()
    .from('staff_permission')
    .select('perm_key')
    .eq('staff_id', input.staffId)
    .eq('granted', true);
  const had = new Set((before ?? []).map((r) => r.perm_key as string));
  const now = new Set(input.granted);

  const added = [...now].filter((k) => !had.has(k));
  const removed = [...had].filter((k) => !now.has(k));

  await db().from('staff_permission').delete().eq('staff_id', input.staffId);
  if (input.granted.length) {
    const { error } = await db()
      .from('staff_permission')
      .insert(
        input.granted.map((perm_key) => ({
          staff_id: input.staffId,
          perm_key,
          granted: true,
          granted_by: input.actor.label,
        }))
      );
    if (error) throw error;
  }

  // The audit says WHAT CHANGED, not "permissions saved". A log that cannot answer "when did
  // Karthik get discounts?" is a log nobody consults twice.
  await audit({
    action: 'Permission',
    detail: [
      person?.name ?? 'A member of staff',
      added.length ? `granted: ${added.join(', ')}` : '',
      removed.length ? `revoked: ${removed.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' — '),
    actor: input.actor,
    confidential: true,
  });
}

export async function removeStaff(input: { staffId: string; reason: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'staff.create');
  const { data: person } = await db().from('staff').select('name').eq('id', input.staffId).maybeSingle();

  // Soft removal, always. A person's name has to stay resolvable on every bill they closed and
  // every ticket they sent — deleting the row would blank the attribution on months of history.
  const { error } = await db()
    .from('staff')
    .update({ removed_at: new Date().toISOString(), removed_reason: input.reason, active: false, pin_hash: null })
    .eq('id', input.staffId);
  if (error) throw error;

  await audit({
    action: 'Staff',
    detail: `${person?.name ?? 'A member of staff'} removed — ${input.reason}. Their name stays on everything they did.`,
    actor: input.actor,
    confidential: true,
  });
}

export async function setOnDuty(input: { staffId: string; onDuty: boolean; actor: Actor }): Promise<void> {
  demand(input.actor, 'day.setup');
  const { data: person } = await db().from('staff').select('name').eq('id', input.staffId).maybeSingle();
  const { error } = await db().from('staff').update({ on_duty: input.onDuty }).eq('id', input.staffId);
  if (error) throw error;
  await audit({
    action: 'Day setup',
    detail: `${person?.name ?? 'Someone'} marked ${input.onDuty ? 'in' : 'out'} for today`,
    actor: input.actor,
  });
}

/* ── Settings ──────────────────────────────────────────────────────────── */

const SETTING_PERMISSION: Record<string, string> = {
  hours: 'set.hours',
  tax: 'set.tax',
  invoice: 'set.invoice',
  engagement: 'set.review',
  rescan: 'set.tables',
  tips: 'set.features',
  customerFeatures: 'set.features',
  copy: 'set.copy',
  replies: 'set.copy',
  day: 'day.setup',
  employment: 'set.identity',
};

export async function writeSetting(input: {
  key: string;
  value: Record<string, unknown>;
  actor: Actor;
}): Promise<void> {
  const permission = SETTING_PERMISSION[input.key] ?? 'set.identity';
  demand(input.actor, permission);
  const restaurantId = await currentRestaurantId();

  const { data: before } = await db()
    .from('setting')
    .select('value')
    .eq('restaurant_id', restaurantId)
    .eq('key', input.key)
    .maybeSingle();

  const merged = { ...((before?.value as Record<string, unknown>) ?? {}), ...input.value };
  const { error } = await db().from('setting').upsert(
    {
      restaurant_id: restaurantId,
      key: input.key,
      value: merged,
      updated_at: new Date().toISOString(),
      updated_by: input.actor.label,
    },
    { onConflict: 'restaurant_id,key' }
  );
  if (error) throw error;

  const changed = Object.keys(input.value)
    .filter(
      (k) => JSON.stringify(((before?.value as Record<string, unknown>) ?? {})[k]) !== JSON.stringify(input.value[k])
    )
    .slice(0, 6);

  await audit({
    action: 'Settings',
    detail: changed.length ? `${input.key}: ${changed.join(', ')} changed` : `${input.key} saved with no change`,
    actor: input.actor,
    confidential: input.key === 'tax',
  });
}

export async function writeIdentity(input: { patch: Record<string, unknown>; actor: Actor }): Promise<void> {
  demand(input.actor, 'set.identity');
  const restaurantId = await currentRestaurantId();
  const { error } = await db().from('restaurant').update(input.patch).eq('id', restaurantId);
  if (error) throw error;
  await audit({
    action: 'Settings',
    detail: `Restaurant details updated: ${Object.keys(input.patch).join(', ')}`,
    actor: input.actor,
  });
}

/* ── Expenses ──────────────────────────────────────────────────────────── */

export async function upsertExpense(input: {
  id?: string;
  spentOn: string;
  category: string;
  note: string;
  amount: number;
  reason?: string;
  actor: Actor;
}): Promise<void> {
  demand(input.actor, 'expense.manage');
  const restaurantId = await currentRestaurantId();

  if (input.id) {
    const { data: before } = await db().from('expense').select('amount,category').eq('id', input.id).maybeSingle();
    const { error } = await db()
      .from('expense')
      .update({
        spent_on: input.spentOn,
        category: input.category,
        note: input.note,
        amount: input.amount,
        change_reason: input.reason ?? '',
      })
      .eq('id', input.id);
    if (error) throw error;
    await audit({
      action: 'Expense',
      detail: `${input.category}: ${rupees(Number(before?.amount ?? 0))} → ${rupees(input.amount)}${input.reason ? ` — ${input.reason}` : ''}`,
      actor: input.actor,
    });
    return;
  }

  const { error } = await db().from('expense').insert({
    restaurant_id: restaurantId,
    spent_on: input.spentOn,
    category: input.category,
    note: input.note,
    amount: input.amount,
    entered_by: input.actor.label,
  });
  if (error) throw error;
  await audit({
    action: 'Expense',
    detail: `${input.category} ${rupees(input.amount)} — ${input.note}`,
    actor: input.actor,
  });
}

export async function deleteExpense(input: { id: string; reason: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'expense.manage');
  const { data: before } = await db().from('expense').select('category,amount').eq('id', input.id).maybeSingle();
  const { error } = await db()
    .from('expense')
    .update({ deleted_at: new Date().toISOString(), change_reason: input.reason })
    .eq('id', input.id);
  if (error) throw error;
  await audit({
    action: 'Expense',
    detail: `${before?.category ?? 'An entry'} ${rupees(Number(before?.amount ?? 0))} removed — ${input.reason}`,
    actor: input.actor,
  });
}

/* ── Tips ──────────────────────────────────────────────────────────────── */

export async function settleTips(input: { staffId: string; actor: Actor }): Promise<{ settled: number }> {
  demand(input.actor, 'tips.settle');
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('tip')
    .update({ settled_at: now, settled_by: input.actor.label })
    .eq('staff_id', input.staffId)
    .is('settled_at', null)
    .select('amount');
  if (error) throw error;

  const total = (data ?? []).reduce((a, t) => a + Number(t.amount), 0);
  const { data: person } = await db().from('staff').select('name').eq('id', input.staffId).maybeSingle();
  await audit({
    action: 'Tip settlement',
    detail: `${rupees(total)} settled to ${person?.name ?? 'a member of staff'} — staff money, never restaurant income`,
    actor: input.actor,
  });
  return { settled: total };
}

/* ── The entrance queue ────────────────────────────────────────────────── */

/**
 * A party joins the queue.
 *
 * THE TOKEN COMES FROM THE DATABASE, NOT FROM HERE
 *   `nextNumber('waitlist')` takes a row lock inside `next_number`, so two hosts adding a
 *   walk-in at the same moment cannot be handed the same W-. Generating it in TypeScript — a
 *   count, a timestamp, a max()+1 — is the version that works until the evening it matters.
 *
 * THE CODE IS FOUR DIGITS AND IT IS NOT A SECRET
 *   It exists so a party can claim their turn without spelling a surname across a busy room.
 *   Anyone standing at the door can hear it, which is fine: it buys nothing on its own. It is
 *   deliberately NOT derived from the id, so it cannot be guessed from a URL, and it is stored
 *   rather than recomputed, so the digits a guest was told are the digits they read back.
 */
export async function joinWaitlist(input: {
  partySize: number;
  pair: string;
  phone?: string;
  source?: 'scanned' | 'walk_in';
  actor: Actor;
}): Promise<{ token: string; code: string }> {
  demand(input.actor, 'queue.walkin');
  if (!Number.isInteger(input.partySize) || input.partySize < 1) {
    throw new Error('A party has at least one person in it.');
  }
  const restaurantId = await currentRestaurantId();
  const token = await nextNumber('waitlist');
  const code = String(Math.floor(1000 + Math.random() * 9000));

  const { error } = await db().from('waitlist_entry').insert({
    restaurant_id: restaurantId,
    token,
    code,
    pair: input.pair,
    party_size: input.partySize,
    phone: input.phone ?? '',
    source: input.source ?? 'walk_in',
    actor_label: input.actor.label,
  });
  if (error) throw error;

  await audit({
    action: 'Waitlist',
    detail: `${token} joined — ${input.partySize} ${input.partySize === 1 ? 'guest' : 'guests'}${
      input.pair ? ` · ${input.pair}` : ''
    }`,
    actor: input.actor,
  });
  return { token, code };
}

/**
 * The party has been called. Recorded rather than assumed: "we told them" is the fact a dispute
 * at the door turns on, and it is also what stops a second person calling them again.
 */
export async function notifyWaitlist(input: { id: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'queue.notify');
  const { data: row } = await db()
    .from('waitlist_entry')
    .select('token,party_size')
    .eq('id', input.id)
    .maybeSingle();

  const { error } = await db()
    .from('waitlist_entry')
    .update({ notified_at: new Date().toISOString(), actor_label: input.actor.label })
    .eq('id', input.id)
    .is('seated_at', null)
    .is('removed_at', null);
  if (error) throw error;

  await audit({
    action: 'Waitlist',
    detail: `${(row?.token as string) ?? 'A party'} called to the door`,
    actor: input.actor,
  });
}

/**
 * Seated. This stamps the queue row and NOTHING ELSE — it opens no bill and touches no table.
 *
 * Seating and opening a bill are two acts by two people at two moments: the host walks them to
 * a table, the captain takes the first order. There is exactly one way a bill is opened
 * (`ensureOpenBill`, which owns the one-open-bill-per-table rule), and a queue that could open
 * a second would eventually disagree with it about a table that already has a party on it.
 */
export async function seatWaitlist(input: { id: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'queue.seat');
  const { data: row } = await db().from('waitlist_entry').select('token').eq('id', input.id).maybeSingle();

  const { error } = await db()
    .from('waitlist_entry')
    .update({ seated_at: new Date().toISOString(), actor_label: input.actor.label })
    .eq('id', input.id)
    .is('seated_at', null)
    .is('removed_at', null);
  if (error) throw error;

  await audit({
    action: 'Waitlist',
    detail: `${(row?.token as string) ?? 'A party'} seated by ${input.actor.label}`,
    actor: input.actor,
  });
}

/** They left, or they were a duplicate. Kept and marked, never deleted — see the register rule. */
export async function removeFromWaitlist(input: { id: string; reason: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'queue.clear');
  const { data: row } = await db().from('waitlist_entry').select('token').eq('id', input.id).maybeSingle();

  const { error } = await db()
    .from('waitlist_entry')
    .update({
      removed_at: new Date().toISOString(),
      removed_reason: input.reason,
      actor_label: input.actor.label,
    })
    .eq('id', input.id)
    .is('seated_at', null)
    .is('removed_at', null);
  if (error) throw error;

  await audit({
    action: 'Waitlist',
    detail: `${(row?.token as string) ?? 'A party'} left the queue — ${input.reason}`,
    actor: input.actor,
  });
}
