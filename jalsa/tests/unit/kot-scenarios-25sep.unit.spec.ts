import { test, expect } from '@playwright/test';
import { splitRound, type RoutablePrinter } from '../../src/lib/print-routing';
import { buildTicket, defaultTemplate, type TemplateConfig } from '../../src/lib/print-template';
import { effectiveTemplate } from '../../src/lib/invoice';
import { KOT_SOURCE_LABEL } from '../../src/lib/status';
import { composeTicket, type ComposeItem } from '../../src/lib/ticket-compose';

/**
 * KOT test cases 15-22 (25-Sep correction list), run end to end through the production path:
 * `splitRound` decides the tickets exactly as `queuePrint` does, and `composeTicket` lays each one
 * out exactly as the bridge payload does. With the settings Jalsa runs today: the veg / non-veg
 * split ON, egg travelling with veg, and the KOT template as the owner has it after item 13.
 *
 * WHAT EACH CASE CHECKS: the right items on each ticket and nowhere else (none missing, none
 * doubled), the right machine and station, the order the items were ordered in, no phone number
 * or address, the order source in words, and that the preview path (`buildTicket` over
 * `effectiveTemplate`) gives the same lines as the print path.
 *
 * WHAT IT CANNOT CHECK: paper. These are the lines and routing a printer is handed; that the TVS
 * prints them is physical verification, pending.
 */

const P = (o: Partial<RoutablePrinter> & { id: string; machineId: string; station: string }): RoutablePrinter => ({
  name: o.machineId,
  purpose: 'KOT',
  routes: [],
  online: false,
  enabled: true,
  ...o,
});
// Kitchen as configured: the tandoor claims its categories; everything else is the main kitchen.
const MAIN = P({ id: 'main', machineId: 'KOT-MAIN', station: 'Main Kitchen' });
const TANDOOR = P({ id: 'tan', machineId: 'KOT-TANDOOR', station: 'Tandoor', routes: ['Veg Starters', 'Non-Veg Starters'] });
const PRINTERS = [MAIN, TANDOOR];

const I = (name: string, foodType: ComposeItem['foodType'], category: string, qty = 1): ComposeItem => ({
  name,
  qty,
  foodType,
  rate: 0,
  category,
  instruction: '',
});
const PANEER = I('Paneer Tikka', 'veg', 'Veg Starters', 2);
const DAL = I('Dal Makhani', 'veg', 'Veg Mains');
const NAAN = I('Butter Naan', 'veg', 'Breads', 4);
const CHICKEN65 = I('Chicken 65', 'non_veg', 'Non-Veg Starters');
const BUTTER_CHICKEN = I('Butter Chicken', 'non_veg', 'Non-Veg Mains');
const EGG_CURRY = I('Egg Curry', 'egg', 'Egg');
const EGG_BHURJI = I('Egg Bhurji', 'egg', 'Egg', 2);

const RESTAURANT_PHONE = '04344 000000';
const RESTAURANT_ADDRESS = 'Bagalur Road, Hosur';

// The live KOT template as the owner has it (read from the database on 25-Sep), with item 13
// applied: phone and branch OFF.
const LIVE_KOT: Partial<TemplateConfig> = {
  ...defaultTemplate('kot'),
  on: { ...defaultTemplate('kot').on, phone: false, branch: false, captain: true, source: false },
  modes: { phone: 'off', branch: 'off' },
};

function kitchen(items: ComposeItem[], source: 'captain' | 'guest', width: '58' | '80' = '80') {
  const tickets = splitRound({ items, printers: PRINTERS, splitByFoodType: true });
  return tickets.map((t) => {
    const header = {
      restaurant: 'JALSA',
      branch: RESTAURANT_ADDRESS,
      phone: RESTAURANT_PHONE,
      gstin: '—',
      kotCode: 'KOT-120',
      roundCode: 'R-1',
      billCode: 'B-1050',
      table: 'A5',
      customer: '',
      captain: source === 'captain' ? 'Ravi' : 'Guest phone',
      date: '25 Sep 2026',
      time: '1:05 pm',
      source: KOT_SOURCE_LABEL[source],
      note: '',
    };
    const job = { id: 'j', kind: 'kot' as const, printerId: t.printerId, station: t.station, foodSide: t.side, isReprint: false };
    const printed = composeTicket({ job, width, template: LIVE_KOT, printers: PRINTERS, splitByFoodType: true, header, items });
    if (!printed.ok) throw new Error(printed.blocked);
    const texts = printed.lines.map((l) => l.text);
    const onTicket = items.filter((i) => texts.some((x) => x.startsWith(i.name)));
    // Preview path: the same data through buildTicket over the one merged template.
    const previewed = buildTicket(
      'kot',
      { ...header, station: t.station, items: onTicket },
      effectiveTemplate('kot', width, LIVE_KOT),
      { reprint: false }
    );
    return { ticket: t, texts, onTicket, previewSame: JSON.stringify(previewed) === JSON.stringify(printed.lines) };
  });
}

function common(items: ComposeItem[], source: 'captain' | 'guest') {
  const out = kitchen(items, source);
  const all = out.flatMap((o) => o.onTicket.map((i) => i.name));
  // No missing, no duplicate.
  expect([...all].sort()).toEqual(items.map((i) => i.name).sort());
  for (const o of out) {
    // Order preserved within each ticket.
    const idx = o.onTicket.map((i) => items.indexOf(i));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    // No phone, no address.
    expect(o.texts.join('\n')).not.toContain(RESTAURANT_PHONE);
    expect(o.texts.join('\n')).not.toContain(RESTAURANT_ADDRESS);
    // The source, in words.
    expect(o.texts.some((t) => t.startsWith('SOURCE') && t.endsWith(KOT_SOURCE_LABEL[source]))).toBe(true);
    // Preview equals print.
    expect(o.previewSame).toBe(true);
  }
  return out;
}

const where = (out: ReturnType<typeof kitchen>, name: string): string => {
  const o = out.find((x) => x.onTicket.some((i) => i.name === name));
  return o ? `${o.ticket.printerId}|${o.ticket.station}|${o.ticket.side}` : 'nowhere';
};

test('15 · only veg: one veg-side ticket per station, no non-veg anywhere', () => {
  const out = common([PANEER, DAL, NAAN], 'captain');
  expect(out.every((o) => o.ticket.side === 'veg_side')).toBe(true);
  expect(out.every((o) => !o.texts.some((t) => t.includes('NON-VEG')))).toBe(true);
  expect(where(out, 'Paneer Tikka')).toBe('tan|Tandoor|veg_side');
  expect(where(out, 'Dal Makhani')).toBe('main|Main Kitchen|veg_side');
});

test('16 · only non-veg: non-veg tickets only, at the right stations', () => {
  const out = common([CHICKEN65, BUTTER_CHICKEN], 'captain');
  expect(out.every((o) => o.ticket.side === 'non_veg')).toBe(true);
  expect(out.every((o) => o.onTicket.every((i) => i.foodType === 'non_veg'))).toBe(true);
  expect(where(out, 'Chicken 65')).toBe('tan|Tandoor|non_veg');
  expect(where(out, 'Butter Chicken')).toBe('main|Main Kitchen|non_veg');
});

test('17 · egg + veg: both on the veg side, no non-veg ticket', () => {
  const out = common([DAL, EGG_CURRY, NAAN], 'captain');
  expect(out.some((o) => o.ticket.side === 'non_veg')).toBe(false);
  expect(where(out, 'Egg Curry')).toBe('main|Main Kitchen|veg_side');
  const main = out.find((o) => o.ticket.printerId === 'main')!;
  expect(main.onTicket.map((i) => i.name)).toEqual(['Dal Makhani', 'Egg Curry', 'Butter Naan']);
  expect(main.texts.some((t) => t.includes(' EGG '))).toBe(true);
});

test('18 · egg + non-veg: egg on the veg-side ticket, non-veg on its own, no veg dish anywhere', () => {
  const out = common([EGG_BHURJI, BUTTER_CHICKEN], 'captain');
  expect(where(out, 'Egg Bhurji')).toBe('main|Main Kitchen|veg_side');
  expect(where(out, 'Butter Chicken')).toBe('main|Main Kitchen|non_veg');
  expect(out.flatMap((o) => o.onTicket).some((i) => i.foodType === 'veg')).toBe(false);
});

test('19 · only egg: one ticket, egg items only, at the main kitchen', () => {
  const out = common([EGG_CURRY, EGG_BHURJI], 'captain');
  expect(out).toHaveLength(1);
  expect(out[0]!.ticket.printerId).toBe('main');
  expect(out[0]!.onTicket.every((i) => i.foodType === 'egg')).toBe(true);
  expect(out[0]!.texts.some((t) => t.includes(' VEG ') && !t.includes('NON'))).toBe(false);
});

test('20 · veg + non-veg: each dish on exactly one ticket, the right one', () => {
  const items = [PANEER, CHICKEN65, DAL, BUTTER_CHICKEN, NAAN];
  const out = common(items, 'captain');
  expect(out.map((o) => `${o.ticket.printerId}|${o.ticket.side}`).sort()).toEqual([
    'main|non_veg',
    'main|veg_side',
    'tan|non_veg',
    'tan|veg_side',
  ]);
  expect(where(out, 'Paneer Tikka')).toBe('tan|Tandoor|veg_side');
  expect(where(out, 'Chicken 65')).toBe('tan|Tandoor|non_veg');
  expect(where(out, 'Butter Naan')).toBe('main|Main Kitchen|veg_side');
});

test('21 · from the captain: the same routing, and the ticket says Captain', () => {
  const items = [PANEER, CHICKEN65, EGG_CURRY];
  const out = common(items, 'captain');
  expect(out.every((o) => o.texts.some((t) => t.startsWith('SOURCE') && t.endsWith('Captain')))).toBe(true);
});

test('22 · from a guest phone: routed exactly as the captain would be, says Guest phone, prints no phone number', () => {
  const items = [PANEER, CHICKEN65, EGG_CURRY];
  const guest = common(items, 'guest');
  const captain = kitchen(items, 'captain');
  const key = (o: (typeof guest)[number]) => `${o.ticket.printerId}|${o.ticket.station}|${o.ticket.side}|${o.onTicket.map((i) => i.name).join(',')}`;
  expect(guest.map(key).sort()).toEqual(captain.map(key).sort());
  for (const o of guest) {
    expect(o.texts.some((t) => t.startsWith('SOURCE') && t.endsWith('Guest phone'))).toBe(true);
    expect(o.texts.some((t) => /\d{5}\s?\d{5,6}/.test(t))).toBe(false);
  }
});

test('15-22 on 58 mm paper too: every line fits, big lines at half width', () => {
  for (const o of kitchen([PANEER, CHICKEN65, DAL, EGG_CURRY, BUTTER_CHICKEN], 'guest', '58')) {
    for (const t of o.texts) expect(t.length).toBeLessThanOrEqual(32);
  }
});
