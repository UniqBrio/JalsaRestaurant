/**
 * The owner's console search - its registry, its ranking, and its permissions (03-Oct-2026).
 *
 * The registry is built from the console's OWN lists, read here from source exactly as the
 * render spec reads them: SECTIONS (OwnerConsole), REPORT_TABS (ReportsSection) and PANELS
 * (SettingsSection). A hint naming a screen none of those lists has fails here - the search can
 * never offer a route the console does not have. Keyboard and touch are driven for real in
 * tests/render/owner-search.render.spec.ts.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  buildNavEntries,
  entriesFor,
  moveActive,
  NAV_HINTS,
  normalise,
  rankEntry,
  searchNav,
  type NavEntry,
} from '../../src/lib/owner-search';

const read = (p: string): string => readFileSync(p, 'utf8');

function rows(file: string, list: string): Array<{ key: string; label: string; permission: string }> {
  const src = read(file);
  const start = src.indexOf(`export const ${list}`);
  expect(start, `${list} is exported from ${file}`).toBeGreaterThan(-1);
  const body = src.slice(start, src.indexOf('\n];', start));
  const out = [...body.matchAll(/\{ key: '([^']+)', label: '([^']+)'(?:, permission: '([^']+)')? \}/g)].map((m) => ({
    key: m[1]!,
    label: m[2]!,
    permission: m[3] ?? '',
  }));
  return out;
}

const SECTIONS = rows('src/features/owner/OwnerConsole.tsx', 'SECTIONS');
const REPORT_TABS = rows('src/features/owner/sections/ReportsSection.tsx', 'REPORT_TABS');
const PANELS = rows('src/features/owner/sections/SettingsSection.tsx', 'PANELS');
const ENTRIES = buildNavEntries({ sections: SECTIONS, reportTabs: REPORT_TABS, settingsPanels: PANELS });
const EVERY = [...new Set([...SECTIONS, ...PANELS].map((r) => r.permission))];

test('the parse found the console\'s real lists - a registry of nothing would pass everything below', () => {
  expect(SECTIONS.map((s) => s.key)).toEqual([
    'dashboard', 'day', 'orders', 'queue', 'payments', 'menu', 'printers', 'staff', 'tips', 'expenses', 'reports', 'uplift', 'settings', 'audit',
  ]);
  expect(REPORT_TABS.map((t) => t.key)).toEqual(['sales', 'orders', 'expenses', 'final', 'guests']);
  expect(PANELS).toHaveLength(10);
  expect(ENTRIES).toHaveLength(SECTIONS.length + REPORT_TABS.length + PANELS.length);
});

test('no invented routes: every hint names a real screen, and every screen has a hint', () => {
  const ids = new Set(ENTRIES.map((e) => e.id));
  for (const key of Object.keys(NAV_HINTS)) expect(ids.has(key), `hint "${key}" names a real screen`).toBe(true);
  for (const e of ENTRIES) expect(e.description, `${e.id} says what it is for`).not.toBe('');
  // And every section a result can open is one the console actually renders.
  const consoleSrc = read('src/features/owner/OwnerConsole.tsx');
  for (const s of SECTIONS) expect(consoleSrc).toContain(`{section === '${s.key}' ? <`);
});

test('labels and permissions are the console\'s own, not copies', () => {
  const settingsTax = ENTRIES.find((e) => e.id === 'settings/tax')!;
  expect(settingsTax).toMatchObject({ label: 'Tax & GST', parent: 'Settings', section: 'settings', sub: 'tax' });
  // A panel needs its section's grant AND its own.
  expect([...settingsTax.permissions].sort()).toEqual(['set.tables', 'set.tax']);
  expect(ENTRIES.find((e) => e.id === 'reports/guests')).toMatchObject({ label: 'Guest insights', permissions: ['rep.products'] });
  const src = read('src/lib/owner-search.ts');
  expect(src, 'the module holds no label or permission of its own').not.toMatch(/permission: '/);
});

/* ── Matching and ranking ──────────────────────────────────────────────────────────────────── */

const entry = (id: string, label: string, keywords: string[] = [], aliases: string[] = [], description = ''): NavEntry => ({
  id,
  section: id,
  label,
  parent: '',
  description,
  keywords,
  aliases,
  permissions: [],
});

test('rank: exact title 0, title starts-with 1, keyword or alias exact 2, contains 3', () => {
  const pay = entry('payments', 'Payments', ['settle'], ['billing']);
  expect(rankEntry(pay, 'payments')).toBe(0);
  expect(rankEntry(pay, '  PAYMENTS ')).toBe(0);
  expect(rankEntry(pay, 'pay')).toBe(1);
  expect(rankEntry(pay, 'settle')).toBe(2);
  expect(rankEntry(pay, 'billing')).toBe(2);
  expect(rankEntry(pay, 'ments')).toBe(3);
  expect(rankEntry(pay, 'sett')).toBe(3);
  expect(rankEntry(pay, 'printer')).toBeNull();
  expect(rankEntry(pay, '')).toBeNull();
});

test('ranking orders results, and ties keep the console\'s order', () => {
  const list = [
    entry('a', 'Tax report', [], [], 'about gst'), // contains
    entry('b', 'Settings', ['gst']), // keyword exact
    entry('c', 'GST summary'), // starts-with
    entry('d', 'GST'), // exact
  ];
  expect(searchNav(list, 'gst').map((e) => e.id)).toEqual(['d', 'c', 'b', 'a']);
  expect(searchNav(list, 'gst', 2).map((e) => e.id), 'limit').toEqual(['d', 'c']);
});

test('the real registry answers the obvious questions', () => {
  const top = (q: string) => searchNav(ENTRIES, q)[0]?.id;
  expect(top('Payments')).toBe('payments');
  expect(top('pay')).toBe('payments');
  expect(top('printers')).toBe('printers');
  expect(top('staff pin')).toBe('staff');
  expect(top('blob')).toBe('menu');
  expect(top('favourites')).toBe('reports/guests');
  expect(top('how did you hear about us')).toBe('reports/guests');
  expect(top('qr')).toBe('settings/tables');
  expect(searchNav(ENTRIES, 'gst').slice(0, 2).map((e) => e.id).sort()).toEqual(['reports/sales', 'settings/tax']);
  expect(searchNav(ENTRIES, 'zzzz')).toEqual([]);
});

test('normalise folds case, "&" and punctuation', () => {
  expect(normalise('Tax & GST')).toBe('tax and gst');
  expect(normalise('  P&L ')).toBe('p and l');
  expect(normalise('Who-did-what?')).toBe('who did what');
});

test('arrow keys wrap both ways', () => {
  expect(moveActive(-1, 1, 3)).toBe(0);
  expect(moveActive(-1, -1, 3)).toBe(2);
  expect(moveActive(2, 1, 3)).toBe(0);
  expect(moveActive(0, -1, 3)).toBe(2);
  expect(moveActive(0, 1, 0)).toBe(-1);
});

/* ── Permissions ───────────────────────────────────────────────────────────────────────────── */

test('a screen this person may not open is never offered', () => {
  const captain = entriesFor(ENTRIES, ['orders.view', 'menu.view', 'rep.products']);
  const ids = captain.map((e) => e.id);
  expect(ids).toContain('orders');
  expect(ids).toContain('reports/guests');
  expect(ids).not.toContain('settings');
  expect(ids).not.toContain('settings/tax');
  expect(ids).not.toContain('uplift');
  expect(searchNav(captain, 'gst').map((e) => e.id)).toEqual(['reports/sales']);
  // Settings without the tax grant: the section, but not the tax panel.
  const manager = entriesFor(ENTRIES, ['set.tables', 'set.hours']).map((e) => e.id);
  expect(manager).toEqual(expect.arrayContaining(['settings', 'settings/tables', 'settings/hours']));
  expect(manager).not.toContain('settings/tax');
  expect(entriesFor(ENTRIES, EVERY)).toHaveLength(ENTRIES.length);
});

test('opening a result still goes through the console\'s own gate', () => {
  const src = read('src/features/owner/OwnerConsole.tsx');
  expect(src).toContain('<OwnerSearch entries={navEntries} grants={data.grants} onOpen={openFromSearch} />');
  expect(src).toContain('go(e.section as OwnerSection, e.sub);');
  // The section gate is untouched: a section the person may not open renders the denied state.
  expect(src).toContain('<DeniedState permission={current.label} testId="owner-denied" />');
});

/* ── Opening on the right tab ──────────────────────────────────────────────────────────────── */

test('a result with a tab or panel opens on it, even from inside that section', () => {
  const src = read('src/features/owner/OwnerConsole.tsx');
  expect(src).toContain("<ReportsSection key={`reports-${jumps}`} {...shared} />");
  expect(src).toContain("<SettingsSection key={`settings-${jumps}`} {...shared} />");
  expect(src).toContain('setJumps((n) => n + 1);');
  expect(read('src/features/owner/sections/ReportsSection.tsx')).toContain(
    "const [tab, setTab] = React.useState<ReportTab>(() => (isReportTab(arg) ? arg : 'sales'));"
  );
  // Settings opens a named panel only if the person may open it.
  expect(read('src/features/owner/sections/SettingsSection.tsx')).toContain(
    "() => allowed.find((p) => p.key === arg)?.key ?? allowed[0]?.key ?? 'tables'"
  );
});

test('it is a search field driving a listbox, not a second value picker', () => {
  const src = read('src/features/owner/OwnerSearch.tsx');
  expect(src).not.toContain('role="combobox"');
  expect(src).toContain('role="listbox"');
  expect(src).toContain('role="option"');
  expect(src).toContain("if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {");
  expect(src).toContain("} else if (ev.key === 'Enter') {");
  expect(src).toContain("} else if (ev.key === 'Escape') {");
  // A tap lands on the result before the field's blur closes the list.
  expect(src).toContain('onMouseDown={(e) => e.preventDefault()}');
});
