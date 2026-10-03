/**
 * owner-search - "where do I go for X?" over the owner console's OWN screens (03-Oct-2026).
 *
 * NOT A DATA SEARCH. It finds screens - sections, Reports tabs, Settings panels - the way a
 * product's command bar does, so an owner who types "gst" lands on the GST figures without
 * knowing they live under Reports. It searches no bill, dish or person.
 *
 * NOTHING HERE INVENTS A SCREEN. The label and the permission of every result come from the
 * console's own lists (`SECTIONS` in OwnerConsole, `REPORT_TABS` in ReportsSection, `PANELS` in
 * SettingsSection), passed in by the component. This module adds only words to find them by;
 * `owner-search.unit.spec.ts` refuses a hint whose target is not one of those lists.
 *
 * NOTHING HERE GRANTS ACCESS. Results are filtered by the person's grants so a screen they may
 * not open is never offered - and opening one still goes through the console's own gate, which
 * renders a denied state, and every route's own check.
 */

/** Where a result goes: a section, and optionally the tab or panel inside it. */
export interface NavTarget {
  section: string;
  sub?: string;
}

export interface NavEntry extends NavTarget {
  /** `section` or `section/sub` - unique, and what the hints are keyed by. */
  id: string;
  /** The screen's own label, as the console shows it. */
  label: string;
  /** Where it is, for a tab or panel ("Reports", "Settings"); '' for a section. */
  parent: string;
  description: string;
  keywords: readonly string[];
  aliases: readonly string[];
  /** Every grant needed to open it: the section's, and the panel's own where it has one. */
  permissions: readonly string[];
}

interface Hint {
  description: string;
  keywords?: readonly string[];
  aliases?: readonly string[];
}

/**
 * Words to find each screen by. Keyed by entry id; a key that names no real screen is refused by
 * the spec. KEYWORDS are what the screen is about; ALIASES are other names people use for it.
 */
export const NAV_HINTS: Readonly<Record<string, Hint>> = {
  dashboard: {
    description: 'Today at a glance — takings, open bills, requests, the floor.',
    keywords: ['home', 'overview', 'today', 'summary', 'kpi'],
    aliases: ['main', 'start'],
  },
  day: {
    description: 'Get the restaurant ready to open — staff, tables, menu, waitlist.',
    keywords: ['opening', 'open the restaurant', 'checklist', 'shift'],
    aliases: ['start of day', 'day start'],
  },
  orders: {
    description: 'Every open bill and its rounds, as the kitchen sees them.',
    keywords: ['kot', 'bills', 'tables', 'kitchen', 'rounds', 'takeaway', 'parcel'],
    aliases: ['running orders', 'open orders', 'live'],
  },
  queue: {
    description: 'Guests waiting for a table, and opening or closing the queue.',
    keywords: ['waiting', 'walk-in', 'queue'],
    aliases: ['waiting list'],
  },
  payments: {
    description: 'Bills waiting to be closed, and recording how they were paid.',
    keywords: ['pay', 'close bill', 'settle', 'cash', 'upi', 'card', 'awaiting closure'],
    aliases: ['billing', 'checkout'],
  },
  menu: {
    description: 'Dishes, prices, categories, food types, availability and dish photos.',
    keywords: ['dishes', 'items', 'food', 'prices', 'categories', 'sold out', 'availability', 'photo', 'image', 'food type'],
    aliases: ['media', 'blob', 'upload', 'catalogue'],
  },
  printers: {
    description: 'Connect the printing computer, choose printers, print a test.',
    keywords: ['printer', 'kot printer', 'bill printer', 'thermal', 'print computer', 'bridge'],
    aliases: ['printing'],
  },
  staff: {
    description: 'The team, their roles, what each may do, and their PINs.',
    keywords: ['team', 'employees', 'pin', 'captain', 'waiter', 'roles', 'permissions', 'access'],
    aliases: ['people', 'users'],
  },
  tips: {
    description: 'Tips taken and paid out to the floor.',
    keywords: ['tip', 'gratuity', 'payout'],
  },
  expenses: {
    description: 'Money in and money out over a range — purchases and expenses.',
    keywords: ['expense', 'income', 'purchases', 'spend', 'ledger'],
    aliases: ['cash book', 'accounts'],
  },
  reports: {
    description: 'Sales, orders, purchases, the final report and guests, over one date range.',
    keywords: ['analytics', 'report', 'figures'],
  },
  uplift: {
    description: 'Repeat rounds, tips and how guests found Jalsa, over the last 30 days.',
    keywords: ['repeat rounds', 'upsell', 'growth'],
  },
  settings: {
    description: 'Hours, restaurant details, tax, invoice, tables, guest screens, printers.',
    keywords: ['configuration', 'preferences', 'setup'],
  },
  audit: {
    description: 'Who did what, and when.',
    keywords: ['log', 'history', 'activity', 'who did what'],
  },

  'reports/sales': {
    description: 'Sales, bills, discounts, the GST split, payment mix, categories and dishes sold.',
    keywords: ['gst', 'gst report', 'tax', 'taxation', 'revenue', 'products', 'categories', 'food types', 'payment mix', 'sales by day'],
    aliases: ['sales report', 'tax report'],
  },
  'reports/orders': {
    description: 'Every bill in the range, dine-in and takeaway.',
    keywords: ['ledger', 'all bills', 'order history', 'dine in', 'takeaway orders'],
  },
  'reports/expenses': {
    description: 'Purchases and expenses in the range.',
    keywords: ['purchases', 'expense report', 'spend'],
  },
  'reports/final': {
    description: 'Income, purchases and net for the range.',
    keywords: ['profit', 'net', 'p&l', 'income statement'],
    aliases: ['profit and loss'],
  },
  'reports/guests': {
    description: 'People loved items, and how guests found Jalsa.',
    keywords: ['favourites', 'favorites', 'loved', 'hearts', 'people loved items', 'how did you hear about us', 'heard about', 'attribution', 'source', 'google review'],
    aliases: ['marketing', 'customers'],
  },

  'settings/hours': { description: 'When the restaurant is open, and holidays.', keywords: ['timings', 'holiday', 'closed'], aliases: ['opening hours'] },
  'settings/identity': { description: 'Name, address, phone and GSTIN.', keywords: ['name', 'address', 'phone', 'gstin', 'logo'], aliases: ['restaurant details', 'business details'] },
  'settings/tax': { description: 'The GST rate charged on food.', keywords: ['gst', 'tax', 'gst rate', 'cgst', 'sgst', 'taxation'], aliases: ['gst settings'] },
  'settings/invoice': { description: 'What the printed and shared bill shows.', keywords: ['bill format', 'receipt', 'invoice'], aliases: ['bill layout'] },
  'settings/tables': { description: 'Tables, zones and their QR codes.', keywords: ['qr', 'qr code', 'table', 'zones', 'table stand'], aliases: ['floor plan'] },
  'settings/features': { description: 'Which buttons and screens the guest phone shows.', keywords: ['guest app', 'customer app', 'game', 'heart', 'takeaway', 'features'], aliases: ['customer features'] },
  'settings/copy': { description: 'The words on the guest screens.', keywords: ['text', 'wording', 'messages', 'copy'], aliases: ['guest words'] },
  'settings/replies': { description: 'Ready-made replies to guest suggestions.', keywords: ['suggestions', 'feedback', 'reply'], aliases: ['canned replies'] },
  'settings/engage': { description: 'Review link and call number the guest sees.', keywords: ['review', 'google review link', 'call number'], aliases: ['engagement'] },
  'settings/printers': { description: 'Printers, bridges, ticket templates, routing and print history.', keywords: ['printer', 'templates', 'routing', 'bridge', 'print history', 'kot template'], aliases: ['print setup'] },
};

/** The console's own lists, as the component passes them in. */
export interface NavSources {
  sections: ReadonlyArray<{ key: string; label: string; permission: string }>;
  reportTabs: ReadonlyArray<{ key: string; label: string }>;
  settingsPanels: ReadonlyArray<{ key: string; label: string; permission: string }>;
}

/** Every screen the search can offer, built from the console's own lists - in their order. */
export function buildNavEntries({ sections, reportTabs, settingsPanels }: NavSources): NavEntry[] {
  const hint = (id: string): Hint => NAV_HINTS[id] ?? { description: '' };
  const entry = (id: string, t: NavTarget, label: string, parent: string, permissions: string[]): NavEntry => {
    const h = hint(id);
    return {
      id,
      ...t,
      label,
      parent,
      description: h.description,
      keywords: h.keywords ?? [],
      aliases: h.aliases ?? [],
      permissions,
    };
  };
  const out: NavEntry[] = [];
  for (const s of sections) {
    out.push(entry(s.key, { section: s.key }, s.label, '', [s.permission]));
    if (s.key === 'reports') {
      for (const t of reportTabs) out.push(entry(`reports/${t.key}`, { section: 'reports', sub: t.key }, t.label, s.label, [s.permission]));
    }
    if (s.key === 'settings') {
      for (const p of settingsPanels) {
        out.push(
          entry(`settings/${p.key}`, { section: 'settings', sub: p.key }, p.label, s.label, [...new Set([s.permission, p.permission])])
        );
      }
    }
  }
  return out;
}

/** Only what this person may open: every one of the entry's grants, held. */
export function entriesFor(entries: readonly NavEntry[], grants: readonly string[]): NavEntry[] {
  const held = new Set(grants);
  return entries.filter((e) => e.permissions.every((p) => held.has(p)));
}

/** Lower case, '&' read as 'and', punctuation as space, spaces collapsed. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * How well an entry answers a query - lower is better, null is no match.
 *
 *   0  the title, exactly            ("Payments")
 *   1  the title starts with it      ("pay" -> Payments)
 *   2  a keyword or alias, exactly   ("gst" -> Sales & products, Tax & GST)
 *   3  contained anywhere - title, keyword, alias, where it is, or what it is for
 */
export function rankEntry(e: NavEntry, query: string): number | null {
  const q = normalise(query);
  if (!q) return null;
  const title = normalise(e.label);
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  const words = [...e.keywords, ...e.aliases].map(normalise);
  if (words.includes(q)) return 2;
  const hay = [title, ...words, normalise(e.parent), normalise(e.description)];
  if (hay.some((h) => h.includes(q))) return 3;
  // Every word of a multi-word query somewhere ("reports gst", "qr table").
  const parts = q.split(' ');
  if (parts.length > 1 && parts.every((p) => hay.some((h) => h.includes(p)))) return 3;
  return null;
}

/** The best matches, best first; ties keep the console's own order. */
export function searchNav(entries: readonly NavEntry[], query: string, limit = 8): NavEntry[] {
  return entries
    .map((e, i) => ({ e, i, r: rankEntry(e, query) }))
    .filter((x): x is { e: NavEntry; i: number; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}

/** Arrow keys wrap, so the last result is one key away from the first. */
export function moveActive(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}
