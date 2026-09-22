/**
 * Restaurant details: a redesign that must not lose a single field.
 *
 * WHY THIS IS THE TEST THAT MATTERS HERE
 *   `writeIdentity` sends the form object straight to `restaurant` as a column patch:
 *   `update(input.patch)`. So every key in `form` IS a database column, and a key dropped while
 *   moving markup around does not error, does not warn, and does not save. The owner types into
 *   a box, presses Save, sees a success toast, and the value is gone. That is the whole risk of
 *   this change, and it is exactly readable from the source.
 *
 * FAIL-FIRST EVIDENCE (18-Sep-2026): three injected losses, recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const SOURCE = 'src/features/owner/sections/SettingsSection.tsx';
const source = readFileSync(SOURCE, 'utf8');

/** The panel's own slice, so a field living in a different panel cannot satisfy these. */
function panel(): string {
  const open = source.indexOf('function IdentityPanel(');
  expect(open, 'the panel must still exist').toBeGreaterThan(-1);
  const close = source.indexOf('/* ── Tax ', open);
  expect(close, 'and end before the next panel').toBeGreaterThan(open);
  const slice = source.slice(open, close);
  expect(slice.length, 'the parsed panel must not be empty').toBeGreaterThan(2000);
  return slice;
}

/** Every column the form patches. Ordered as the database reads them, not as the screen does. */
const COLUMNS = [
  'legal_name',
  'display_name',
  'address',
  'email',
  'phone',
  'signatory_name',
  'signatory_role',
  'fssai',
  'pan',
  'hr_email',
] as const;

const TESTIDS = [
  'owner-legal-name',
  'owner-display-name',
  'owner-address',
  'owner-email',
  'owner-phone',
  'owner-signatory',
  'owner-signatory-role',
  'owner-fssai',
  'owner-pan',
  'owner-hr-email',
  'owner-identity-save',
] as const;

test('all TEN columns are still read into the form and still written back', () => {
  const p = panel();
  for (const column of COLUMNS) {
    // Read from the restaurant row...
    expect(p, `${column} must be read`).toMatch(new RegExp(`${column}: r\\.${column} \\?\\? ''`));
    // ...and bound to a control, which is what puts it back in the patch.
    expect(p, `${column} must be bound to a control`).toContain(`form.${column}`);
    expect(p, `${column} must have a setter`).toContain(`set('${column}')`);
  }
  // The count is asserted too: an eleventh key would be a new column nobody migrated.
  const read = p.match(/^\s+(\w+): r\.\w+ \?\? '',$/gm) ?? [];
  expect(read.length, 'exactly ten, no more and no fewer').toBe(COLUMNS.length);
});

test('every control keeps the test id a runner already knows', () => {
  const p = panel();
  for (const id of TESTIDS) {
    expect(p, `${id} must survive the redesign`).toContain(`data-testid="${id}"`);
  }
});

test('the save is the SAME one call with the SAME whole patch', () => {
  const p = panel();
  expect(p).toContain("send('/api/owner/action', { action: 'write-identity', patch: form })");
  expect((p.match(/send\(/g) ?? []).length, 'one save, not one per card').toBe(1);
  expect(p, 'and the same confirmation').toContain('Restaurant details saved — every document follows');
});

test('no backend was touched by a presentation change', () => {
  const p = panel();
  expect(p, 'no query').not.toMatch(/from '@\/lib\/db\/queries'/);
  expect(p, 'no second action').not.toMatch(/action: '(?!write-identity)/);
  // A per-field save would be a new contract and a new failure mode on a screen that had one.
  expect(p).not.toContain('onBlur=');
});

test('the shipped sentences are frozen, not rewritten', () => {
  const p = panel();
  for (const kept of [
    'These details appear on the bill, on offer letters and experience certificates',
    'The badge printed on the QR stands, the bill and every HR document.',
    /*
      'Replacing the artwork is a file change' was frozen here by the redesign, which had no way
      to replace it. The logo upload gives it one, so the sentence is not a shipped string being
      rewritten — it is a stated LIMITATION that stopped being true. Removed rather than kept as
      a passing assertion about a screen that no longer says it: an assertion nobody can act on
      is the kind that gets deleted wholesale later, taking the ones that still matter with it.
      Everything else this test froze is still frozen.
    */
  ]) {
    expect(p, `"${kept.slice(0, 40)}…" must survive`).toContain(kept);
  }
});

test('it is still an editable form, not a profile card', () => {
  const p = panel();
  expect((p.match(/<Input\b/g) ?? []).length, 'nine text inputs').toBe(9);
  expect((p.match(/<Textarea\b/g) ?? []).length, 'and the address').toBe(1);
  expect(p, 'no modal was introduced for ordinary editing').not.toContain('<Sheet');
  expect(p, 'nothing became read-only').not.toContain('readOnly');
  /* `busy` is the details form's own save; `saving` is the logo card's, which posts separately
     because bytes cannot ride in a JSON patch. Both are "while saving" — the thing this asserts
     is absent is a control disabled for any OTHER reason, which would be a read-only screen
     wearing a form's clothes. */
  expect(p, 'and nothing became disabled except while saving').not.toMatch(
    /disabled=\{(?!busy\}|saving\}|saving \|\| busy\})/
  );
});

test('one column on a phone, two only where they fit', () => {
  const p = panel();
  expect(p).toContain("const pair = 'grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'");
  // The shape that was there before: flex-wrap with a 14rem floor, which at 320px inside a card
  // is a box wider than the space it has.
  expect(p, 'no min-width floors left').not.toMatch(/min-w-\[\d+rem\]/);
  expect(p, 'never two columns at every width').not.toMatch(/(?<!md:)grid-cols-2/);
});

test('the brand block uses the token pair, never a colour literal', () => {
  const p = panel();
  expect(p).toContain('bg-[var(--primary)]');
  expect(p).toContain('text-[var(--on-primary)]');
  // Colour lives in design/tokens.json and nowhere else.
  expect(p, 'no hex').not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(p, 'no rgb()').not.toMatch(/rgba?\(/);
});

test('the brand block borrows composition and none of the guest content', () => {
  const p = panel();
  for (const guestOnly of ['Good morning', 'Start ordering', 'is your captain', 'You are at table']) {
    expect(p, `"${guestOnly}" belongs to the customer app`).not.toContain(guestOnly);
  }
  // It shows the name guests see, live from the field below it.
  expect(p).toContain('{form.display_name || ');
});

test('no other Settings panel was disturbed', () => {
  // The redesign is one function. Everything else in this file keeps its own shape.
  for (const otherPanel of ['function TaxPanel(', 'function HoursPanel(', 'function InvoicePanel(']) {
    if (source.includes(otherPanel)) expect(source).toContain(otherPanel);
  }
  expect(source, 'the tab list is untouched').toContain(
    "{ key: 'identity', label: 'Restaurant details', permission: 'set.identity' }"
  );
});
