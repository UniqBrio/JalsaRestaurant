/**
 * The 12-Oct-2026 corrections.
 *
 *   1. "Add photo for take away ... should be added under add new item dialog under take away."
 *      The photo is chosen in the Takeaway dialog (NewRoundSheet), and the order's detail in Live
 *      orders only shows it.
 *   2. "In all form where ever there is dropdown add dropdown icon." The shared Select drew no
 *      arrow at all (`appearance-none` removes the browser's, nothing replaced it); the Combobox
 *      drew a caption-sized text caret. Both now wear one ChevronDown.
 *   3. "Under menu item add delete feature beside edit and before delete ask for confirmation."
 *      ROOT CAUSE of "already done, why not reflecting": it was never committed. No commit on any
 *      of the repository's 16 branches, no request file and no run-log entry has a menu-item
 *      delete; the only menu writes were upsert-item and set-availability. Work that stays in a
 *      session's container and is not pushed is lost when the container is reclaimed.
 *
 * The write path is the REAL `deleteMenuItem` on the round rig (menu-item-delete.scenarios.ts);
 * the screens are mounted for real in corrections-12oct.render.spec.ts; the doors are pinned here.
 *
 * FAIL-FIRST (observed 12-Oct-2026, `src/` stashed back to the tree before this change): the
 * scenario bundle does not build - `No matching export in "src/lib/db/owner-mutations.ts" for
 * import "deleteMenuItem"` - so `beforeAll` fails and no case in this file passes.
 * The pinned strings were also checked absent from that tree one by one (`git show HEAD:...`):
 * `case 'delete-item':`, `owner-delete-`, `<ChevronDown` (field and combobox), `owner-new-round-photo`,
 * `photoUrl: selected.photoUrl`; and `˅` and `<ImagePicker` in LiveOrders were present.
 * NOT OBSERVED FAILING, by design: the schema pin and "no bare select element" are guards that
 * held before this change too - they fail when a later change breaks what this one relies on.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../support/round-rig';

interface Result {
  name: string;
  out: unknown;
  threw: string | null;
  log: Array<{ table: string; op: string; body: Record<string, unknown> | null; filters: string[] }>;
}

const SCENARIOS = fileURLToPath(new URL('../support/rounds/menu-item-delete.scenarios.ts', import.meta.url));
const APP = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string): string => readFileSync(`${APP}${p}`, 'utf8');
let results: Result[] = [];
const by = (name: string): Result => {
  const r = results.find((x) => x.name === name);
  expect(r, `scenario "${name}" ran`).toBeDefined();
  return r!;
};

test.beforeAll(async () => {
  results = await runScenario<Result[]>(SCENARIOS);
});

/* ── 3. Delete a menu item ──────────────────────────────────────────────────────────────────── */

test('deleting a menu item needs the edit grant, and nothing is written without it', () => {
  const r = by('delete without menu.item_edit');
  expect(r.threw).toMatch(/^PermissionDenied/);
  expect(r.log).toEqual([]);
});

test('a delete removes this restaurant\'s item only, and is audited by name', () => {
  const r = by('delete');
  expect(r.threw).toBeNull();
  expect(r.out).toEqual({ name: 'Paneer Tikka' });
  const del = r.log.find((l) => l.table === 'menu_item' && l.op === 'delete');
  expect(del?.filters).toContain('eq:id="44444444-4444-4444-8444-444444444444"');
  expect(del?.filters.some((f) => f.startsWith('eq:restaurant_id='))).toBe(true);
  const audit = r.log.find((l) => l.table === 'audit_entry' && l.op === 'insert');
  expect(audit?.body).toMatchObject({ action: 'Menu item', detail: 'Paneer Tikka deleted' });
});

test('an item already gone is said in words, and nothing is audited', () => {
  const r = by('delete, already gone');
  // SUPERSEDED 12-Oct-2026 (code review): asserted 'Error: That item ...' - a plain Error, which the
  // route turned into the generic 500 "try again". Now its own class, answered 409 in words.
  expect(r.threw).toBe('MenuItemRefused: That item is no longer on the menu. Reload the page.');
  expect(r.log.some((l) => l.table === 'audit_entry')).toBe(false);
});

test('the owner route carries delete-item into deleteMenuItem', () => {
  const route = read('src/app/api/owner/action/route.ts');
  expect(route).toContain("| { action: 'delete-item'; id: string }");
  expect(route).toContain("case 'delete-item':");
  expect(route).toContain("await deleteMenuItem({ id: String(input.id ?? ''), actor })");
});

test('Delete sits beside Edit on every menu row, and only the confirmation sends it', () => {
  const ui = read('src/features/owner/sections/MenuSection.tsx');
  const edit = ui.indexOf('data-testid={`owner-edit-${m.id}`}');
  const del = ui.indexOf('data-testid={`owner-delete-${m.id}`}');
  expect(edit).toBeGreaterThan(-1);
  // In the same cell, straight after Edit.
  expect(del).toBeGreaterThan(edit);
  expect(ui.slice(edit, del)).not.toContain("key: '");
  // The button only opens the confirmation; the confirmation sends the delete.
  expect(ui).toContain('onClick={() => setDeleting({ id: m.id, name: m.name })}');
  const confirm = ui.indexOf('testId="owner-item-delete-confirm"');
  const send = ui.indexOf("{ action: 'delete-item', id: deleting.id }");
  expect(confirm).toBeGreaterThan(-1);
  expect(send).toBeGreaterThan(ui.indexOf('<ConfirmDialog'));
  expect(send).toBeLessThan(confirm);
  expect(ui).toContain('confirmLabel="Delete the item"');
});

test('deleting a dish keeps every order and bill that has it - the schema says so', () => {
  const core = read('supabase/migrations/20260910070000_jalsa_core_schema.sql');
  // Rounds keep a snapshot; their link empties. A guest's unsent cart line goes with the dish.
  expect(core).toContain('menu_item_id    uuid references public.menu_item(id) on delete set null,');
  expect(core).toContain('menu_item_id uuid not null references public.menu_item(id) on delete cascade,');
  const fav = read('supabase/migrations/20261004090000_jalsa_guest_favourite.sql');
  expect(fav).toContain('menu_item_id     uuid references public.menu_item(id) on delete set null,');
});

/* ── 2. Every dropdown wears a chevron ──────────────────────────────────────────────────────── */

test('the shared Select draws the chevron in the space it keeps free for it', () => {
  const field = read('src/components/ui/field.tsx');
  const start = field.indexOf('export const Select');
  const select = field.slice(start, field.indexOf('\n});\n', start));
  // SUPERSEDED 12-Oct-2026 (code review): asserted "'appearance-none pr-9'"; the select is now the
  // chevron's `peer`, so a disabled select dims its chevron with it.
  expect(select).toContain("'peer appearance-none pr-9'");
  expect(select).toContain('peer-disabled:opacity-45');
  expect(select).toContain('<ChevronDown className="pointer-events-none absolute right-3');
});

test('the Combobox toggle is the same chevron, not a text caret', () => {
  const combo = read('src/components/ui/combobox.tsx');
  expect(combo).toContain("import { ChevronDown, controlClass } from './field';");
  expect(combo).toContain('<ChevronDown');
  expect(combo).not.toContain('˅');
});

test('no form builds a dropdown of its own: every select element is the shared Select', () => {
  // A bare select element anywhere else would be a dropdown without the chevron.
  for (const file of [
    'src/features/owner/sections/MenuSection.tsx',
    'src/features/owner/sections/SettingsSection.tsx',
    'src/features/owner/sections/StaffSection.tsx',
    'src/features/owner/sections/PrintersSection.tsx',
    'src/features/owner/sections/PrintSetupSection.tsx',
    'src/features/owner/sections/LedgersSection.tsx',
    'src/features/owner/sections/WaitlistSection.tsx',
    'src/features/owner/sections/StaffPaperwork.tsx',
    'src/features/owner/sections/LiveOrders.tsx',
    'src/features/guest/GuestOrdering.tsx',
    'src/features/guest/HeardPrompt.tsx',
  ]) {
    expect(read(file), file).not.toMatch(/<select[\s>]/);
  }
});

/* ── 1. The takeaway's photo is chosen in the Takeaway dialog ───────────────────────────────── */

test('the Takeaway dialog carries the photo picker, for a new takeaway and for Add items', () => {
  const sheet = read('src/features/owner/sections/Dashboard.tsx');
  expect(sheet).toContain("{canPhoto && target?.kind === 'takeaway' ? (");
  expect(sheet).toContain("{canPhoto && target?.kind === 'takeaway-more' ? (");
  expect(sheet).toContain('testId="owner-new-round-photo"');
  // A new takeaway's photo is saved to the bill the order just created - after it exists.
  const placed = sheet.indexOf("action: 'takeaway',");
  const saved = sheet.indexOf("{ action: 'takeaway-photo', billId: res.billId, base64: pendingPhoto }");
  expect(placed).toBeGreaterThan(-1);
  expect(saved).toBeGreaterThan(placed);
});

test('the order detail in Live orders shows the photo and no longer edits it', () => {
  const live = read('src/features/owner/sections/LiveOrders.tsx');
  expect(live).not.toContain('<ImagePicker');
  expect(live).toContain('data-testid="owner-takeaway-photo-view"');
  // Add items opens the dialog with the order's current photo in it.
  expect(live).toContain("kind: 'takeaway-more', billId: selected.id, code: selected.code, photoUrl: selected.photoUrl");
});

/* ── Code review, 12-Oct-2026 ──────────────────────────────────────────────────────────────────
   FAIL-FIRST (observed 12-Oct-2026, before the review fixes): "delete, already gone" through the
   real route answered 500 "Something on our side failed. Nothing you did was lost — try again.";
   "edit, deleted from another screen" answered 200 and audited "Paneer Tikka edited". */

interface DoorResult {
  name: string;
  status: number;
  body: string;
  log: string[];
  threw: string | null;
}
const DOORS = fileURLToPath(new URL('../support/rounds/menu-item-doors.scenarios.ts', import.meta.url));

test.describe('the owner route, called for real', () => {
  let doors: DoorResult[] = [];
  const door = (name: string): DoorResult => {
    const r = doors.find((x) => x.name === name);
    expect(r, `scenario "${name}" ran`).toBeDefined();
    return r!;
  };
  test.beforeAll(async () => {
    doors = await runScenario<DoorResult[]>(DOORS);
  });

  test('deleting a dish that is already gone answers 409 in words, not "try again"', () => {
    const r = door('delete, already gone');
    expect(r.threw).toBeNull();
    expect(r.status).toBe(409);
    expect(JSON.parse(r.body)).toMatchObject({ code: 'conflict', message: 'That item is no longer on the menu. Reload the page.' });
    expect(r.log).not.toContain('audit_entry:insert');
  });

  test('an id that is not an id is refused in words before the database is asked', () => {
    const r = door('delete, not an id');
    expect(r.status).toBe(409);
    expect(r.log).not.toContain('menu_item:delete');
  });

  test('saving an edit of a dish deleted on another screen is refused, never reported saved', () => {
    const r = door('edit, deleted from another screen');
    expect(r.status).toBe(409);
    expect(JSON.parse(r.body)).toMatchObject({ message: 'That item is no longer on the menu. Reload the page.' });
    expect(r.log).not.toContain('menu_item:update');
    expect(r.log).not.toContain('audit_entry:insert');
  });
});

test('no bare select element anywhere in the application - every dropdown is the shared Select', async () => {
  // Supersedes nothing: widens the 11-file check above to every component (code review, T2).
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (dir: string): string[] =>
    readdirSync(`${APP}${dir}`).flatMap((f) => {
      const p = `${dir}/${f}`;
      return statSync(`${APP}${p}`).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
    });
  const files = walk('src');
  expect(files.length).toBeGreaterThan(50);
  const offenders = files.filter((f) => f !== 'src/components/ui/field.tsx' && /<select[\s>]/.test(read(f)));
  expect(offenders).toEqual([]);
});

test('welcome drinks are saved from the drinks still on the menu, so a deleted dish is never a drink', () => {
  const ui = read('src/features/owner/sections/SettingsSection.tsx');
  expect(ui).toContain('disabled={busy || (enabled && chosen.length === 0)}');
  expect(ui).toContain('value: { enabled, itemIds: chosen.map((m) => m.id) },');
});
