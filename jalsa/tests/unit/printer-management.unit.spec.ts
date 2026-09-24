import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Printer management (24-Sep correction list B1, B2, B3).
 *
 * B1  "Disable -> Save Changes does not persist." A printer set up through a printing computer is
 *     created with no address (the computer is how it is reached). The form and `upsertPrinter`
 *     both demanded an address of any non-USB machine, so Save was disabled and the server would
 *     have refused it anyway: the toggle moved, nothing was written.
 * B2  There was no way to delete a printer at all.
 * B3  A Windows printer, once mapped, showed no control to change or stop it; the chooser hid
 *     every mapped printer; disconnecting a computer left its mappings behind; and one Windows
 *     queue could be mapped to two Jalsa printers (every ticket twice).
 *
 * The rules live in server mutations over Postgres, so the pins are on the lines that carry them.
 */

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function bodyOf(path: string, signature: string): string {
  const src = code(path);
  const start = src.indexOf(signature);
  expect(start, `${signature} exists in ${path}`).toBeGreaterThan(-1);
  const rest = src.slice(start);
  return rest.slice(0, rest.indexOf('\n}\n'));
}

const OWNER = 'src/lib/db/owner-mutations.ts';
const SETUP = 'src/features/owner/sections/PrintSetupSection.tsx';
const SCREEN = 'src/features/owner/sections/PrintersSection.tsx';
const ROUTE = 'src/app/api/owner/action/route.ts';

test('B1: a printer reached through a computer saves without an address of its own', () => {
  const fn = bodyOf(OWNER, 'export async function upsertPrinter');
  expect(fn).toContain(".from('bridge_printer')");
  expect(fn).toContain("input.connection !== 'USB' && !input.address.trim() && !mapping");
  const ui = code(SETUP);
  expect(ui).toContain('const throughComputer = new Set(data.printerMappings.map((m) => m.printerId));');
  expect(ui).toMatch(/!form\.address\.trim\(\) && !\(form\.id && throughComputer\.has\(form\.id\)\)/);
});

test('B1: a save is scoped to this restaurant and must change exactly one row', () => {
  const fn = bodyOf(OWNER, 'export async function upsertPrinter');
  expect(fn).toMatch(
    /\.update\(patch\)\s*\.eq\('id', input\.id\)\s*\.eq\('restaurant_id', restaurantId\)\s*\.select\('id'\)/
  );
  expect(fn).toContain('(saved ?? []).length !== 1');
  // `enabled` is still what is written, and what the audit line reports.
  expect(fn).toContain('enabled: input.enabled');
});

test('B2: delete is permission-gated, scoped, audited - and refused while tickets wait on it', () => {
  const fn = bodyOf(OWNER, 'export async function deletePrinter');
  expect(fn).toContain("demand(input.actor, 'set.printer')");
  expect(fn).toMatch(
    /\.from\('print_job'\)[\s\S]*\.eq\('printer_id', input\.printerId\)[\s\S]*\.in\('status', \['queued', 'processing'\]\)/
  );
  expect(fn).toContain('waiting to print');
  expect(fn.indexOf("in('status'")).toBeLessThan(fn.indexOf('.delete()'));
  expect(fn).toMatch(/\.delete\(\)\s*\.eq\('id', input\.printerId\)\s*\.eq\('restaurant_id', restaurantId\)/);
  expect(fn).toContain("action: 'Printer'");
  expect(code(ROUTE)).toContain("case 'delete-printer':");
});

test('B2: the delete control asks first, and says what happens to routes and history', () => {
  const ui = code(SETUP);
  expect(ui).toContain('data-testid="owner-print-delete"');
  expect(ui).toContain('testId="owner-print-delete-confirm"');
  expect(ui).toContain("action: 'delete-printer'");
  expect(ui).toContain('will print at the main kitchen printer instead');
  // The sheet closes only after the server answered.
  const remove = ui.slice(ui.indexOf('const remove = (f: PrinterForm)'));
  expect(remove.indexOf("await send('/api/owner/action', { action: 'delete-printer'")).toBeLessThan(
    remove.indexOf('setForm(null)')
  );
});

test('B3: a mapped Windows printer can be changed or stopped from where it is listed', () => {
  const ui = code(SCREEN);
  expect(ui).toContain('owner-printers-change-');
  expect(ui).toContain('owner-printers-stop-');
  expect(ui).toContain('currentPrinterId: jalsaPrinter.id');
  expect(ui).toContain('onClick={() => removeMapping(jalsaPrinter)}');
});

test('B3: the chooser offers every printer, and says when choosing one moves it', () => {
  const ui = code(SCREEN);
  expect(ui).toContain('existing={data.printers}');
  expect(ui).not.toContain('existing={data.printers.filter((p) => !mappingByPrinter.has(p.id))}');
  expect(ui).toContain('moves here');
});

test('B3: one Windows printer prints as one Jalsa printer', () => {
  const fn = bodyOf(OWNER, 'export async function savePrinterMapping');
  expect(fn).toMatch(
    /\.delete\(\)\s*\.eq\('bridge_token_id', input\.computerId\)[\s\S]*\.eq\('queue_name', input\.queueName\)\s*\.neq\('printer_id', printerId\)/
  );
  expect(fn.indexOf(".neq('printer_id', printerId)")).toBeLessThan(fn.indexOf('.upsert('));
});

test('B3: disconnecting a computer takes its printers off it', () => {
  const fn = bodyOf(OWNER, 'export async function revokeBridgeToken');
  expect(fn).toMatch(/\.from\('bridge_printer'\)\s*\.delete\(\)\s*\.eq\('bridge_token_id', input\.tokenId\)/);
  // The token itself is still revoked, never deleted.
  expect(fn).toContain('update({ revoked_at: new Date().toISOString() })');
});
