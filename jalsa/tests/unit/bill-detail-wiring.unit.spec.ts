/**
 * The bill-detail screen's wiring, and the print stylesheet that makes "Print" mean one bill.
 *
 * WHY A SOURCE PARSE
 *   Both things this guards are structural and neither can be reached by the tiers available
 *   here: the drill-down needs a signed-in owner console with a closed bill on it, and
 *   `@media print` is not exercised by a headless render. The logic worth testing properly —
 *   what the shared message says — is `tests/unit/bill-share.unit.spec.ts`, where it is a pure
 *   function. This file covers what that one cannot see.
 *
 * FAIL-FIRST EVIDENCE (17-Sep-2026, against the pre-change tree): recorded in TEST_SUMMARY.md.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const payments = readFileSync('src/features/owner/sections/Payments.tsx', 'utf8');
const sheet = readFileSync('src/features/owner/BillDetailSheet.tsx', 'utf8');
const css = readFileSync('src/app/globals.css', 'utf8');

test('the parse found all three files — a scan of the wrong file is not a pass', () => {
  expect(payments).toContain('Closed today');
  expect(sheet).toContain('export function BillDetailSheet');
  expect(css).toContain('@media print');
});

test('the bill number in Closed today opens the bill', () => {
  expect(payments, 'the Bill cell is a real button, not a clickable row').toMatch(
    /data-testid=\{`owner-open-bill-\$\{b\.code\}`\}/
  );
  expect(payments).toContain('onClick={() => setViewing(b)}');
  expect(payments).toContain('<BillDetailSheet');
});

test('viewing a bill and closing one are separate pieces of state', () => {
  // One `selected` would open the wrong sheet the first time both were reachable from one table.
  expect(payments).toContain('const [viewing, setViewing]');
  expect(payments).toContain('const [closing, setClosing]');
  expect(payments).toContain('open={viewing !== null}');
  expect(payments).toContain('open={closing !== null}');
});

test('the screen shows the order details and the totals that carry GST', () => {
  expect(sheet).toContain('data-testid="owner-bill-detail-rounds"');
  expect(sheet).toContain('k.items.map(');
  expect(sheet, 'the SCREEN\'s totals rows, where GST already lives').toContain(
    '<TotalsBlock rows={bill.totals}'
  );
  // Not recomputed here. A second answer to "what did this bill come to" is Standard 7.4's
  // whole subject, and the first bill with a discount is where the two would part company.
  expect(sheet).not.toMatch(/taxRate\s*[*/]/);
  expect(sheet).not.toContain('billTotals(');
});

test('both buttons the requester asked for are on it', () => {
  // Matched from the testid to the label rather than as `>Print<`: the formatter breaks a
  // multi-prop button across lines, so the literal never appears. The first draft of this test
  // asserted it and went red on correctly-formatted code.
  expect(sheet, 'the Print button, labelled Print').toMatch(
    /data-testid="owner-bill-print"[\s\S]{0,240}>\s*Print\s*</
  );
  expect(sheet, 'the share button, labelled in the requester\'s own words').toMatch(
    /data-testid="owner-bill-share-whatsapp"[\s\S]{0,240}Share to whatsapp/
  );
});

test('the share link opens WhatsApp on the OWNER\'s device — no outbound send', () => {
  // The safety floor is outbound-send deny-by-default. A `wa.me` href is the owner sharing from
  // their own phone; a server-side POST to a messaging API would be this application sending a
  // customer's bill to a third party, and that is approved explicitly or it is not built.
  expect(sheet).toContain('whatsAppShareUrl(billShareText(');
  expect(sheet, 'a link, not a request').toContain('href={shareUrl}');
  expect(sheet, 'no server-side send on this path').not.toContain('send(');
  expect(sheet, 'no fetch on this path').not.toContain('fetch(');
  // target=_blank without this hands the opened tab a handle on a signed-in owner console.
  expect(sheet).toContain('rel="noreferrer"');
});

test('the print stylesheet prints the panel and not the console behind it', () => {
  expect(css).toContain('body:has(.j-print-root)');
  expect(sheet, 'the sheet marks its printable body').toContain('j-print-root');
  // The dialog is fixed, centred and capped at 88vh on screen. On paper it is a document.
  for (const neutralised of ['position: static', 'max-height: none', 'transform: none']) {
    expect(css, `the dialog's ${neutralised} must be stated for print`).toContain(neutralised);
  }
  // A scrolling box prints only the slice that was visible.
  expect(css).toContain('overflow: visible !important');
});

test('the print rules are scoped, so a page with no panel prints as it always did', () => {
  // A blanket `* { display: none }` inside @media print would silently break every other
  // printable thing in the console.
  const printBlock = css.slice(css.indexOf('@media print'));
  expect(printBlock).not.toMatch(/^\s*\*\s*\{/m);
  const hides = printBlock.match(/display: none !important;/g) ?? [];
  expect(hides.length, 'every hide rule is scoped').toBeGreaterThan(0);
  for (const line of printBlock.split('\n')) {
    if (!line.includes('display: none')) continue;
    // Each hide must be reachable only from `.j-no-print` or from a `:has(.j-print-root)` scope.
    expect(
      printBlock.slice(0, printBlock.indexOf(line)).includes('j-print-root') ||
        printBlock.slice(0, printBlock.indexOf(line)).includes('j-no-print'),
      'no unscoped hide rule in the print block'
    ).toBe(true);
  }
});

test('no JavaScript toggles a body class to print', () => {
  // A class added on print and removed afterwards is state that can be left behind — by an
  // error, a cancelled dialog, an unmount mid-print — and a console stuck with every panel
  // hidden is a far worse failure than a print that came out wrong.
  expect(sheet).not.toContain('document.body.classList');
  expect(sheet, 'the browser print dialog, nothing more').toContain('window.print()');
});
