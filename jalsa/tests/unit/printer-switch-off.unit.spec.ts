import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * 30-Sep-2026 — "After disabling the device, save changes is not working."
 *
 * The 24-Sep fix (B1, tests/unit/printer-management.unit.spec.ts) exempted printers reached
 * through a printing computer from the address rule. It left the other case: a network printer
 * (Ethernet / Wi-Fi) with no IP address typed in and no computer behind it — every printer the
 * seed creates. Switching one off greyed out Save changes, because the form still demanded an
 * address, and said nothing about why.
 *
 * An address is what it takes to REACH a machine. A machine switched off is not reached, so it
 * needs none — which is exactly what `printer_address_when_networked` already allows
 * (`online = false`). Switching it back on still asks for one.
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

test('the server asks for an address only of a machine that is switched on', () => {
  const fn = bodyOf(OWNER, 'export async function upsertPrinter');
  // `!== false`: a request that omits `enabled` inserts an enabled printer (column default true).
  expect(fn).toContain("input.enabled !== false && input.connection !== 'USB' && !input.address.trim() && !mapping");
});

test('Save changes is not held back by a missing address on a machine being switched off', () => {
  const ui = code(SETUP);
  expect(ui).toMatch(
    /form\.enabled &&\s*form\.connection !== 'USB' &&\s*!form\.address\.trim\(\) &&\s*!\(form\.id && throughComputer\.has\(form\.id\)\)/
  );
});

test('the address field is required only while the machine is in use', () => {
  const ui = code(SETUP);
  expect(ui).toMatch(/label="IP address"\s+required=\{form\.enabled\}/);
});
