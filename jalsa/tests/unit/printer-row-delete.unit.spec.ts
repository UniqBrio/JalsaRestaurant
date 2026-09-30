import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * 30-Sep-2026 — "Add delete button against a printer."
 *
 * Settings → Printers → Printers listed each machine with Test print, Preview and Configure; Delete
 * was only inside the Configure sheet, so it was not "against" the printer. The top-level
 * Printers screen (PrintersSection) already has it on the row. The row button opens the SAME
 * confirmation the sheet's Delete does - one delete path, not two.
 */
const code = (p: string): string =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const SETUP = 'src/features/owner/sections/PrintSetupSection.tsx';

test('each printer row on the Printers tab has Delete, for the owner who may edit printers', () => {
  const ui = code(SETUP);
  const row = ui.indexOf('data-testid={`owner-print-row-delete-${p.id}`}');
  expect(row).toBeGreaterThan(-1);
  const configure = ui.indexOf('data-testid={`owner-print-configure-${p.id}`}');
  expect(configure).toBeGreaterThan(-1);
  // Beside Configure, inside the same `canEdit` gate.
  expect(row).toBeGreaterThan(configure);
  expect(ui.slice(configure, row)).toContain('{canEdit ? (');
});

test('the row Delete opens the existing confirmation, not a delete of its own', () => {
  const ui = code(SETUP);
  const row = ui.slice(ui.indexOf('data-testid={`owner-print-row-delete-${p.id}`}'));
  expect(row.slice(0, 400)).toContain('onClick={() => setDeleting({ ...p })}');
  // Exactly one place sends delete-printer.
  expect(ui.match(/action: 'delete-printer'/g)?.length).toBe(1);
  expect(ui).toContain('testId="owner-print-delete-confirm"');
});
