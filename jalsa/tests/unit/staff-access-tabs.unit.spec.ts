/**
 * Owner → Staff, organised by application access and then by today's availability.
 *
 * THE DISTINCTION THIS FILE EXISTS TO PROTECT
 *   Access and availability are two different facts about a person, and the easy mistake — the
 *   one the requester called out twice — is to let "out today" quietly demote somebody into
 *   "no access". A captain who is off tonight has not lost their PIN. So the cases below assert
 *   the two axes stay independent, in both directions, rather than merely that two tabs exist.
 *
 * WHY THE FILTERS ARE TESTED AS FUNCTIONS AND THE LAYOUT AS SOURCE
 *   The predicates are the part that can be WRONG in a way nobody sees: `p.hasPin` and
 *   `p.onDuty` are one character away from each other's negation. Those are executed here
 *   against a fixture matching the requester's own worked example. The arrangement — tabs above,
 *   available before unavailable, role groups inside — is a question about JSX order, and is
 *   asserted from the source.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026): three injected defects, recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const STAFF = 'src/features/owner/sections/StaffSection.tsx';
const QUERIES = 'src/lib/db/queries.ts';

const read = (path: string): string => readFileSync(path, 'utf8');

function codeOnly(path: string): string {
  const raw = read(path);
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  expect(stripped.length, `stripping ${path} must leave the code behind`).toBeGreaterThan(raw.length / 3);
  return stripped;
}

/* ── The requester's own worked example, as data ───────────────────────────────────────────── */

interface Person {
  name: string;
  role: string;
  hasPin: boolean;
  onDuty: boolean;
}

const ROSTER: Person[] = [
  { name: 'Anand', role: 'Chef', hasPin: true, onDuty: true },
  { name: 'Basheer', role: 'Chef', hasPin: true, onDuty: true },
  { name: 'Selvam', role: 'Chef', hasPin: true, onDuty: false },
  { name: 'Vetri', role: 'Chef', hasPin: true, onDuty: false },
  { name: 'Yusuf', role: 'Chef', hasPin: false, onDuty: true },
  { name: 'Arun', role: 'Waiter', hasPin: false, onDuty: false },
];

/* The three predicates exactly as the component applies them. */
const hasAccess = (all: Person[]) => all.filter((p) => p.hasPin);
const noAccess = (all: Person[]) => all.filter((p) => !p.hasPin);
const available = (some: Person[]) => some.filter((p) => p.onDuty);
const unavailable = (some: Person[]) => some.filter((p) => !p.onDuty);

const groupByRole = (members: Person[]): Array<[string, Person[]]> => {
  const byRole = new Map<string, Person[]>();
  for (const p of members) byRole.set(p.role, [...(byRole.get(p.role) ?? []), p]);
  return [...byRole.entries()];
};

const names = (some: Person[]) => some.map((p) => p.name);

/* ── 1-4. The two tabs, and their counts ───────────────────────────────────────────────────── */

test('1+3. Has access holds everyone with a PIN, and counts them', () => {
  expect(names(hasAccess(ROSTER))).toEqual(['Anand', 'Basheer', 'Selvam', 'Vetri']);
  expect(hasAccess(ROSTER)).toHaveLength(4); // the requester's own expected count
  expect(hasAccess(ROSTER).every((p) => p.hasPin), 'nobody without a PIN leaks in').toBe(true);
});

test('2+4. No access holds everyone without one, and counts them', () => {
  expect(names(noAccess(ROSTER))).toEqual(['Yusuf', 'Arun']);
  expect(noAccess(ROSTER)).toHaveLength(2);
  expect(noAccess(ROSTER).every((p) => !p.hasPin), 'nobody with a PIN leaks in').toBe(true);
});

test('the two tabs partition the roster — nobody is in both, nobody is lost', () => {
  expect(hasAccess(ROSTER).length + noAccess(ROSTER).length).toBe(ROSTER.length);
  const both = hasAccess(ROSTER).filter((p) => noAccess(ROSTER).includes(p));
  expect(both, 'no person appears under both tabs').toHaveLength(0);
});

test('3b. the counts are computed, never written down', () => {
  const src = codeOnly(STAFF);
  expect(src).toContain('Has access · {hasAccess.length}');
  expect(src).toContain('No access · {noAccess.length}');
  // Derived from the SEARCH-FILTERED list, so a tab's number always equals what opening it shows.
  expect(src).toContain('const hasAccess = people.filter((p) => p.hasPin)');
  expect(src).toContain('const noAccess = people.filter((p) => !p.hasPin)');
});

/* ── 5-7. Availability, and the mistake it must not make ───────────────────────────────────── */

test('5. in-today staff appear under Available today', () => {
  expect(names(available(hasAccess(ROSTER)))).toEqual(['Anand', 'Basheer']);
  expect(names(available(noAccess(ROSTER)))).toEqual(['Yusuf']);
});

test('6. OUT-today staff WITH access stay under Has access — the mistake this guards', () => {
  /*
    THE FIXTURE EXERCISES A COPY OF THE PREDICATE, SO THE COPY IS PINNED HERE TOO.

    Without these two lines this case would keep passing while the component started filtering by
    `p.hasPin && p.onDuty` — which is exactly the demotion the requester warned about, and which
    was caught during fail-first only by an assertion in a DIFFERENT test. A case that names a
    rule should be the case that fails when the rule breaks.
  */
  const src = codeOnly(STAFF);
  expect(src, 'access must be decided by the PIN alone').toContain('people.filter((p) => p.hasPin)');
  expect(src, 'availability must never narrow it').not.toContain('p.hasPin && p.onDuty');

  const out = unavailable(hasAccess(ROSTER));
  expect(names(out)).toEqual(['Selvam', 'Vetri']);
  // The point, stated as an assertion: being out today must not demote anybody.
  for (const p of out) {
    expect(p.hasPin, `${p.name} is out today but still has access`).toBe(true);
    expect(noAccess(ROSTER), `${p.name} must not appear under No access`).not.toContain(p);
  }
});

test('7. out-today staff WITHOUT access stay under No access, and are not hidden', () => {
  expect(names(unavailable(noAccess(ROSTER)))).toEqual(['Arun']);
  // Every one of the four combinations is rendered somewhere. Nobody is dropped for being out.
  const placed = [
    ...available(hasAccess(ROSTER)),
    ...unavailable(hasAccess(ROSTER)),
    ...available(noAccess(ROSTER)),
    ...unavailable(noAccess(ROSTER)),
  ];
  expect(placed).toHaveLength(ROSTER.length);
  expect(new Set(names(placed)).size, 'each person lands in exactly one place').toBe(ROSTER.length);
});

test('the two axes are independent — all four combinations exist and are distinguishable', () => {
  const combo = (pin: boolean, duty: boolean) =>
    names(ROSTER.filter((p) => p.hasPin === pin && p.onDuty === duty));
  expect(combo(true, true)).toEqual(['Anand', 'Basheer']);
  expect(combo(true, false)).toEqual(['Selvam', 'Vetri']);
  expect(combo(false, true)).toEqual(['Yusuf']);
  expect(combo(false, false)).toEqual(['Arun']);
});

/* ── 8. Role grouping survives ─────────────────────────────────────────────────────────────── */

test('8. role grouping is preserved INSIDE each section, never flattened', () => {
  const groups = groupByRole(available(hasAccess(ROSTER)));
  expect(groups).toHaveLength(1);
  expect(groups[0]?.[0]).toBe('Chef');
  expect(names(groups[0]?.[1] ?? [])).toEqual(['Anand', 'Basheer']);

  // Two roles under No access, each kept apart.
  const mixed = groupByRole(noAccess(ROSTER));
  expect(mixed.map(([role]) => role)).toEqual(['Chef', 'Waiter']);

  // And the component groups within a section rather than over the whole roster.
  const src = codeOnly(STAFF);
  expect(src).toContain('const groupByRole = (members: StaffMember[])');
  expect(src).toContain('groupByRole(members).map(([role, inRole]) => (');
  expect(src, 'the role count is the count within this section').toContain('{role} · {inRole.length}');
});

/* ── 9. Switching tabs changes nothing ─────────────────────────────────────────────────────── */

test('9. switching tabs filters and cannot mutate', () => {
  const src = codeOnly(STAFF);
  // One piece of local state, set to a literal by each chip. No write, no fetch, no payload edit.
  expect(src).toContain("const [access, setAccess] = React.useState<'has' | 'none'>('has')");
  expect(src).toContain("onClick={() => setAccess('has')}");
  expect(src).toContain("onClick={() => setAccess('none')}");

  // The filters are non-destructive by construction: `filter` returns a new array.
  expect(src).toContain('people.filter((p) => p.hasPin)');
  expect(src).toContain('shown.filter((p) => p.onDuty)');
  expect(src, 'nothing sorts the source array in place').not.toContain('data.staff.sort(');
  expect(src, 'and nothing reverses it in place').not.toContain('.reverse()');
});

test('the default tab is Has access', () => {
  expect(codeOnly(STAFF)).toContain("React.useState<'has' | 'none'>('has')");
});

/* ── 10-11 + 13. Nothing that already worked was disturbed ─────────────────────────────────── */

test('10. Module access is untouched — the panel, the verb and the grant', () => {
  const src = codeOnly(STAFF);
  expect(src).toContain("action: 'set-permissions'");
  expect(src).toContain('staffId: permsFor.id');
  expect(src).toContain('granted: [...granted]');
  expect(src).toContain('setGranted(new Set(data.staffGrants[p.id] ?? ROLE_PRESETS[p.role] ?? []))');
  expect(src).toContain("data.grants.includes('staff.perms')");
  expect(src).toContain('data-testid="owner-perms-save"');
});

test('11. Give them the app is untouched, and still reads off the same field', () => {
  const src = codeOnly(STAFF);
  expect(src).toContain("action: 'issue-pin'");
  // The row still says which it is, in the words it always used — and those words are why
  // `hasPin` is the access criterion rather than something inferred.
  expect(read(STAFF)).toContain("{p.hasPin ? 'Reissue PIN' : 'Give them the app'}");
  expect(read(STAFF)).toContain("{p.hasPin ? 'Can sign in' : 'No PIN yet'}");
});

test('13. every action keeps the grant that gated it before', () => {
  const src = codeOnly(STAFF);
  for (const grant of ['staff.create', 'staff.perms', 'staff.pin', 'staff.paperwork']) {
    expect(src, `${grant} must still gate its action`).toContain(`data.grants.includes('${grant}')`);
  }
  // Paperwork, Edit and Remove all still present.
  expect(src).toContain("action: 'remove-staff'");
  expect(src).toContain("action: 'upsert-staff'");
  expect(src).toContain('<StaffPaperwork');
});

test('the two fields are read from the one place that already defines them', () => {
  const q = codeOnly(QUERIES);
  expect(q).toContain('hasPin: !!s.pin_hash');
  expect(q).toContain('onDuty: s.on_duty as boolean');
  // No second definition of either was introduced on the screen.
  const src = codeOnly(STAFF);
  expect(src, 'access is not re-derived from permissions').not.toContain('staffGrants[p.id].length');
  expect(src, 'nor from the role').not.toMatch(/hasPin\s*=\s*.*role/);
});

/* ── 12. Empty states ──────────────────────────────────────────────────────────────────────── */

test('12. neither tab can render a blank page', () => {
  const src = codeOnly(STAFF);
  expect(src).toContain('{shown.length === 0 ? (');
  expect(src).toContain('data-testid="owner-staff-empty"');

  const raw = read(STAFF);
  // The requester's own sentence for the everyone-has-access case.
  expect(raw).toContain('Everyone has app access.');
  // And the opposite case says what to DO, not merely that the list is empty.
  expect(raw).toContain('Nobody can sign in yet.');
  expect(raw).toContain('Give them the app');
  // A search that matches nobody is its own case — "everyone has access" would be a lie there.
  expect(raw).toContain('Nobody matching that search can sign in yet.');
  expect(raw).toContain('Everyone matching that search already has app access.');
});

test('a section with nobody in it renders no heading at all', () => {
  const src = codeOnly(STAFF);
  // A heading over nothing reads as a bug; the other section still renders either way.
  expect(src).toContain('members.length === 0 ? null : (');
});

/* ── The arrangement on the screen ─────────────────────────────────────────────────────────── */

test('tabs sit above the list, and Available comes before Unavailable', () => {
  const src = codeOnly(STAFF);
  const tabs = src.indexOf('data-testid="owner-staff-tab-has"');
  const sections = src.indexOf("['Available today', available]");
  const rows = src.indexOf('groupByRole(members).map');
  expect(tabs, 'the tabs exist').toBeGreaterThan(-1);
  expect(tabs, 'above the sections').toBeLessThan(sections);
  expect(sections, 'which are above the rows').toBeLessThan(rows);
  expect(src.indexOf("['Available today', available]")).toBeLessThan(
    src.indexOf("['Unavailable today', unavailable]")
  );
});

test('the tab row is the existing chip NAVIGATION, which is what makes it responsive', () => {
  const src = codeOnly(STAFF);
  // `CHIP_NAV_WRAP` wraps rather than scrolling sideways, and `Chip` already carries `min-h-11`
  // and `whitespace-nowrap` — so at 320px the second tab drops to its own line at full tap size
  // instead of being clipped, truncated, or hidden behind a scroll gesture with no affordance.
  expect(src).toContain("import { CHIP_NAV_WRAP } from '@/lib/chip-nav'");
  expect(src).toContain('<nav className={CHIP_NAV_WRAP}');
  expect(read('src/lib/chip-nav.ts')).toContain("export const CHIP_NAV_WRAP = 'flex flex-wrap gap-2'");
  // Named for a screen reader, because two chips that filter a list are a navigation.
  expect(src).toContain('aria-label="Staff by application access"');
});
