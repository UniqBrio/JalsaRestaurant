import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { IMAGE_MESSAGES, MAX_IMAGE_BYTES, imageProblem, isMediaUrl, sniffImage } from '../../src/lib/media';
import { defaultPrinter, routeItem, splitRound, stationOptions, type RoutablePrinter } from '../../src/lib/print-routing';

/**
 * Menu and routing - 25-Sep correction list, items 23-30, executed.
 */

const code = (p: string): string => readFileSync(p, 'utf8');

const P = (o: Partial<RoutablePrinter> & { id: string; machineId: string; station: string }): RoutablePrinter => ({
  name: o.machineId,
  purpose: 'KOT',
  routes: [],
  online: false,
  enabled: true,
  ...o,
});
const MAIN = P({ id: 'main', machineId: 'A-MAIN', station: 'Main Kitchen' });
const TANDOOR = P({ id: 'tan', machineId: 'B-TANDOOR', station: 'Tandoor', routes: ['Tandoor'] });
const BAR = P({ id: 'bar', machineId: 'C-BAR', station: 'Bar' });
const PRINTERS = [MAIN, TANDOOR, BAR];

/* ── Item 23: the image ─────────────────────────────────────────────────── */

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

test('item 23: PNG and JPEG are accepted by their own bytes; anything else is refused with the reason', () => {
  expect(sniffImage(PNG)).toBe('png');
  expect(sniffImage(JPEG)).toBe('jpeg');
  expect(sniffImage(PDF)).toBeNull();
  expect(imageProblem(PNG)).toBeNull();
  expect(imageProblem(JPEG)).toBeNull();
  expect(imageProblem(PDF)).toBe(IMAGE_MESSAGES.wrongType);
  expect(imageProblem(new Uint8Array(0))).toBe(IMAGE_MESSAGES.empty);
});

test('item 23: 1 MB is allowed, one byte more is refused, and the message says the size', () => {
  const exactly = new Uint8Array(MAX_IMAGE_BYTES);
  exactly.set(PNG);
  expect(imageProblem(exactly)).toBeNull();
  const over = new Uint8Array(MAX_IMAGE_BYTES + 1);
  over.set(PNG);
  expect(imageProblem(over)).toBe('That image is 1.0 MB. Choose a PNG or JPEG of 1 MB or less.');
  const big = new Uint8Array(3 * 1024 * 1024);
  big.set(JPEG);
  expect(imageProblem(big)).toContain('3.0 MB');
});

test('item 23: the server checks the bytes again, stores a fresh name, and only its own URLs are saved', () => {
  const m = code('src/lib/db/owner-mutations.ts');
  const upload = m.slice(m.indexOf('export async function uploadImage'));
  expect(upload).toContain('const problem = imageProblem(bytes);');
  expect(upload).toContain('randomUUID()');
  expect(upload).toContain("db().storage.from('media').upload(key, bytes");
  expect(m).toContain("!isMediaUrl(input.imageUrl)");
  expect(isMediaUrl('/api/media/menu/0b3c5a0e-8f0a-4a8e-9f0f-1234567890ab.png')).toBe(true);
  expect(isMediaUrl('https://evil.example/x.png')).toBe(false);
  expect(isMediaUrl('/api/media/menu/../../secret.png')).toBe(false);
  // The bucket, its limits, and the route that serves it.
  const mig = code('supabase/migrations/20260925100000_jalsa_item_routing_and_media.sql');
  expect(mig).toContain("values ('media', 'media', false, 1048576, array['image/png', 'image/jpeg'])");
  expect(code('src/app/api/media/[...path]/route.ts')).toContain('if (!MEDIA_URL.test(`/api/media/${key}`)) return new NextResponse');
});

test('item 23: the photo is chosen in Add Item, shown on the menu and in the guest tile', () => {
  expect(code('src/features/owner/sections/MenuSection.tsx')).toContain('testId="owner-item-image"');
  expect(code('src/components/ui/image-picker.tsx')).toContain('accept="image/png,image/jpeg"');
  expect(code('src/features/guest/GuestOrdering.tsx')).toContain('src={item.imageUrl}');
});

/* ── Item 24: food type like category ──────────────────────────────────── */

test('item 24: food type is a searchable picker like Category, over the three types the kitchen splits on', () => {
  const s = code('src/features/owner/sections/MenuSection.tsx');
  const block = s.slice(s.indexOf('id="owner-item-type"') - 200, s.indexOf('placeholder="Search food type"'));
  expect(block).toContain('<Combobox');
  expect(block).toContain('options={FOOD_TYPES.map((t) => ({ value: t, label: FOOD_TYPE[t].label }))}');
  expect(block).not.toContain('allowCreate');
});

/* ── Items 25, 26: a dish's own printer and station ───────────────────── */

test('item 25: a dish with its own printer prints there, whatever its category says', () => {
  const d = routeItem({ category: 'Tandoor', route: { printerId: 'bar', station: null }, printers: PRINTERS });
  expect(d.printer?.id).toBe('bar');
  expect(d.station).toBe('Bar');
  expect(d.rule).toBe('routed');
});

test('item 25: its printer switched off - the default printer takes it, marked with the station it was meant for', () => {
  const d = routeItem({ category: 'Tandoor', route: { printerId: 'bar', station: null }, printers: [MAIN, TANDOOR, { ...BAR, enabled: false }] });
  expect(d.printer?.id).toBe('main');
  expect(d.station).toBe('Bar');
  expect(d.rule).toBe('fallback');
});

test('item 25: no printer at all is said plainly, never a crash', () => {
  const d = routeItem({ category: 'Tandoor', route: { printerId: 'bar', station: null }, printers: [] });
  expect(d.printer).toBeNull();
  expect(d.rule).toBe('none');
  expect(code('src/features/owner/sections/MenuSection.tsx')).toContain('No kitchen printer is set up yet');
});

test('item 26: a dish with its own station goes to the printer at that station', () => {
  const d = routeItem({ category: 'Starters', route: { printerId: null, station: 'Tandoor' }, printers: PRINTERS });
  expect(d.printer?.id).toBe('tan');
  expect(d.station).toBe('Tandoor');
  const none = routeItem({ category: 'Starters', route: { printerId: null, station: 'Grill' }, printers: PRINTERS });
  expect(none.printer?.id).toBe('main');
  expect(none.station).toBe('Grill');
});

test('items 25-26: the choice is snapshot on the line when the round is placed, and the kitchen ticket reads the snapshot', () => {
  const m = code('src/lib/db/mutations.ts');
  expect(m).toContain('route_printer_id: routes[i]?.printerId ?? null,');
  expect(m).toContain('route_station: routes[i]?.station ?? null,');
  expect(m).toContain(".select('menu_category_name,food_type,cancelled_at,route_printer_id,route_station')");
  expect(code('src/lib/db/bridge-payload.ts')).toContain('route_printer_id,route_station');
  // splitRound and the composer read the same `routeItem`, so the ticket finds its lines.
  expect(code('src/lib/print-routing.ts')).toContain('const decision = routeItem({ category: item.category, route: item.route ?? null, printers: input.printers });');
  expect(code('src/lib/ticket-compose.ts')).toContain('const decision = routeItem({ category: item.category, route: item.route ?? null, printers });');
});

test('item 26: a dish routed by station splits onto its own ticket', () => {
  const tickets = splitRound({
    items: [
      { category: 'Starters', foodType: 'veg', route: { printerId: null, station: 'Tandoor' } },
      { category: 'Starters', foodType: 'veg', route: null },
    ],
    printers: PRINTERS,
    splitByFoodType: false,
  });
  expect(tickets.map((t) => `${t.printerId}|${t.station}|${t.count}`).sort()).toEqual(['main|Main Kitchen|1', 'tan|Tandoor|1']);
});

/* ── Items 27, 28: the column header and the table ─────────────────────── */

test('item 27: the header sets STATION ONLY for every dish, after a confirmation that says so', () => {
  const s = code('src/features/owner/sections/PrintSetupSection.tsx');
  expect(s).toContain('testId="owner-print-station-all"');
  expect(s).toContain('testId="owner-print-station-all-confirm"');
  expect(s).toContain('Their\n            printers stay as they are.');
  // Updated 25-Sep-2026 (code review): "all" is one update by restaurant, not an id list the
  // size of the menu in a URL.
  expect(s).toMatch(/\[\],\s*\{ station: station \|\| null, all: true \}/);
  const m = code('src/lib/db/owner-mutations.ts');
  const fn = m.slice(m.indexOf('export async function setItemRouting'), m.indexOf('/* ── Images'));
  expect(fn).toContain('const chunks = input.all ? [null]');
  expect(fn).toContain('ids.slice(i * 100, i * 100 + 100)');
  // A station-only call builds a station-only patch.
  expect(fn).toContain('if (input.station !== undefined) {');
  expect(fn).toContain('if (input.printerId !== undefined) {');
  expect(fn).toContain(".eq('restaurant_id', restaurantId)");
});

test('item 28: the header and every row share one column template, on both tables', () => {
  const s = code('src/features/owner/sections/PrintSetupSection.tsx');
  expect(s).toContain('className={`${CATEGORY_GRID} type-caption text-[var(--text-muted)]`}');
  expect(s).toContain('className={`${CATEGORY_GRID} items-center rounded-[var(--radius-md)]');
  expect(s).toContain('className={`${ITEM_GRID} items-end type-caption text-[var(--text-muted)]`}');
  expect(s).toContain('className={`${ITEM_GRID} items-center rounded-[var(--radius-md)]');
  // No `auto` column left to follow a dropdown's own width.
  expect(s).not.toContain("sm:grid-cols-[1fr_1fr_auto]");
});

/* ── Items 29, 30: a category's printer and the default station ────────── */

test('item 29: a category added with a printer is routed to it through printer.routes; without one, the default printer', () => {
  const m = code('src/lib/db/owner-mutations.ts');
  expect(m).toContain('if (input.printerId) await routeCategoryTo(name, input.printerId, restaurantId, input.actor);');
  expect(m).toContain("demand(actor, 'set.printer');");
  expect(code('src/features/owner/sections/MenuSection.tsx')).toContain('testId="owner-category-printer"');
  // Unrouted category -> the default printer.
  expect(routeItem({ category: 'New Category', route: null, printers: PRINTERS }).printer?.id).toBe('main');
  expect(defaultPrinter(PRINTERS, 'Bar')?.id).toBe('bar');
  expect(defaultPrinter(PRINTERS)?.id).toBe('main');
});

test('item 30: a dish nothing routes goes to the default station, and says so; a routed one is unchanged', () => {
  const d = routeItem({ category: 'Desserts', route: null, printers: PRINTERS, defaultStation: 'Bar' });
  expect(d.printer?.id).toBe('bar');
  expect(d.station).toBe('Bar');
  const routed = routeItem({ category: 'Tandoor', route: null, printers: PRINTERS, defaultStation: 'Bar' });
  expect(routed.printer?.id).toBe('tan');
  expect(routed.station).toBe('Tandoor');
  const nobodyThere = routeItem({ category: 'Desserts', route: null, printers: PRINTERS, defaultStation: 'Grill' });
  expect(nobodyThere.printer?.id).toBe('main');
  expect(nobodyThere.station).toBe('Grill');
});

test('item 30: it is a Setting, saved under routing with the printer grant, and read when a round is placed', () => {
  expect(code('src/lib/db/owner-mutations.ts')).toContain("routing: 'set.printer',");
  expect(code('src/features/owner/sections/SettingsSection.tsx')).toContain("key: 'routing', value: { defaultStation: station.trim() }");
  expect(code('src/lib/db/mutations.ts')).toContain("readSettings('routing', { defaultStation: '' }");
  expect(stationOptions([{ station: 'Tandoor' }, { station: 'tandoor' }], 'Bar')).toEqual(['Main Kitchen', 'Tandoor', 'Billing', 'Bar']);
});
