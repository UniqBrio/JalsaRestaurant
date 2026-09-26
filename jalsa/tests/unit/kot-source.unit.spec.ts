import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { KOT_SOURCE_LABEL } from '../../src/lib/status';

/**
 * Where a round came from (24-Sep correction list, C3).
 *
 * `kot.source` is written by the ROUTE that placed the round - the guest's phone, the captain's
 * phone, the owner's console - and is the only thing read to say where an order came from. It was
 * spelled out twice (owner board, report) and printed on the KOT as the raw enum, switched off by
 * default; the live KOT template had it saved off.
 */

const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('the three sources, in words', () => {
  expect(KOT_SOURCE_LABEL).toEqual({ guest: 'Guest phone', captain: 'Captain', owner: 'Owner' });
});

test('each route stamps its own source - captain, owner, guest QR', () => {
  expect(code('src/app/api/staff/action/route.ts')).toContain("source: 'captain'");
  expect(code('src/app/api/owner/action/route.ts')).toContain("source: 'owner'");
  expect(code('src/app/api/guest/round/route.ts')).toContain("source: 'guest'");
});

test('one map: the owner board, the report and the printed KOT all read KOT_SOURCE_LABEL', () => {
  for (const f of ['src/lib/db/owner-view.ts', 'src/app/api/owner/report/route.ts', 'src/lib/db/bridge-payload.ts']) {
    const src = code(f);
    expect(src, f).toContain('KOT_SOURCE_LABEL[');
    expect(src, `${f}: no private copy`).not.toMatch(/const SOURCE_LABEL/);
  }
});

test('the printed ticket carries the words from the stored column, not the enum', () => {
  const payload = code('src/lib/db/bridge-payload.ts');
  expect(payload).toMatch(/source: kotRow\?\.source\s*\?\s*\(KOT_SOURCE_LABEL\[kotRow\.source/);
  const template = code('src/lib/print-template.ts');
  expect(template).toContain("export const LOCKED_FIELDS = ['itemName', 'qty', 'amount', 'source'] as const;");
  // SUPERSEDED 25-Sep-2026 (item 14, row modes): previously matched
  // `(LOCKED_FIELDS as readonly string[]).includes(key) || config.on[key] !== false` in `isOn`.
  // The lock now lives in `rowMode`, which answers 'always' for a locked field before anything a
  // stored template says - the same guarantee, one function up.
  expect(template).toMatch(
    /if \(\(LOCKED_FIELDS as readonly string\[\]\)\.includes\(key\)\) return 'always';/
  );
});
