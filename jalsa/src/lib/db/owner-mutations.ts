import 'server-only';
import { db, currentRestaurantId } from '@/lib/supabase/server';
import { PermissionDenied, ROLE_PRESETS } from '@/lib/permissions';
import { rupees } from '@/lib/money';
import { testPrintBlocker } from '@/lib/test-print';
import { audit, nextNumber, type Actor } from './mutations';
import { randomBytes } from 'node:crypto';
import { hashToken } from '@/lib/bridge-token';
import { formatPairingCode, hashPairingCode, newPairingCode, pairingExpiry } from '@/lib/bridge-pairing-code';

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

/**
 * Add a category, or hand back the one that already means this.
 *
 * WHY IT RETURNS THE ID (18-Sep-2026)
 *   It returned `void`, which was enough while the only caller was a settings form that
 *   re-read the console afterwards. The Add-item combobox cannot work that way: it has to
 *   SELECT the category it just created, in the same form, before the item is saved. A picker
 *   that creates a row and then cannot name it leaves the item pointing at nothing.
 *
 * WHY A DUPLICATE IS NOT AN ERROR
 *   `menu_category_name_unique` is on `(restaurant_id, lower(btrim(name)))`, so the database
 *   already decides that `Desserts`, `desserts` and ` Desserts ` are one category. Two people
 *   typing it in the same second is not a mistake either of them made, and neither is a second
 *   tap on a slow connection. On 23505 this re-reads and returns the existing id — the same
 *   insert-then-re-read idiom `ensureOpenBill` uses for two phones at one table.
 *
 *   The combobox's own exact-match guard hides the Add row when the name is already on screen.
 *   This is the guard for the case the screen could not see.
 */
export async function addCategory(input: { name: string; actor: Actor }): Promise<string> {
  demand(input.actor, 'menu.category');
  const restaurantId = await currentRestaurantId();
  const name = input.name.trim();
  // The same bounds the column's own check constraint states. Refused here so the person gets a
  // sentence rather than a constraint violation.
  if (name.length < 1 || name.length > 60) {
    throw new Error('A category name is between 1 and 60 characters.');
  }

  const { data, error } = await db()
    .from('menu_category')
    .insert({ restaurant_id: restaurantId, name })
    .select('id')
    .single();

  if (error) {
    if (error.code !== '23505') throw error;
    const existing = await db()
      .from('menu_category')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('name', name)
      .maybeSingle();
    if (existing.error) throw existing.error;
    const id = (existing.data?.id as string | undefined) ?? null;
    if (!id) throw error;
    // Not audited: nothing was added. An audit row saying "added" for a category that already
    // existed is a register telling the owner something untrue.
    return id;
  }

  await audit({ action: 'Menu category', detail: `${name} added`, actor: input.actor });
  return data.id as string;
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
  /* NOT A PIN SOMEONE ELSE ALREADY HOLDS (24-Sep list, G2). Sign-in looks a person up by PIN
     alone (`verify_staff_pin` ... limit 1), so two people with the same four digits sign in as
     whichever row Postgres returns first - and every round the second one places is recorded
     against the first. The server draws this PIN, so checking it reveals nothing to anyone. */
  const restaurantId = await currentRestaurantId();
  const heldByAnother = async (candidate: string): Promise<boolean> => {
    const { data, error } = await db().rpc('verify_staff_pin', { p_restaurant: restaurantId, p_pin: candidate });
    if (error) throw error;
    const row = (data as Array<{ id: string }> | null)?.[0];
    return !!row && row.id !== input.staffId;
  };
  let pin = '';
  for (let tries = 0; ; tries += 1) {
    pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    if (banned.has(pin)) continue;
    if (!(await heldByAnother(pin))) break;
    if (tries > 50) throw new Error('A free PIN could not be drawn. Try again.');
  }

  /* `p_provisional: true` (24-Sep list, F1). Without it the call named two arguments, which
     matched BOTH `set_staff_pin(uuid,text)` and `set_staff_pin(uuid,text,boolean)` on any
     database where 20260917120000 had not been applied - PostgREST refused it as ambiguous and
     Reissue PIN failed every time. Naming the third argument resolves to the one function that
     has it, and makes the issued PIN provisional: it opens "choose your own PIN" and nothing
     else (guardrail 5), as that migration's own note intended. */
  const { error } = await db().rpc('set_staff_pin', { p_staff: input.staffId, p_pin: pin, p_provisional: true });
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
  // Opening and closing the door queue is its own verb in the matrix, and it is not a
  // settings-page act: it is done at the door, mid-service, by whoever is standing there.
  queue: 'queue.close',
  employment: 'set.identity',
  // The two print templates, the food-type split and the fallback note. Everything on the
  // Print Setup surface that is not a machine is one key, because it is one screen's worth of
  // decisions and splitting it would mean four writes for one Save.
  print: 'set.printer',
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
export async function seatWaitlist(input: { id: string; tableId?: string; actor: Actor }): Promise<void> {
  demand(input.actor, 'queue.seat');
  const { data: row } = await db().from('waitlist_entry').select('token').eq('id', input.id).maybeSingle();

  // WHICH table, recorded. The guest's own screen (Customer Patterns 6c) reads "W-18 · 4 guests
  // · Table A4" — without the id the alert can only say "your table is ready" and leave a party
  // of four scanning a dining room. It records where the host SENT them; it still opens no bill.
  const { error } = await db()
    .from('waitlist_entry')
    .update({
      seated_at: new Date().toISOString(),
      actor_label: input.actor.label,
      ...(input.tableId ? { seated_table_id: input.tableId } : {}),
    })
    .eq('id', input.id)
    .is('seated_at', null)
    .is('removed_at', null);
  if (error) throw error;

  await audit({
    action: 'Waitlist',
    detail: `${(row?.token as string) ?? 'A party'} seated by ${input.actor.label}`,
    ...(input.tableId ? { tableId: input.tableId } : {}),
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

/* ── Printers ──────────────────────────────────────────────────────────── */

/**
 * Add or reconfigure one machine.
 *
 * WHY THE ROUTES ARE WRITTEN HERE AND NOT BY A SEPARATE "ROUTING" WRITE
 *   The design draws Printers and Routing as two sections, and they ARE two screens — but they
 *   edit one fact: which categories a machine claims. A second write path for the same column
 *   is the "two ways to do one thing" this repository treats as a defect, and the drifted one is
 *   always the one somebody finds first. The Routing section calls this with the categories
 *   changed and everything else unchanged.
 *
 * A DISABLED MACHINE IS NOT AN OFFLINE ONE. `enabled` is the owner's decision and is written
 * here; `online` is whether it answered and is never set from a form.
 */
export async function upsertPrinter(input: {
  id?: string;
  machineId: string;
  name: string;
  purpose: string;
  station: string;
  paperMm: number;
  connection: string;
  address: string;
  port: number;
  routes: string[];
  enabled: boolean;
  actor: Actor;
}): Promise<{ id: string }> {
  demand(input.actor, 'set.printer');
  const restaurantId = await currentRestaurantId();

  if (!input.name.trim()) throw new Error('Give the machine a name first — somebody has to find it in a kitchen.');
  if (input.connection !== 'USB' && !input.address.trim()) {
    throw new Error('A network machine needs an address, or nothing can reach it.');
  }

  const patch = {
    machine_id: input.machineId.trim(),
    name: input.name.trim(),
    purpose: input.purpose,
    station: input.station.trim() || 'Main Kitchen',
    paper_mm: input.paperMm,
    connection: input.connection,
    address: input.connection === 'USB' ? '' : input.address.trim(),
    port: input.connection === 'USB' ? 0 : input.port,
    routes: input.routes,
    enabled: input.enabled,
  };

  if (input.id) {
    const { data: before } = await db()
      .from('printer')
      .select('name,station,routes,enabled')
      .eq('id', input.id)
      .maybeSingle();

    const { error } = await db().from('printer').update(patch).eq('id', input.id);
    if (error) throw error;

    const wasEnabled = (before?.enabled as boolean | null) ?? true;
    const routesChanged = JSON.stringify((before?.routes as string[]) ?? []) !== JSON.stringify(input.routes);
    await audit({
      action: 'Settings',
      detail: routesChanged
        ? `${input.name} routing: ${((before?.routes as string[]) ?? []).join(', ') || 'nothing'} → ${
            input.routes.join(', ') || 'nothing'
          }`
        : wasEnabled !== input.enabled
          ? `${input.name} ${input.enabled ? 'enabled' : 'switched off — its tickets fall back to the main kitchen'}`
          : `${input.name} reconfigured`,
      actor: input.actor,
    });
    return { id: input.id };
  }

  const { data, error } = await db()
    .from('printer')
    .insert({ restaurant_id: restaurantId, online: false, ...patch })
    .select('id')
    .single();
  if (error) throw error;

  await audit({
    action: 'Settings',
    detail: `${input.name} added — ${input.paperMm} mm, ${input.station}, ${input.purpose} template`,
    actor: input.actor,
  });
  return { id: data.id as string };
}

/* ── The employment record ─────────────────────────────────────────────── */

/**
 * The fields the HR documents merge from.
 *
 * SEPARATE FROM `upsertStaff`, AND SEPARATELY PERMISSIONED
 *   `upsertStaff` edits who somebody is on the floor — name, role, mobile. This edits what they
 *   are paid, their PAN and the last four digits of their bank account. `staff.create` is held
 *   by anybody who may add a waiter; `staff.paperwork` is not, and the split is the whole reason
 *   this is a second function rather than six more arguments on the first.
 *
 * WHAT IS AUDITED, AND WHAT IS NOT PRINTED IN THE AUDIT
 *   A salary change is recorded with its before and after, because that is precisely the dispute
 *   an audit log exists to settle. PAN and the bank fragment are recorded as CHANGED and never
 *   quoted: an audit log that reprints an identity number is a second place that number lives,
 *   readable by everyone who can read the log.
 */
export async function writeEmployment(input: {
  staffId: string;
  patch: {
    employeeCode?: string;
    designation?: string;
    department?: string;
    joinedOn?: string | null;
    lastWorkingDay?: string | null;
    gender?: string;
    employmentType?: string;
    monthlySalary?: number | null;
    reportsTo?: string;
    shift?: string;
    email?: string;
    homeAddress?: string;
    pan?: string;
    uan?: string;
    bankLast4?: string;
  };
  actor: Actor;
}): Promise<void> {
  demand(input.actor, 'staff.paperwork');

  const p = input.patch;
  if (p.bankLast4 !== undefined && p.bankLast4 !== '' && !/^\d{4}$/.test(p.bankLast4)) {
    throw new Error('The bank field holds the last four digits only — never the whole number.');
  }

  const { data: before } = await db()
    .from('staff')
    .select('name,monthly_salary,designation,pan,bank_last4')
    .eq('id', input.staffId)
    .maybeSingle();

  const COLUMN: Record<string, string> = {
    employeeCode: 'employee_code',
    designation: 'designation',
    department: 'department',
    joinedOn: 'joined_on',
    lastWorkingDay: 'last_working_day',
    gender: 'gender',
    employmentType: 'employment_type',
    monthlySalary: 'monthly_salary',
    reportsTo: 'reports_to',
    shift: 'shift',
    email: 'email',
    homeAddress: 'home_address',
    pan: 'pan',
    uan: 'uan',
    bankLast4: 'bank_last4',
  };

  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(p)) {
    const column = COLUMN[key];
    if (!column || value === undefined) continue;
    // An empty date is NULL, not ''. A date column will not take a blank string, and a
    // last working day of '' would be a person recorded as having left on no day.
    row[column] = (key === 'joinedOn' || key === 'lastWorkingDay') && !value ? null : value;
  }
  if (Object.keys(row).length === 0) return;

  const { error } = await db().from('staff').update(row).eq('id', input.staffId);
  if (error) throw error;

  const who = (before?.name as string) ?? 'This employee';
  const salaryChanged =
    p.monthlySalary !== undefined && Number(before?.monthly_salary ?? -1) !== Number(p.monthlySalary ?? -1);
  const identityChanged =
    (p.pan !== undefined && p.pan !== ((before?.pan as string) ?? '')) ||
    (p.bankLast4 !== undefined && p.bankLast4 !== ((before?.bank_last4 as string) ?? ''));

  await audit({
    action: 'Staff',
    detail: salaryChanged
      ? `${who}: monthly salary ${rupees(Number(before?.monthly_salary ?? 0))} → ${rupees(Number(p.monthlySalary ?? 0))}`
      : identityChanged
        // Named, never quoted. The log records that it changed and who changed it; an audit
        // entry carrying a PAN is a second copy of it, readable by everyone who can read logs.
        ? `${who}: identity or bank details changed`
        : `${who}: employment record updated — ${Object.keys(p).join(', ')}`,
    actor: input.actor,
    confidential: true,
  });
}

/* ── Gate 6 · The printing system's own operations ─────────────────────── */

/**
 * Queue a test ticket for ONE machine.
 *
 * MERGED 22-Sep-2026. Two branches built this at once — `main` as a diagnostic for a deployment
 * with no print service, and Gate 6 as a job the bridge actually carries. What survives is the
 * union: `main`'s shared pre-flight and its non-throwing return shape, Gate 6's snapshot columns
 * and the audit line, and one function rather than two.
 *
 * IT IS AN ORDINARY PRINT JOB, AND THAT IS THE WHOLE DESIGN.
 *   The tempting shape is a small function that opens the printer and writes "Hello". It would
 *   work, and it would prove almost nothing: not the claim, not the composition, not the encoder,
 *   not the transport, not the report. Then a real ticket would fail later and the successful test
 *   would be evidence for the wrong thing.
 *
 *   So this inserts a row into `print_job` and stops. Everything after it — the bridge listing it,
 *   claiming it, composing it through `buildTicket`, encoding it through `escpos.ts`, carrying it
 *   through whichever transport that PC has, and reporting the outcome — is the path a real
 *   kitchen ticket takes, unchanged. The payload is the only difference (`test-ticket.ts`).
 *
 * WHY IT DOES NOT CALL `queuePrint` (kept from `main`, and still exactly right)
 *   `queuePrint` is the ROUTING path: it asks which machine should receive a round's ticket given
 *   its categories. That is the wrong question here. A test is aimed at a machine the owner has
 *   pointed at — routing must not be consulted, must not be able to redirect it, and must not be
 *   changed by it. The printer id travels from the button to this row with nothing in between
 *   able to reinterpret it.
 *
 * WHY THERE IS NO FAKE BILL (kept from `main`)
 *   `print_job.bill_id` and `print_job.kot_id` are both nullable. A test job belongs to neither,
 *   and the schema has always allowed that — so "do not create a fake order" is not a constraint
 *   to work around, it is the natural shape of the row.
 *
 * WHY THE STATUS IS `queued` AND NEVER `printed`
 *   The same rule the whole of Phase 1 turned on: `printed` is a claim about paper, and only a
 *   bridge that carried the bytes may make it. This function writes `queued`, which is what
 *   actually happened — a job exists, against this machine, waiting to be collected.
 *
 * `routing_rule: 'chosen'` because a person picked the machine. That is not a routing outcome and
 * must not be mistakable for one — the same reasoning `printElsewhere` already records.
 */
export async function testPrint(input: { printerId: string; actor: Actor }): Promise<{
  queued: boolean;
  /** Null when nothing was queued. */
  jobId: string | null;
  printerName: string;
  station: string;
  /** Empty when it was queued; otherwise why it was not. */
  reason: string;
}> {
  // The same grant that gates Configure and Add a printer on the tab this button lives on.
  // Nothing is broadened: an actor who may not configure printers may not test them.
  demand(input.actor, 'set.printer');
  const restaurantId = await currentRestaurantId();

  /* Scoped by restaurant AND by id. The id alone would let a crafted request test a machine in
     another restaurant, which is the one thing a diagnostic must never do. */
  const { data: printer, error } = await db()
    .from('printer')
    .select('id,machine_id,name,station,paper_mm,connection,address,enabled')
    .eq('restaurant_id', restaurantId)
    .eq('id', input.printerId)
    .maybeSingle();
  if (error) throw error;
  if (!printer) throw new Error('That printer is no longer configured. Reload the page.');

  const name = printer.name as string;
  const station = (printer.station as string) ?? '';

  /* ONE definition of "is this machine testable", shared with the button. Two copies would
     eventually disagree, and the disagreement would be a button that does nothing. Returned
     rather than thrown, so the screen can say WHICH machine and WHY without parsing an error. */
  const { data: viaComputer } = await db()
    .from('bridge_printer')
    .select('printer_id')
    .eq('printer_id', printer.id as string)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  const blocker = testPrintBlocker({
    enabled: (printer.enabled as boolean | null) ?? true,
    connection: (printer.connection as string) ?? '',
    address: (printer.address as string) ?? '',
    throughComputer: !!viaComputer,
  });
  if (blocker) return { queued: false, jobId: null, printerName: name, station, reason: blocker };

  /* ONE row, against ONE printer, with no bill and no round. Nothing else in the database is
     touched: not the printer row, not its routes, not a kot, not a bill. */
  const { data: job, error: jobErr } = await db()
    .from('print_job')
    .insert({
      restaurant_id: restaurantId,
      printer_id: printer.id as string,
      // Snapshots, in the idiom every other job uses. `station` is load-bearing here and not
      // decoration: `bridge-payload` matches a test job to its machine by it, and a row without
      // one composes to nothing at all.
      printer_name: name,
      station,
      routing_rule: 'chosen',
      food_side: 'all',
      kind: 'Test',
      kot_id: null,
      bill_id: null,
      status: 'queued',
      attempts: 0,
      is_reprint: false,
      requested_by: input.actor.label,
      last_error: '',
      completed_at: null,
    })
    .select('id')
    .single();
  if (jobErr) throw jobErr;

  /* Audited as an ADMINISTRATIVE act, with no bill and no table — because a test print is not a
     business transaction and must not appear as one. */
  await audit({
    // `Printer`, not `Reprint` — kept from `main` at the merge, and it is the better call: a
    // diagnostic filed among the night's reprints would read as trade that never happened.
    action: 'Printer',
    detail: `Test ticket queued for ${name} (${printer.machine_id as string})`,
    actor: input.actor,
  });

  return { queued: true, jobId: job.id as string, printerName: name, station, reason: '' };
}


/**
 * Issue a bridge token, and hand it back exactly once.
 *
 * WHAT IS STORED IS A HASH, AND THAT IS NOT A DETAIL
 *   `bridge_token.token_hash` is the SHA-256; the token itself is never written anywhere. A dump
 *   of the table yields no working credential, and revocation is a timestamp rather than a
 *   redeploy. The cost is that a lost token cannot be recovered — only replaced — and that is the
 *   right trade for a credential that lives in a text file on a PC in a kitchen.
 *
 * THE RETURN VALUE IS THE ONLY TIME IT EXISTS. Callers must show it and move on; it is never read
 * back, never logged, and never in an audit line.
 */
export async function issueBridgeToken(input: { label: string; actor: Actor }): Promise<{
  id: string;
  label: string;
  /** Shown once. There is no second chance to read this. */
  token: string;
}> {
  demand(input.actor, 'set.printer');
  const restaurantId = await currentRestaurantId();

  const label = input.label.trim();
  if (!label) throw new Error('Give the PC a name first — it is what appears on the job history.');
  if (label.length > 60) throw new Error('That name is too long for the job history. Keep it under 60 characters.');

  // 32 bytes of CSPRNG. The `jbt_` prefix is so a token found in a file is recognisable for what
  // it is, the way Supabase's own key prefixes work.
  const token = `jbt_${randomBytes(32).toString('hex')}`;

  const { data, error } = await db()
    .from('bridge_token')
    .insert({ restaurant_id: restaurantId, label, token_hash: hashToken(token) })
    .select('id,label')
    .single();
  if (error) throw error;

  await audit({
    action: 'Set permissions',
    // The label, never the token, and never a prefix of it.
    detail: `Bridge token issued for ${label}`,
    actor: input.actor,
    confidential: true,
  });

  return { id: data.id as string, label: data.label as string, token };
}

/**
 * Stop a bridge token working.
 *
 * A timestamp, not a delete: the job history says which PC carried which ticket, and a revoked
 * token's label still has to resolve. Registers are append-only and this is one.
 */
export async function revokeBridgeToken(input: { tokenId: string; actor: Actor }): Promise<{ label: string }> {
  demand(input.actor, 'set.printer');
  const restaurantId = await currentRestaurantId();

  const { data, error } = await db()
    .from('bridge_token')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', input.tokenId)
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .select('label')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('That bridge token is already revoked, or is not one of this restaurant’s.');

  await audit({
    action: 'Set permissions',
    detail: `Bridge token revoked for ${data.label as string}`,
    actor: input.actor,
    confidential: true,
  });

  return { label: data.label as string };
}

/* ── Printing computers: pairing and printer mapping (20260923090000) ─── */

/**
 * A pairing code for the computer the owner is about to set up.
 *
 * THE CODE, LIKE THE TOKEN, EXISTS ONCE. Only its hash is stored; the return value is the only
 * copy, shown in the sheet that asked for it. Asking again spends every unused code this
 * restaurant still has, so at most one code is ever live — a photographed code is useless once
 * the owner has moved on, and an attacker gets exactly one ten-minute target, not a pile of them.
 */
export async function issuePairingCode(input: { label: string; actor: Actor }): Promise<{
  code: string;
  label: string;
  expiresAt: string;
}> {
  demand(input.actor, 'set.printer');
  const restaurantId = await currentRestaurantId();

  const label = input.label.trim();
  if (!label) throw new Error('Give the computer a name first — it is how you will find it in Jalsa.');
  if (label.length > 60) throw new Error('That name is too long. Keep it under 60 characters.');

  // A HAND-ISSUED token under the same name would share `claimed_by` with the new computer, and a
  // report is matched on it. A PAIRED one is replaced on redemption (the reinstall case).
  const { data: clash } = await db()
    .from('bridge_token')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('label', label)
    .eq('source', 'manual')
    .is('revoked_at', null)
    .limit(1);
  if ((clash ?? []).length) {
    throw new Error(`A computer called ${label} is already set up by hand. Use a different name, or revoke it under Print setup → Bridges.`);
  }

  const now = new Date();
  // Spend, never delete: the history of who asked for a code, and when, survives.
  await db()
    .from('bridge_pairing_code')
    .update({ used_at: now.toISOString() })
    .eq('restaurant_id', restaurantId)
    .is('used_at', null);

  const code = newPairingCode();
  const expiresAt = pairingExpiry(now);
  const { error } = await db().from('bridge_pairing_code').insert({
    restaurant_id: restaurantId,
    code_hash: hashPairingCode(code),
    label,
    created_by: input.actor.label,
    expires_at: expiresAt,
  });
  if (error) throw error;

  await audit({
    action: 'Printer',
    // The name, never the code.
    detail: `Pairing code issued for ${label}`,
    actor: input.actor,
    confidential: true,
  });

  return { code: formatPairingCode(code), label, expiresAt };
}

/** A new Jalsa printer's machine id, from the name the owner gave it. Unique per restaurant. */
function machineIdFor(name: string, taken: ReadonlySet<string>): string {
  const base = `PC-${name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'PRINTER'}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * The owner chose a printer this computer found, and said what Jalsa should use it for.
 *
 * WHAT THE OWNER NEVER TYPES: the Windows queue name. `queueName` must be one the bridge itself
 * reported in `bridge_discovered_printer` for THIS computer — the screen offers only those, and
 * this function refuses anything else, so a crafted request cannot point a printer at a string
 * nobody's Windows produced.
 *
 * WHAT STAYS JALSA'S: the printer's identity, its station and its routes. Mapping to an existing
 * Jalsa printer keeps every one of them; creating one uses the station chosen here. The only
 * PC-specific fact — the queue — goes in `bridge_printer`, never on `printer`.
 *
 * Restaurant-scoped on every read: the computer, the discovered queue and the printer must all be
 * this restaurant's, so Restaurant A cannot map a printer onto Restaurant B's computer.
 */
export async function savePrinterMapping(input: {
  computerId: string;
  queueName: string;
  target: { printerId: string } | { name: string; station: string; paperMm: number; purpose: string };
  actor: Actor;
}): Promise<{ printerId: string }> {
  demand(input.actor, 'set.printer');
  const restaurantId = await currentRestaurantId();

  const { data: computer } = await db()
    .from('bridge_token')
    .select('id,label')
    .eq('id', input.computerId)
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .maybeSingle();
  if (!computer) throw new Error('That computer is no longer connected to this restaurant. Reload the page.');

  const { data: found } = await db()
    .from('bridge_discovered_printer')
    .select('queue_name,port_name')
    .eq('bridge_token_id', input.computerId)
    .eq('restaurant_id', restaurantId)
    .eq('queue_name', input.queueName)
    .maybeSingle();
  if (!found) throw new Error('That printer is no longer on this computer. Check it is plugged in, then look again.');

  const viaUsb = ((found.port_name as string) ?? '').toUpperCase().startsWith('USB');
  let printerId: string;
  let printerName: string;

  if ('printerId' in input.target) {
    const { data: printer } = await db()
      .from('printer')
      .select('id,name')
      .eq('id', input.target.printerId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!printer) throw new Error('That printer is no longer configured. Reload the page.');
    printerId = printer.id as string;
    printerName = printer.name as string;
    // Its routes, station and paper stay exactly as the owner configured them. Only how it is
    // reached changes, and only when Windows says it is on USB.
    if (viaUsb) await db().from('printer').update({ connection: 'USB', address: '', port: 0 }).eq('id', printerId);
  } else {
    const name = input.target.name.trim();
    if (!name) throw new Error('Give the printer a name first — somebody has to find it in a kitchen.');
    const { data: existing } = await db().from('printer').select('machine_id').eq('restaurant_id', restaurantId);
    const taken = new Set((existing ?? []).map((p) => p.machine_id as string));
    const { data: created, error } = await db()
      .from('printer')
      .insert({
        restaurant_id: restaurantId,
        machine_id: machineIdFor(name, taken),
        name,
        purpose: input.target.purpose === 'Invoice' ? 'Invoice' : 'KOT',
        station: input.target.station.trim() || 'Main Kitchen',
        paper_mm: input.target.paperMm === 58 ? 58 : 80,
        // Reached through this computer, whatever the cable: no address of its own, and no
        // network port — `online: false` is what satisfies `printer_address_when_networked`.
        connection: viaUsb ? 'USB' : 'Ethernet',
        address: '',
        port: 0,
        routes: [],
        enabled: true,
        online: false,
      })
      .select('id')
      .single();
    if (error) throw error;
    printerId = created.id as string;
    printerName = name;
  }

  // ONE COMPUTER PER PRINTER. Moving it to this computer replaces the old mapping.
  const { error: mapErr } = await db()
    .from('bridge_printer')
    .upsert(
      {
        bridge_token_id: input.computerId,
        printer_id: printerId,
        restaurant_id: restaurantId,
        queue_name: input.queueName,
        created_by: input.actor.label,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'printer_id' }
    );
  if (mapErr) throw mapErr;

  await audit({
    action: 'Printer',
    detail: `${printerName} connected through ${computer.label as string}`,
    actor: input.actor,
  });

  return { printerId };
}

/** Take a printer off its computer. The Jalsa printer, its routes and its history stay. */
export async function removePrinterMapping(input: { printerId: string; actor: Actor }): Promise<{ done: true }> {
  demand(input.actor, 'set.printer');
  const restaurantId = await currentRestaurantId();
  const { data, error } = await db()
    .from('bridge_printer')
    .delete()
    .eq('printer_id', input.printerId)
    .eq('restaurant_id', restaurantId)
    .select('printer_id');
  if (error) throw error;
  if (!(data ?? []).length) throw new Error('That printer was not connected to a computer.');

  await audit({ action: 'Printer', detail: 'A printer was disconnected from its computer', actor: input.actor });
  return { done: true };
}
